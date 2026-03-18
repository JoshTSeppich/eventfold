import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../context/AppContext.jsx";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(num, den) {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

function fmt(n) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return `${n}%`;
}

const TITLE_KEYWORDS = [
  "CEO", "CTO", "COO", "CFO", "CISO", "CMO", "CPO",
  "Founder", "Co-Founder",
  "VP", "President",
  "Director",
  "Head",
  "Manager",
  "Lead",
  "Principal",
  "Engineer",
  "Recruiter",
  "Partner",
  "Owner",
];

function extractTitleSegment(title) {
  if (!title) return "Other";
  const t = title.trim();
  for (const kw of TITLE_KEYWORDS) {
    if (t.toLowerCase().includes(kw.toLowerCase())) return kw;
  }
  // Fall back to first word
  const first = t.split(/[\s,/]+/)[0];
  return first || "Other";
}

const SIZE_ORDER = ["1-50", "51-200", "201-500", "501-2000", "2000+", "Unknown"];

function normalizeSize(raw) {
  if (!raw) return "Unknown";
  const n = parseInt(raw, 10);
  if (isNaN(n)) return "Unknown";
  if (n <= 50)   return "1-50";
  if (n <= 200)  return "51-200";
  if (n <= 500)  return "201-500";
  if (n <= 2000) return "501-2000";
  return "2000+";
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDayKey(date) {
  return date.toISOString().slice(0, 10);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, highlight, T }) {
  return (
    <div style={{
      flex: 1,
      background: highlight ? T.greenDim : T.card,
      border: `1px solid ${highlight ? T.green + "55" : T.border}`,
      borderRadius: 10,
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <div style={{
        fontSize: 28,
        fontWeight: 800,
        color: highlight ? T.green : T.text,
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}>
        {label}
      </div>
    </div>
  );
}

function SectionHeader({ title, T }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: T.textMuted,
      marginBottom: 12,
    }}>
      {title}
    </div>
  );
}

