import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useApp }  from "../context/AppContext.jsx";

// ─── Constants ───────────────────────────────────────────────────────────────
const HAIKU  = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";

const STAGES = [
  { id: "haiku1", label: "Extract Queries",    model: "Haiku"  },
  { id: "haiku2", label: "Extract ICP Targets", model: "Haiku" },
  { id: "haiku3", label: "Extract Hooks",       model: "Haiku" },
  { id: "haiku4", label: "Extract Qual Criteria", model: "Haiku" },
  { id: "sonnet", label: "Synthesize Strategy", model: "Sonnet" },
  { id: "apollo", label: "Search & Enrich",     model: "Apollo" },
];

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function emailScore(c) {
  const s = (c.emailStatus || "").toLowerCase();
  if (s === "verified") return 3;
  if (s.includes("likely")) return 2;
  if (c.email) return 1;
  return 0;
}

function seniorityScore(title) {
  const t = (title || "").toLowerCase();
  if (/\b(ceo|cto|coo|cfo|ciso|c[a-z]o)\b/.test(t)) return 5;
  if (/\bfounder|co-founder\b/.test(t)) return 4;
  if (/\bvp\b|vice president/.test(t)) return 3;
  if (/\bdirector|head of|dean\b/.test(t)) return 2;
  if (/\bsenior|lead|principal|manager\b/.test(t)) return 1;
  return 0;
}

// Fixed qual scoring — routes by category, not just keyword matching
function runQualChecks(contact, checklist, targetTitles) {
  if (!checklist?.length) return [];
  return checklist.map((item) => {
    const cat = (item.category || "").toLowerCase();
    const crit = (item.criterion || "").toLowerCase();

    // Decision-maker / title
    if (cat === "title" || cat === "decision-maker") {
      const titleMatch = targetTitles?.some((t) =>
        (contact.title || "").toLowerCase().includes(t.toLowerCase())
      );
      return { ...item, checkable: true, passed: !!titleMatch, note: titleMatch ? null : "Title doesn't match ICP" };
    }

    // Company size — parse "X-Y employees" or "X+" from criterion text
    if (cat === "size" || cat === "company-size") {
      const size = parseInt(contact.companySize, 10);
      if (!size) return { ...item, checkable: false, passed: null, note: "Company size not in Apollo data" };
      const rangeMatch = crit.match(/(\d+)\s*[-–]\s*(\d+)/);
      const plusMatch  = crit.match(/(\d+)\+/);
      let passed = false;
      if (rangeMatch) passed = size >= parseInt(rangeMatch[1]) && size <= parseInt(rangeMatch[2]);
      else if (plusMatch) passed = size >= parseInt(plusMatch[1]);
      return { ...item, checkable: true, passed, note: passed ? null : `Company has ${size} employees` };
    }

    // Industry — extract keywords from criterion, not just truthy check
    if (cat === "industry") {
      const industry = (contact.industry || "").toLowerCase();
      if (!industry) return { ...item, checkable: false, passed: null, note: "Industry unknown" };
      const keywords = crit.replace(/[^a-z0-9 ]/g, " ").split(" ").filter((w) => w.length > 3);
      const passed = keywords.length === 0 || keywords.some((kw) => industry.includes(kw));
      return { ...item, checkable: true, passed, note: passed ? null : `Industry '${contact.industry}' may not match` };
    }

    // Email
    if (cat === "email") {
      return { ...item, checkable: true, passed: !!contact.email, note: contact.email ? null : "No email found" };
    }

    // LinkedIn
    if (cat === "linkedin") {
      return { ...item, checkable: true, passed: !!contact.linkedinUrl, note: contact.linkedinUrl ? null : "No LinkedIn found" };
    }

    // Location — extract from criterion text, not hardcoded US
    if (cat === "location") {
      const loc = (contact.location || "").toLowerCase();
      if (!loc) return { ...item, checkable: false, passed: null, note: "Location unknown" };
      const geos = crit.replace(/[^a-z0-9 ,]/g, "").split(/[\s,]+/).filter((w) => w.length > 2);
      const passed = geos.length === 0 || geos.some((geo) => loc.includes(geo));
      return { ...item, checkable: true, passed, note: passed ? null : `Location '${contact.location}' may not match` };
    }

    return { ...item, checkable: false, passed: null, note: "Requires manual verification" };
  });
}

// Weighted fit score: required categories count double
function fitScore(checks) {
  const checkable = checks.filter((c) => c.checkable);
  if (!checkable.length) return null;
  const passed = checkable.filter((c) => c.passed).length;
  return Math.round((passed / checkable.length) * 100);
}

// ─── Apollo helpers ───────────────────────────────────────────────────────────

const TO_EMPLOYEE_RANGE = (v) => {
  if (!v) return null;
  if (typeof v === "string" && v.includes(",")) return v;
  const s = String(v);
  const plus  = s.match(/(\d+)\+/);
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (plus)  return `${plus[1]},10000`;
  if (range) return `${range[1]},${range[2]}`;
  return null;
};

function sanitizeFilters(raw) {
  const out = {};
  const titleFields = new Set(["person_titles","job_titles","titles","decision_maker","contact_titles"]);
  for (const [k, v] of Object.entries(raw || {})) {
    const key = k.toLowerCase().replace(/[-\s]/g,"_");
    if (titleFields.has(key)) continue;
    if (/^(employee_count|company_size|size|headcount|num_employees)$/.test(key)) {
      const r = TO_EMPLOYEE_RANGE(v);
      if (r) out.organization_num_employees_ranges = [r];
    } else if (/location/.test(key)) {
      const locs = Array.isArray(v) ? v : [v];
      out.organization_locations = locs;
    } else if (/keyword|tech|use_case/.test(key)) {
      out.q_keywords = Array.isArray(v) ? v.join(" ") : v;
    } else if (/industry|sector|vertical/.test(key)) {
      out.q_keywords = ((out.q_keywords || "") + " " + (Array.isArray(v) ? v.join(" ") : v)).trim();
    } else {
      out[k] = v;
    }
  }
  return out;
}

function mapContact(p, hookFn) {
  const org = p.organization || {};
  return {
    id:          p.id,
    name:        [p.first_name, p.last_name].filter(Boolean).join(" "),
    title:       p.title || "",
    company:     p.organization_name || org.name || "",
    companyDomain: org.primary_domain || p.organization_domain || "",
    companySize: org.estimated_num_employees ? String(org.estimated_num_employees) : "",
    industry:    org.industry || p.industry || "",
    location:    [p.city, p.state, p.country].filter(Boolean).join(", "),
    email:       p.email || p.contact?.email || null,
    emailStatus: (() => {
      const s = (p.email_status || p.contact?.email_status || "").toLowerCase();
      if (s === "verified") return "verified";
      if (s.includes("likely")) return "likely";
      return p.email ? "likely" : "none";
    })(),
    linkedinUrl: p.linkedin_url || p.contact?.linkedin_url || null,
    photoUrl:    p.photo_url || null,
    hook:        hookFn ? hookFn(p.title) : null,
  };
}

function deduplicateContacts(batches) {
  const byId    = new Map();
  const byEmail = new Map();
  for (const c of batches.flat()) {
    if (byId.has(c.id)) {
      if (c.email && !byId.get(c.id).email) byId.set(c.id, c);
      continue;
    }
    const emailKey = c.email?.toLowerCase().trim();
    if (emailKey && byEmail.has(emailKey)) continue;
    byId.set(c.id, c);
    if (emailKey) byEmail.set(emailKey, c.id);
  }
  return Array.from(byId.values())
    .sort((a, b) => emailScore(b) - emailScore(a) || seniorityScore(b.title) - seniorityScore(a.title));
}

async function apolloSearchWithFallback(apiKey, filters, personTitles, seniorityLevels) {
  for (let tier = 1; tier <= 3; tier++) {
    const sl = tier === 1 ? seniorityLevels : [];
    const f  = tier === 3 ? {
      organization_locations: filters.organization_locations,
      organization_num_employees_ranges: filters.organization_num_employees_ranges,
    } : filters;
    const result = await invoke("apollo_people_search", { apiKey, filters: f, personTitles: tier === 3 ? [] : personTitles, seniorityLevels: sl });
    const people = result?.people || [];
    if (people.length > 0) return { people, tier };
  }
  return { people: [], tier: 3 };
}