function HorizBar({ label, value, pctVal, maxPct, color, subLabel, T }) {
  const barPct = maxPct > 0 ? (pctVal / maxPct) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 90, fontSize: 11, color: T.textSub, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 8, background: T.border, borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${Math.min(100, barPct)}%`,
          background: color,
          borderRadius: 4,
          transition: "width 0.3s",
        }} />
      </div>
      <div style={{ fontSize: 11, color: T.textSub, minWidth: 36, textAlign: "right", flexShrink: 0 }}>
        {fmtPct(pctVal)}
      </div>
      {subLabel && (
        <div style={{ fontSize: 10, color: T.textMuted, minWidth: 36, textAlign: "right", flexShrink: 0 }}>
          {subLabel}
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function AnalyticsView({ T }) {
  const { leads, runs, settings } = useApp();
  const [icpLoading, setIcpLoading] = useState(false);
  const [icpResult,  setIcpResult]  = useState(null);
  const [icpError,   setIcpError]   = useState(null);

  // ── 1. Top stats ────────────────────────────────────────────────────────────

  const topStats = useMemo(() => {
    const total      = leads.length;
    const contacted  = leads.filter(l => ["contacted", "responded", "qualified"].includes(l.outreachStatus)).length;
    const responded  = leads.filter(l => ["responded", "qualified"].includes(l.outreachStatus)).length;
    const qualified  = leads.filter(l => l.outreachStatus === "qualified").length;

    const responseRate     = pct(responded + qualified, contacted);
    const qualRate         = pct(qualified, responded + qualified);

    return { total, contacted, responded, qualified, responseRate, qualRate };
  }, [leads]);

  // ── 2. Pipeline funnel ──────────────────────────────────────────────────────

  const funnel = useMemo(() => {
    const stages = ["new", "contacted", "responded", "qualified", "dead"];
    const counts = {};
    for (const s of stages) counts[s] = 0;
    for (const l of leads) {
      if (counts[l.outreachStatus] !== undefined) counts[l.outreachStatus]++;
    }
    const total = leads.length || 1;
    return stages.map((s, i) => ({
      key:    s,
      count:  counts[s],
      pct:    pct(counts[s], total),
      dropPct: i > 0 && counts[stages[i - 1]] > 0
        ? pct(counts[stages[i - 1]] - counts[s], counts[stages[i - 1]])
        : null,
    }));
  }, [leads]);

  const funnelColors = {
    new:       T.textMuted,
    contacted: T.accent,
    responded: T.amber,
    qualified: T.green,
    dead:      T.red,
  };

  const funnelMax = funnel.reduce((m, s) => Math.max(m, s.pct), 0) || 1;

  // ── 3. Response rate by title segment ───────────────────────────────────────

  const titleSegments = useMemo(() => {
    const map = {};
    for (const l of leads) {
      const seg = extractTitleSegment(l.title);
      if (!map[seg]) map[seg] = { total: 0, responded: 0 };
      map[seg].total++;
      if (["responded", "qualified"].includes(l.outreachStatus)) map[seg].responded++;
    }
    return Object.entries(map)
      .filter(([, v]) => v.total >= 3)
      .map(([label, v]) => ({
        label,
        total: v.total,
        responded: v.responded,
        rate: pct(v.responded, v.total),
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [leads]);

  const titleMax = titleSegments.reduce((m, s) => Math.max(m, s.rate), 0) || 1;

  // ── 4. Response rate by company size ────────────────────────────────────────

  const sizeSegments = useMemo(() => {
    const map = {};
    for (const s of SIZE_ORDER) map[s] = { total: 0, responded: 0 };
    for (const l of leads) {
      const seg = normalizeSize(l.companySize);
      map[seg].total++;
      if (["responded", "qualified"].includes(l.outreachStatus)) map[seg].responded++;
    }
    return SIZE_ORDER
      .map(label => ({
        label,
        total: map[label].total,
        responded: map[label].responded,
        rate: pct(map[label].responded, map[label].total),
      }))
      .filter(s => s.total > 0);
  }, [leads]);

  const sizeMax = sizeSegments.reduce((m, s) => Math.max(m, s.rate), 0) || 1;

  // ── 5. Daily activity (14-day) ──────────────────────────────────────────────

  const dailyActivity = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({ date: d, key: getDayKey(d), count: 0 });
    }

    const dayMap = new Map(days.map(d => [d.key, d]));
    for (const l of leads) {
      if (!l.contactedAt) continue;
      const k = l.contactedAt.slice(0, 10);
      const day = dayMap.get(k);
      if (day) day.count++;
    }

    const todayKey = getDayKey(today);
    const maxCount = days.reduce((m, d) => Math.max(m, d.count), 0) || 1;

    return { days, todayKey, maxCount };
  }, [leads]);

  // ── 6. Intel runs summary ───────────────────────────────────────────────────

  const runsSummary = useMemo(() => {
    const recent = runs.slice(0, 5);
    const totalContacts = runs.reduce((s, r) => s + (r.contacts?.length || r.contactCount || 0), 0);
    const totalEmails   = runs.reduce((s, r) => {
      const contacts = r.contacts || [];
      return s + contacts.filter(c => c.email).length;
    }, 0);
    return { recent, totalContacts, totalEmails };
  }, [runs]);

  // ── Last updated timestamp ──────────────────────────────────────────────────

  const lastUpdated = useMemo(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, []);

  const noLeads = leads.length === 0;

  // ── 7. ICP Refinement ───────────────────────────────────────────────────────

  async function runIcpAnalysis() {
    if (!settings.anthropicKey) {
      setIcpError("Add your Anthropic API key in Settings first.");
      return;
    }
    setIcpLoading(true);
    setIcpError(null);
    setIcpResult(null);
    try {
      const prompt = `You are a B2B sales ICP analyst. Based on the following outreach data, provide actionable ICP refinement recommendations.

Pipeline: ${topStats.total} total leads, ${topStats.contacted} contacted, response rate ${topStats.responseRate}%, qualification rate ${topStats.qualRate}%

Response rate by title:
${titleSegments.map(s => `- ${s.label}: ${s.rate}% (n=${s.total})`).join("\n") || "No data"}

Response rate by company size:
${sizeSegments.map(s => `- ${s.label}: ${s.rate}% (n=${s.total})`).join("\n") || "No data"}

Return ONLY valid JSON:
{
  "summary": "2-sentence overall assessment",
  "bestSegments": ["segment1", "segment2"],
  "avoidSegments": ["segment1"],
  "recommendations": ["actionable rec 1", "actionable rec 2", "actionable rec 3"],
  "suggestedFocus": "one sentence on where to double down"
}`;

      const raw = await invoke("anthropic_chat", {
        apiKey: settings.anthropicKey,
        model: "claude-sonnet-4-6",
        system: "You are a B2B sales analyst. Return only valid JSON.",
        userMessage: prompt,
        maxTokens: 512,
      });
      const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      setIcpResult(JSON.parse(clean));
    } catch (e) {
      setIcpError(String(e));
    } finally {
      setIcpLoading(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minHeight: 0,
      overflow: "hidden",
      background: T.bg,
    }}>
      {/* Sticky header */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Analytics</div>
        <div style={{ fontSize: 11, color: T.textMuted }}>
          Updated {lastUpdated}
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "20px 20px 40px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}>

        {/* ── Section 1: Top stats ── */}
        <div style={{ display: "flex", gap: 12 }}>
          <StatCard T={T} label="Total Leads"       value={fmt(topStats.total)}       highlight={false} />
          <StatCard T={T} label="Contacted"          value={fmt(topStats.contacted)}    highlight={false} />
          <StatCard T={T} label="Response Rate"      value={noLeads ? "—" : fmtPct(topStats.responseRate)}  highlight={topStats.responseRate > 20} />
          <StatCard T={T} label="Qualification Rate" value={noLeads ? "—" : fmtPct(topStats.qualRate)}      highlight={topStats.qualRate > 20} />
        </div>

        {/* ── Section 2: Pipeline funnel ── */}
        <div style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          padding: "18px 20px",
        }}>
          <SectionHeader title="Pipeline Funnel" T={T} />

          {noLeads ? (
            <div style={{ fontSize: 13, color: T.textMuted, textAlign: "center", padding: "20px 0" }}>No data yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {funnel.map((stage, i) => (
                <div key={stage.key}>
                  {/* Drop-off indicator */}
                  {stage.dropPct !== null && stage.dropPct > 0 && (
                    <div style={{
                      fontSize: 10,
                      color: T.red,
                      paddingLeft: 10,
                      marginBottom: 3,
                      marginTop: 1,
                    }}>
                      ↓ {stage.dropPct}% drop
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Stage label */}
                    <div style={{
                      width: 80,
                      fontSize: 11,
                      color: T.textSub,
                      textAlign: "right",
                      flexShrink: 0,
                      textTransform: "capitalize",
                      fontWeight: 500,
                    }}>
                      {stage.key}
                    </div>

                    {/* Bar */}
                    <div style={{
                      flex: 1,
                      height: 10,
                      background: T.border,
                      borderRadius: 5,
                      overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${funnelMax > 0 ? (stage.pct / funnelMax) * 100 : 0}%`,
                        background: funnelColors[stage.key],
                        borderRadius: 5,
                        transition: "width 0.4s",
                      }} />
                    </div>

                    {/* Count + pct */}
                    <div style={{ fontSize: 11, color: T.textSub, minWidth: 60, flexShrink: 0 }}>
                      {fmt(stage.count)} <span style={{ color: T.textMuted }}>({fmtPct(stage.pct)})</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Sections 3 + 4: Two-column ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* ── Section 3: Response rate by title ── */}
          <div style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: "18px 20px",
          }}>
            <SectionHeader title="Response Rate by Title" T={T} />
            {titleSegments.length === 0 ? (
              <div style={{ fontSize: 13, color: T.textMuted, textAlign: "center", padding: "20px 0" }}>No data yet</div>
            ) : (
              <div>
                {titleSegments.map(seg => (
                  <HorizBar
                    key={seg.label}
                    T={T}
                    label={seg.label}
                    value={seg.responded}
                    pctVal={seg.rate}
                    maxPct={titleMax}
                    color={T.accent}
                    subLabel={`n=${seg.total}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Section 4: Response rate by company size ── */}
          <div style={{
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: "18px 20px",
          }}>
            <SectionHeader title="Response Rate by Company Size" T={T} />
            {sizeSegments.length === 0 ? (
              <div style={{ fontSize: 13, color: T.textMuted, textAlign: "center", padding: "20px 0" }}>No data yet</div>
            ) : (
              <div>
                {sizeSegments.map(seg => (
                  <HorizBar
                    key={seg.label}
                    T={T}
                    label={seg.label}
                    value={seg.responded}
                    pctVal={seg.rate}
                    maxPct={sizeMax}
                    color={T.accent}
                    subLabel={`n=${seg.total}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Section 5: Daily activity chart ── */}
        <div style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          padding: "18px 20px",
        }}>
          <SectionHeader title="Daily Outreach (Last 14 Days)" T={T} />
          {noLeads ? (
            <div style={{ fontSize: 13, color: T.textMuted, textAlign: "center", padding: "20px 0" }}>No data yet</div>
          ) : (
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 90 }}>
              {dailyActivity.days.map(day => {
                const isToday   = day.key === dailyActivity.todayKey;
                const barHeight = dailyActivity.maxCount > 0
                  ? Math.max(4, (day.count / dailyActivity.maxCount) * 68)
                  : 4;
                return (
                  <div
                    key={day.key}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 4,
                      height: 90,
                    }}
                    title={`${day.key}: ${day.count} contacted`}
                  >
                    {/* Count label */}
                    <div style={{
                      fontSize: 9,
                      color: day.count > 0 ? T.textSub : "transparent",
                      lineHeight: 1,
                    }}>
                      {day.count > 0 ? day.count : ""}
                    </div>

                    {/* Bar */}
                    <div style={{
                      width: "100%",
                      height: barHeight,
                      borderRadius: "3px 3px 0 0",
                      background: isToday
                        ? T.accent
                        : day.count > 0
                          ? T.accentDim
                          : T.border,
                      boxShadow: isToday ? `0 0 6px ${T.accentGlow}` : "none",
                      transition: "height 0.3s",
                    }} />

                    {/* Day label */}
                    <div style={{
                      fontSize: 9,
                      color: isToday ? T.accent : T.textMuted,
                      fontWeight: isToday ? 700 : 400,
                      lineHeight: 1,
                    }}>
                      {DAY_LABELS[day.date.getDay()]}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Section 6: Intel runs summary ── */}
        <div style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          padding: "18px 20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <SectionHeader title="Intel Runs" T={T} />
            {runs.length > 0 && (
              <div style={{ display: "flex", gap: 16, fontSize: 11, color: T.textSub }}>
                <span>
                  <span style={{ fontWeight: 700, color: T.text }}>{fmt(runsSummary.totalContacts)}</span>
                  {" "}total contacts
                </span>
                <span>
                  <span style={{ fontWeight: 700, color: T.text }}>{fmt(runsSummary.totalEmails)}</span>
                  {" "}emails found
                </span>
              </div>
            )}
          </div>

          {runsSummary.recent.length === 0 ? (
            <div style={{ fontSize: 13, color: T.textMuted, textAlign: "center", padding: "20px 0" }}>No runs yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {/* Header row */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 80px 80px",
                padding: "4px 10px",
                fontSize: 10,
                fontWeight: 700,
                color: T.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                <span>Date</span>
                <span style={{ textAlign: "right" }}>Contacts</span>
                <span style={{ textAlign: "right" }}>Emails</span>
                <span style={{ textAlign: "center" }}>Mode</span>
              </div>

              {runsSummary.recent.map((run, i) => {
                const contacts = run.contacts || [];
                const contactCount = contacts.length || run.contactCount || 0;
                const emailCount   = contacts.filter(c => c.email).length || run.emailCount || 0;
                const savedAt = run.savedAt
                  ? new Date(run.savedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                  : "—";
                const mode = run.mode || "standard";

                return (
                  <div
                    key={run.id || i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 80px 80px 80px",
                      padding: "8px 10px",
                      borderRadius: 7,
                      background: i % 2 === 0 ? "transparent" : T.surface,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 12, color: T.text }}>{savedAt}</span>
                    <span style={{ fontSize: 12, color: T.textSub, textAlign: "right" }}>{fmt(contactCount)}</span>
                    <span style={{ fontSize: 12, color: T.textSub, textAlign: "right" }}>{fmt(emailCount)}</span>
                    <span style={{ textAlign: "center" }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 5,
                        background: mode === "fast" ? T.amberDim : T.accentGlow,
                        color:      mode === "fast" ? T.amber   : T.accent,
                        textTransform: "capitalize",
                      }}>
                        {mode}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Section 7: ICP Refinement Wizard ── */}
        <div style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          padding: "18px 20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: icpResult ? 16 : 0 }}>
            <div>
              <SectionHeader title="ICP Refinement" T={T} />
              {!icpResult && !icpLoading && (
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: -8 }}>
                  Let Claude analyze your response patterns and suggest ICP improvements.
                </div>
              )}
            </div>
            <button
              onClick={runIcpAnalysis}
              disabled={icpLoading || noLeads}
              style={{
                padding: "7px 16px", borderRadius: 8,
                border: "none",
                background: icpLoading || noLeads ? T.border : T.accent,
                color: icpLoading || noLeads ? T.textMuted : "#fff",
                fontSize: 12, fontWeight: 700,
                cursor: icpLoading || noLeads ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 6,
                flexShrink: 0,
                transition: "background 0.15s",
              }}
            >
              {icpLoading ? (
                <>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                  Analyzing…
                </>
              ) : (
                <>✦ {icpResult ? "Re-analyze" : "Analyze ICP"}</>
              )}
            </button>
          </div>

          {icpError && (
            <div style={{ padding: "10px 12px", background: T.redDim, border: `1px solid ${T.red}44`, borderRadius: 8, fontSize: 12, color: T.red, marginTop: 8 }}>
              {icpError}
            </div>
          )}

          {icpResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Summary */}
              <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.6, padding: "10px 14px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }}>
                {icpResult.summary}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {/* Best segments */}
                {icpResult.bestSegments?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      Double down on
                    </div>
                    {icpResult.bestSegments.map((s, i) => (
                      <div key={i} style={{ fontSize: 12, color: T.textSub, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: T.green, fontSize: 11 }}>✓</span> {s}
                      </div>
                    ))}
                  </div>
                )}

                {/* Avoid segments */}
                {icpResult.avoidSegments?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.red, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      Deprioritize
                    </div>
                    {icpResult.avoidSegments.map((s, i) => (
                      <div key={i} style={{ fontSize: 12, color: T.textSub, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: T.red, fontSize: 11 }}>✗</span> {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recommendations */}
              {icpResult.recommendations?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Recommendations
                  </div>
                  {icpResult.recommendations.map((r, i) => (
                    <div key={i} style={{ fontSize: 12, color: T.textSub, marginBottom: 6, display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ color: T.accent, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span> {r}
                    </div>
                  ))}
                </div>
              )}

              {/* Suggested focus */}
              {icpResult.suggestedFocus && (
                <div style={{ padding: "10px 14px", background: T.accentGlow, border: `1px solid ${T.accentDim}`, borderRadius: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>Focus: </span>
                  <span style={{ fontSize: 12, color: T.textSub }}>{icpResult.suggestedFocus}</span>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