async function apolloSearchAndEnrich(apiKey, filters, personTitles, seniorityLevels, hookFn) {
  const clean = sanitizeFilters(filters);
  const { people, tier } = await apolloSearchWithFallback(apiKey, clean, personTitles, seniorityLevels);

  const needEmail = people.filter((p) => !p.email);
  let enrichMap = new Map();
  if (needEmail.length > 0) {
    const details = needEmail.map((p) => ({
      id: p.id, first_name: p.first_name,
      organization_name: p.organization_name,
      domain: p.organization_domain || p.organization?.primary_domain,
      linkedin_url: p.linkedin_url,
    }));
    try {
      const bulk = await invoke("apollo_bulk_match", { apiKey, details });
      (bulk?.matches || []).forEach((m) => { if (m?.id) enrichMap.set(m.id, m); });
    } catch (_) {}
  }

  const mapped = people.map((p) => {
    const enriched = enrichMap.get(p.id) || p;
    return mapContact({ ...p, ...enriched }, hookFn);
  });

  return { people: mapped, tier };
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function cleanJson(raw) {
  return (raw || "").replace(/```json\n?/g, "").replace(/```/g, "").trim();
}
function parseJson(raw) {
  try { return JSON.parse(cleanJson(raw)); } catch {
    const arr = cleanJson(raw).match(/\[[\s\S]*\]/);
    if (arr) try { return JSON.parse(arr[0]); } catch {}
    const obj = cleanJson(raw).match(/\{[\s\S]*\}/);
    if (obj) try { return JSON.parse(obj[0]); } catch {}
    throw new Error("Could not parse JSON from response");
  }
}
function extractSection(md, ...headings) {
  const sections = md.split(/^##\s+/m);
  const matched  = sections.filter((s) => headings.some((h) => s.toLowerCase().startsWith(h.toLowerCase())));
  return matched.join("\n\n") || md.slice(0, 5000);
}
function pickHook(title, topHooks, primaryHook) {
  const t = (title || "").toLowerCase();
  const match = (topHooks || []).find((h) => t.includes((h.angle || "").toLowerCase().split(" ")[0]));
  return match?.hook || primaryHook || topHooks?.[0]?.hook || null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PipelineStep({ stage, status, detail, isDark, T }) {
  const MODEL_COLOR = { Haiku: "#f59e0b", Sonnet: "#8b5cf6", Apollo: "#06b6d4" };
  const color = status === "done" ? T.green : status === "error" ? T.red : status === "active" ? T.accent : T.textMuted;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
        background: color,
        boxShadow: status === "active" ? `0 0 6px ${color}` : "none",
      }} />
      <span style={{ fontSize: 12, color: status === "done" ? T.textSub : status === "active" ? T.text : T.textMuted, flex: 1 }}>
        {stage.label}
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, color: MODEL_COLOR[stage.model] || T.textMuted, opacity: status === "pending" ? 0.4 : 1 }}>
        {stage.model}
      </span>
      {status === "done" && <span style={{ color: T.green, fontSize: 11 }}>✓</span>}
      {status === "error" && <span style={{ color: T.red, fontSize: 11 }}>✗</span>}
    </div>
  );
}

function ContactCard({ contact, checks, isDark, T, selected, onToggle }) {
  const score = fitScore(checks || []);
  const scoreColor = score == null ? T.textMuted : score >= 75 ? T.green : score >= 50 ? "#f59e0b" : T.red;

  return (
    <div
      onClick={onToggle}
      style={{
        background: selected ? (isDark ? "#1e2d3d" : "#eff6ff") : T.card,
        border: `1px solid ${selected ? T.accent : T.border}`,
        borderRadius: 10, padding: "14px 16px", cursor: "pointer",
        transition: "border-color 0.1s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 2 }}>{contact.name}</div>
          <div style={{ fontSize: 11, color: T.textSub }}>{contact.title} · {contact.company}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, marginLeft: 10 }}>
          {score != null && (
            <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor, background: isDark ? "#0f172a" : "#f8fafc", padding: "1px 7px", borderRadius: 9999 }}>
              {score}%
            </span>
          )}
          {selected && <span style={{ fontSize: 10, color: T.accent }}>✓ selected</span>}
        </div>
      </div>

      {contact.email && (
        <div style={{ fontSize: 11, color: T.textSub, marginBottom: 6 }}>
          <span style={{ color: contact.emailStatus === "verified" ? T.green : "#f59e0b", marginRight: 4 }}>
            {contact.emailStatus === "verified" ? "✓" : "~"}
          </span>
          {contact.email}
        </div>
      )}

      {contact.hook && (
        <div style={{ fontSize: 11, color: T.textMuted, fontStyle: "italic", borderLeft: `2px solid ${T.border}`, paddingLeft: 8, marginTop: 6 }}>
          {contact.hook}
        </div>
      )}
    </div>
  );
}

// ─── IntelView ────────────────────────────────────────────────────────────────

export function IntelView({ T, onSendToLeads }) {
  const { isDark, settings, saveRun, addLeads } = useApp();
  const [markdown, setMarkdown]     = useState("");
  const [stageStatus, setStageStatus] = useState({});
  const [contacts, setContacts]     = useState([]);
  const [checklist, setChecklist]   = useState([]);
  const [targetTitles, setTargetTitles] = useState([]);
  const [pipelineLog, setPipelineLog] = useState([]);
  const [queryLog, setQueryLog]     = useState([]);
  const [running, setRunning]       = useState(false);
  const [error, setError]           = useState(null);
  const [done, setDone]             = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filter, setFilter]         = useState("all");
  const abortRef = useRef(false);

  const anthropicKey = settings.anthropicKey || "";
  const apolloKey    = settings.apolloKey    || "";

  const setSt = (id, status, detail) => {
    setStageStatus((p) => ({ ...p, [id]: status }));
  };

  function addLog(stage, label, data) {
    setPipelineLog((p) => [...p, { stage, label, data, ts: Date.now() }]);
  }

  async function chat(model, system, userMessage, maxTokens = 2048) {
    if (!anthropicKey) throw new Error("Anthropic API key not set — add it in Settings");
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await invoke("anthropic_chat", { apiKey: anthropicKey, model, system, userMessage, maxTokens });
      } catch (e) {
        if (String(e).includes("429") && attempt < 2) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 10000));
        } else throw e;
      }
    }
  }

  function resetPipeline() {
    setStageStatus({});
    setContacts([]); setChecklist([]); setTargetTitles([]);
    setPipelineLog([]); setQueryLog([]);
    setError(null); setDone(false);
    setSelectedIds(new Set());
  }

  async function run() {
    if (!markdown.trim()) return;
    abortRef.current = false;
    setRunning(true);
    if (!apolloKey) { setError("Apollo API key not set — add it in Settings"); setRunning(false); return; }
    const runId = `run-${Date.now()}`;
    resetPipeline();
    STAGES.forEach((s) => setSt(s.id, "pending"));

    try {
      // ── Stage 1: Extract Apollo queries ───────────────────────────────────
      setSt("haiku1", "active");
      const queriesSection = extractSection(markdown, "Apollo Search Queries", "Search Queries", "Queries");
      const q1raw = await chat(HAIKU,
        "Extract Apollo search query objects. Return ONLY valid JSON array. Each object must have 'label' (string) and 'filters' (object).",
        queriesSection, 1024);
      const apolloQueries = parseJson(q1raw);
      setSt("haiku1", "done"); addLog("haiku1", "Extract Queries", { count: apolloQueries.length });
      if (abortRef.current) { setRunning(false); return; }

      // ── Stage 2: Extract ICP targets ──────────────────────────────────────
      setSt("haiku2", "active");
      const icpSection = extractSection(markdown, "ICP Profile", "Qualifying Criteria", "Target Audience");
      const q2raw = await chat(HAIKU,
        'Extract person titles and seniority levels. Return ONLY valid JSON: { "personTitles": [...], "seniorityLevels": [...] }. Seniority values must be from: c_suite, vp, director, manager, senior, founder.',
        icpSection, 512);
      const { personTitles = ["CTO","Founder","VP Engineering"], seniorityLevels = ["c_suite","vp","director","founder"] } = parseJson(q2raw);
      setSt("haiku2", "done"); addLog("haiku2", "ICP Targets", { personTitles, seniorityLevels });
      if (abortRef.current) { setRunning(false); return; }

      // ── Stage 3: Extract hooks ────────────────────────────────────────────
      setSt("haiku3", "active");
      const hooksSection = extractSection(markdown, "Sales Angles", "Sales Hooks", "Hooks", "Messaging");
      const q3raw = await chat(HAIKU,
        'Extract 3 sales hooks. Return ONLY valid JSON: { "topHooks": [{ "angle": "name", "hook": "one sentence pitch" }] }',
        hooksSection, 512);
      const { topHooks = [] } = parseJson(q3raw);
      setSt("haiku3", "done"); addLog("haiku3", "Sales Hooks", { count: topHooks.length });
      if (abortRef.current) { setRunning(false); return; }

      // ── Stage 4: Extract qual checklist ───────────────────────────────────
      setSt("haiku4", "active");
      let extractedChecklist = [];
      try {
        const qualSection = extractSection(markdown, "Qualification Checklist", "Qualifying Criteria", "Qual");
        const q4raw = await chat(HAIKU,
          'Extract qualification criteria. Return ONLY valid JSON array: [{ "criterion": "text", "category": "title|size|industry|email|linkedin|location|other" }]',
          qualSection, 512);
        extractedChecklist = parseJson(q4raw);
      } catch (_) {}
      setChecklist(extractedChecklist);
      setSt("haiku4", "done"); addLog("haiku4", "Qual Criteria", { count: extractedChecklist.length });
      if (abortRef.current) { setRunning(false); return; }

      // ── Stage 5: Synthesize strategy ──────────────────────────────────────
      setSt("sonnet", "active");
      const strategyPrompt = `Queries: ${JSON.stringify(apolloQueries.map((q, i) => ({ i, label: q.label })))}
Titles: ${JSON.stringify(personTitles)}
Seniority: ${JSON.stringify(seniorityLevels)}
Hooks: ${JSON.stringify(topHooks)}

Pick the best 3 query indices. Merge and deduplicate titles (max 12). Select the primary hook.
Return ONLY valid JSON: { "queryIndices": [0,1,2], "personTitles": [...], "seniorityLevels": [...], "primaryHook": "..." }`;
      const q5raw = await chat(SONNET, "You are a B2B sales strategist.", strategyPrompt, 1024);
      const strategy = parseJson(q5raw);
      const selectedQueries = (strategy.queryIndices || [0, 1, 2]).slice(0, 3).map((i) => apolloQueries[i]).filter(Boolean);
      const finalTitles    = strategy.personTitles || personTitles;
      const finalSeniority = strategy.seniorityLevels || seniorityLevels;
      const primaryHook    = strategy.primaryHook || topHooks[0]?.hook || "";
      setTargetTitles(finalTitles);
      setSt("sonnet", "done"); addLog("sonnet", "Strategy", strategy);
      if (abortRef.current) { setRunning(false); return; }

      // ── Stage 6: Apollo search ────────────────────────────────────────────
      setSt("apollo", "active");
      const hookFn = (title) => pickHook(title, topHooks, primaryHook);

      const results = await Promise.all(
        selectedQueries.map(async (q) => {
          const { people, tier } = await apolloSearchAndEnrich(apolloKey, q.filters, finalTitles, finalSeniority, hookFn);
          setQueryLog((prev) => [...prev, { label: q.label, count: people.length, tier }]);
          return people;
        })
      );

      const allContacts = deduplicateContacts(results);
      // Add qual scores
      const scored = allContacts.map((c) => {
        const checks = runQualChecks(c, extractedChecklist, finalTitles);
        return { ...c, fitScore: fitScore(checks), qualChecks: checks, runId };
      });

      setContacts(scored);
      saveRun({ mode: "intel", contactCount: scored.length, emailCount: scored.filter((c) => c.email).length, contacts: scored, queryLog, pipelineLog, checklist: extractedChecklist, targetTitles: finalTitles });
      setSt("apollo", "done");
      setDone(true);
      addLog("apollo", "Results", { count: scored.length, withEmail: scored.filter((c) => c.email).length });

    } catch (err) {
      setError(String(err));
      STAGES.forEach((s) => { if (stageStatus[s.id] === "active") setSt(s.id, "error"); });
    } finally {
      setRunning(false);
    }
  }

  const visible = filter === "email" ? contacts.filter((c) => c.email) : contacts;
  const allSelected = visible.length > 0 && visible.every((c) => selectedIds.has(c.id));

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(visible.map((c) => c.id)));
  }

  function sendToLeads() {
    const toSend = contacts.filter((c) => selectedIds.has(c.id));
    const payload = (toSend.length ? toSend : contacts).map(c => ({ ...c, source: "intel" }));
    addLeads(payload);
    onSendToLeads(payload);
  }

  const T_local = { ...T, green: isDark ? "#86efac" : "#15803d", red: isDark ? "#f87171" : "#dc2626" };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <div style={{
        width: 300, flexShrink: 0,
        background: T.surface,
        borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        padding: 16, gap: 12, overflowY: "auto",
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Intel Pack</div>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Paste your intel pack markdown here…

## Apollo Search Queries
## ICP Profile
## Sales Angles
## Qualification Checklist"
            rows={12}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "10px 12px",
              background: isDark ? "#0a0f1a" : "#ffffff",
              border: `1px solid ${T.border}`,
              borderRadius: 8, color: T.text, fontSize: 12,
              resize: "none", outline: "none", fontFamily: "monospace",
              lineHeight: 1.5,
            }}
          />
        </div>

        <button
          onClick={running ? undefined : run}
          disabled={running || !markdown.trim()}
          style={{
            width: "100%", padding: "10px 0",
            background: running ? T.textMuted : T.accent,
            border: "none", borderRadius: 8,
            color: "#fff", fontSize: 13, fontWeight: 700,
            cursor: running ? "not-allowed" : "pointer",
          }}
        >
          {running ? "Running pipeline…" : "Run Intel Pipeline →"}
        </button>
        {running && (
          <button
            onClick={() => { abortRef.current = true; }}
            style={{
              width: "100%", padding: "8px 0",
              background: "transparent",
              border: `1px solid ${T_local.red}`,
              borderRadius: 8,
              color: T_local.red, fontSize: 12, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✕ Abort
          </button>
        )}

        {!anthropicKey && (
          <div style={{ background: isDark ? "#1f0a0a" : "#fff5f5", border: `1px solid ${isDark ? "#7f1d1d" : "#fecaca"}`, borderRadius: 7, padding: "8px 10px", fontSize: 11, color: isDark ? "#f87171" : "#dc2626" }}>
            ⚠ Anthropic API key not set — go to Settings
          </div>
        )}

        {/* Pipeline steps */}
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Pipeline</div>
          {STAGES.map((s) => (
            <PipelineStep key={s.id} stage={s} status={stageStatus[s.id] || "pending"} isDark={isDark} T={T_local} />
          ))}
        </div>

        {error && (
          <div style={{ background: isDark ? "#1f0a0a" : "#fff5f5", border: `1px solid ${isDark ? "#7f1d1d" : "#fecaca"}`, borderRadius: 7, padding: "10px 12px", fontSize: 12, color: isDark ? "#f87171" : "#dc2626" }}>
            {error}
          </div>
        )}

        {/* Query log */}
        {queryLog.length > 0 && (
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Queries</div>
            {queryLog.map((q, i) => (
              <div key={i} style={{ fontSize: 11, color: T.textSub, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{q.label}</span>
                <span style={{ flexShrink: 0, marginLeft: 8, color: q.tier > 1 ? "#f59e0b" : T.textMuted }}>
                  {q.count} {q.tier > 1 ? `(T${q.tier})` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Results ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Results toolbar */}
        {(contacts.length > 0 || done) && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 16px", borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
              {contacts.length} contacts · {contacts.filter((c) => c.email).length} with email
            </span>
            <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
              {[["all", "All"], ["email", "Has Email"]].map(([v, l]) => (
                <button key={v} onClick={() => setFilter(v)} style={{
                  background: filter === v ? T.accent : "transparent",
                  border: `1px solid ${filter === v ? T.accent : T.border}`,
                  borderRadius: 6, padding: "3px 10px",
                  color: filter === v ? "#fff" : T.textSub,
                  fontSize: 11, cursor: "pointer",
                }}>{l}</button>
              ))}
            </div>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={toggleAll} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 7, padding: "5px 10px", color: T.textSub, fontSize: 11, cursor: "pointer" }}>
                {allSelected ? "Deselect all" : `Select all (${visible.length})`}
              </button>
              {done && (
                <button
                  onClick={sendToLeads}
                  style={{
                    background: T.accent, border: "none", borderRadius: 7, padding: "5px 14px",
                    color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  → Send {selectedIds.size || visible.length} to Leads
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!running && contacts.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: T.textSub }}>
            <span style={{ fontSize: 32 }}>⚡</span>
            <p style={{ fontSize: 14 }}>Paste an intel pack and run the pipeline to find contacts.</p>
          </div>
        )}

        {/* Contact grid */}
        {visible.length > 0 && (
          <div style={{
            flex: 1, overflowY: "auto", padding: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12, alignContent: "start",
          }}>
            {visible.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                checks={c.qualChecks}
                isDark={isDark}
                T={T_local}
                selected={selectedIds.has(c.id)}
                onToggle={() => setSelectedIds((prev) => {
                  const next = new Set(prev);
                  next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                  return next;
                })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
