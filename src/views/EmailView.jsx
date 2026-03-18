import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../context/AppContext.jsx";
import { fillTemplate } from "../data/defaultTemplates.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const TONES = [
  { id: "professional", label: "Professional", desc: "Formal, polished, business-ready" },
  { id: "friendly",     label: "Friendly",     desc: "Warm, personable, approachable" },
  { id: "direct",       label: "Direct",       desc: "Short, punchy, respects their time" },
  { id: "curious",      label: "Curious",      desc: "Question-led, genuine interest" },
];

const GOALS = [
  { id: "intro",    label: "Cold intro",      desc: "First touch, get on their radar" },
  { id: "demo",     label: "Book a demo",     desc: "Get them to schedule a call" },
  { id: "followup", label: "Follow-up",       desc: "Nudge after no response" },
  { id: "reply",    label: "Reply to reply",  desc: "Continue an existing thread" },
  { id: "referral", label: "Ask for referral",desc: "Get an intro to someone else" },
];

const HAIKU  = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";

function buildPrompt({ lead, tone, goal, context, template, senderName }) {
  const toneLabel = TONES.find(t => t.id === tone)?.label || tone;
  const goalLabel = GOALS.find(g => g.id === goal)?.label || goal;

  const templateHint = template
    ? `\n\nThe user has selected this email template as a reference/starting point:\n---\nSubject: ${template.subject}\n\n${template.body}\n---\nAdapt and improve it for this specific lead — don't copy verbatim.`
    : "";

  const contextSection = context?.trim()
    ? `\n\nAdditional context from the sender:\n${context.trim()}`
    : "";

  return `You are an expert B2B sales email writer. Write a ${toneLabel.toLowerCase()} cold outreach email for the goal: "${goalLabel}".

Lead details:
- Name: ${lead.name}
- Title: ${lead.title || "Unknown"}
- Company: ${lead.company}
- Hook / Angle: ${lead.hook || "None provided"}
- Fit Score: ${lead.fitScore ? `${lead.fitScore}%` : "Unknown"}

Sender: ${senderName || "the sender"}
${contextSection}${templateHint}

Output a JSON object with exactly these fields:
{
  "subject": "email subject line",
  "body": "full email body (plain text, no markdown, ~80-120 words, include greeting and sign-off placeholder)"
}

Rules:
- Subject: specific, ≤8 words, not spammy
- First line: about THEM, not you
- Reference their hook/angle if available
- No generic filler like "I hope this finds you well"
- End with a single, clear CTA
- Sign-off: "Best,\\n{{senderName}}"

Return only the JSON, no extra text.`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmailView({ T }) {
  const { leads, templates, settings, drafts, saveDraft, clearDraft, updateLead } = useApp();

  const [selectedLeadId, setSelectedLeadId]   = useState("");
  const [tone,           setTone]             = useState("professional");
  const [goal,           setGoal]             = useState("intro");
  const [context,        setContext]          = useState("");
  const [selectedTplId,  setSelectedTplId]    = useState("");
  const [draft,          setDraft]            = useState(null);
  const [editedSubject,  setEditedSubject]    = useState("");
  const [editedBody,     setEditedBody]       = useState("");
  const [generating,     setGenerating]       = useState(false);
  const [error,          setError]            = useState(null);
  const [copiedField,    setCopiedField]      = useState(null);
  const [model,          setModel]            = useState("sonnet");
  const [markedSent,     setMarkedSent]       = useState(false);
  const copyTimer = useRef(null);

  const activeLead = leads.find(l => l.id === selectedLeadId) || null;
  const activeTemplate = templates.find(t => t.id === selectedTplId) || null;

  // ── Restore persisted draft when lead changes ──────────────────────────────
  const onLeadChange = (leadId) => {
    setSelectedLeadId(leadId);
    setMarkedSent(false);
    const saved = drafts[leadId];
    if (saved) {
      setDraft({ subject: saved.subject, body: saved.body });
      setEditedSubject(saved.subject || "");
      setEditedBody(saved.body || "");
      if (saved.tone) setTone(saved.tone);
      if (saved.goal) setGoal(saved.goal);
    } else {
      setDraft(null);
      setEditedSubject("");
      setEditedBody("");
    }
  };

  // ── Persist draft whenever edited ────────────────────────────────────────────
  const persistDraft = (subject, body) => {
    if (selectedLeadId && (subject || body)) {
      saveDraft(selectedLeadId, { subject, body, tone, goal });
    }
  };

  const handleGenerate = async () => {
    if (!activeLead) return;
    if (!settings.anthropicKey) {
      setError("Add your Anthropic API key in Settings first.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const raw = await invoke("anthropic_chat", {
        apiKey:     settings.anthropicKey,
        model:      model === "haiku" ? HAIKU : SONNET,
        system:     "You are a world-class B2B cold email copywriter. Always respond with valid JSON only.",
        userMessage: buildPrompt({
          lead:       activeLead,
          tone,
          goal,
          context,
          template:   activeTemplate,
          senderName: settings.senderName,
        }),
        maxTokens: 512,
      });
      const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(clean);
      const filledBody = (parsed.body || "").replace(/\{\{senderName\}\}/g, settings.senderName || "{{senderName}}");
      setDraft(parsed);
      setEditedSubject(parsed.subject || "");
      setEditedBody(filledBody);
      // Auto-persist new draft
      saveDraft(selectedLeadId, { subject: parsed.subject || "", body: filledBody, tone, goal });
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const copy = (text, field) => {
    navigator.clipboard.writeText(text).then(() => {
      clearTimeout(copyTimer.current);
      setCopiedField(field);
      copyTimer.current = setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const openMailto = () => {
    if (!activeLead?.email) return;
    const to      = encodeURIComponent(activeLead.email);
    const subject = encodeURIComponent(editedSubject);
    const body    = encodeURIComponent(editedBody);
    invoke("open_url", { url: `mailto:${to}?subject=${subject}&body=${body}` });
    // Auto-mark as contacted if still new
    if (activeLead.outreachStatus === "new") {
      updateLead(activeLead.id, l => ({
        ...l,
        outreachStatus: "contacted",
        contactedAt:    l.contactedAt || new Date().toISOString(),
        notes: [...(l.notes || []), { id: crypto.randomUUID(), body: `Email sent: "${editedSubject}"`, source: "system", createdAt: new Date().toISOString() }],
      }));
    }
    setMarkedSent(true);
  };

  const inputStyle = {
    width: "100%", padding: "9px 11px",
    background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: 8, color: T.text, fontSize: 13,
    outline: "none", fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const chipBase = {
    padding: "6px 12px", borderRadius: 8,
    fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: "1px solid transparent",
    transition: "all 0.12s",
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* ── Left panel: controls ── */}
      <div style={{
        width: 320, flexShrink: 0,
        borderRight: `1px solid ${T.border}`,
        background: T.surface,
        display: "flex", flexDirection: "column",
        overflow: "auto",
        padding: "20px 18px",
        gap: 18,
      }}>

        {/* Lead picker */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
            Lead
          </div>
          <select
            value={selectedLeadId}
            onChange={e => onLeadChange(e.target.value)}
            style={{ ...inputStyle }}
          >
            <option value="">Select a lead with email…</option>
            {(() => {
              const STATUS_ORDER = { new: 0, contacted: 1, responded: 2, qualified: 3, dead: 4 };
              const emailLeads = leads
                .filter(l => l.email)
                .sort((a, b) => {
                  const so = (STATUS_ORDER[a.outreachStatus] ?? 5) - (STATUS_ORDER[b.outreachStatus] ?? 5);
                  if (so !== 0) return so;
                  return a.name.localeCompare(b.name);
                });
              const STATUS_PREFIX = { new: "● ", contacted: "→ ", responded: "↩ ", qualified: "★ ", dead: "✗ " };
              return emailLeads.map(l => (
                <option key={l.id} value={l.id}>
                  {STATUS_PREFIX[l.outreachStatus] || ""}{l.name} — {l.company}
                </option>
              ));
            })()}
          </select>
          {activeLead && (
            <div style={{ marginTop: 8, padding: "8px 10px", background: T.card, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{activeLead.name}</div>
              <div style={{ fontSize: 11, color: T.textSub }}>{activeLead.title} · {activeLead.company}</div>
              {activeLead.hook && (
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, fontStyle: "italic" }}>"{activeLead.hook}"</div>
              )}
            </div>
          )}
        </div>

        {/* Tone */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
            Tone
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TONES.map(t => (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                title={t.desc}
                style={{
                  ...chipBase,
                  background: tone === t.id ? T.accent : "transparent",
                  borderColor: tone === t.id ? T.accent : T.border,
                  color: tone === t.id ? "#fff" : T.textSub,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Goal */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
            Goal
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {GOALS.map(g => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                title={g.desc}
                style={{
                  ...chipBase,
                  background: goal === g.id ? T.accent : "transparent",
                  borderColor: goal === g.id ? T.accent : T.border,
                  color: goal === g.id ? "#fff" : T.textSub,
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Template reference */}
        {templates.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
              Template Reference <span style={{ fontSize: 10, fontWeight: 400, color: T.textMuted }}>(optional)</span>
            </div>
            <select
              value={selectedTplId}
              onChange={e => setSelectedTplId(e.target.value)}
              style={{ ...inputStyle }}
            >
              <option value="">None — generate from scratch</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Extra context */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
            Context <span style={{ fontSize: 10, fontWeight: 400, color: T.textMuted }}>(optional)</span>
          </div>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value.slice(0, 500))}
            placeholder="Add any extra context: recent news, shared connection, event you both attended…"
            style={{
              ...inputStyle,
              minHeight: 80, resize: "vertical",
              lineHeight: 1.55,
            }}
          />
        </div>

        {/* Model toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: T.textMuted }}>Model</span>
          <div style={{ display: "flex", gap: 4 }}>
            {["haiku", "sonnet"].map(m => (
              <button
                key={m}
                onClick={() => setModel(m)}
                style={{
                  ...chipBase,
                  padding: "4px 10px", fontSize: 11,
                  background: model === m ? T.accentDim : "transparent",
                  borderColor: model === m ? T.accent : T.border,
                  color: model === m ? T.accent : T.textMuted,
                }}
              >
                {m === "haiku" ? "⚡ Haiku" : "✦ Sonnet"}
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!activeLead || generating}
          style={{
            width: "100%", padding: "11px 0",
            borderRadius: 10, border: "none",
            background: T.accent, color: "#fff",
            fontSize: 14, fontWeight: 700,
            opacity: (!activeLead || generating) ? 0.45 : 1,
            cursor: (!activeLead || generating) ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "opacity 0.15s",
          }}
        >
          {generating ? (
            <>
              <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
              Writing…
            </>
          ) : draft ? "Regenerate" : "Write Email"}
        </button>

        {error && (
          <div style={{ padding: "10px 12px", background: T.redDim, border: `1px solid ${T.red}44`, borderRadius: 10, fontSize: 12, color: T.red }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Right panel: draft ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg }}>
        {!draft ? (
          /* Empty state */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: T.textMuted, textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 44, marginBottom: 16, opacity: 0.12 }}>✉</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub, marginBottom: 8 }}>AI Email Drafting</div>
            <div style={{ fontSize: 13, color: T.textMuted, maxWidth: 360, lineHeight: 1.7 }}>
              Pick a lead, set the tone and goal, then click <strong style={{ color: T.textSub }}>Write Email</strong>.<br /><br />
              Claude will craft a personalised cold email based on the lead's hook and your intent.
            </div>
          </div>
        ) : (
          /* Draft editor */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Toolbar */}
            <div style={{
              padding: "12px 20px",
              borderBottom: `1px solid ${T.border}`,
              background: T.surface,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                  Draft for <span style={{ color: T.accent }}>{activeLead?.name}</span>
                </div>
                {markedSent && (
                  <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: T.greenDim, color: T.green, fontWeight: 700 }}>
                    ✓ Marked contacted
                  </span>
                )}
                {drafts[selectedLeadId] && !markedSent && (
                  <span style={{ fontSize: 10, color: T.textMuted }}>
                    Draft saved {new Date(drafts[selectedLeadId].updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    setDraft(null);
                    setEditedSubject("");
                    setEditedBody("");
                    if (selectedLeadId) clearDraft(selectedLeadId);
                    setMarkedSent(false);
                  }}
                  style={{
                    padding: "7px 12px", borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: "transparent",
                    color: T.textMuted,
                    fontSize: 12, cursor: "pointer",
                  }}
                  title="Clear draft"
                >
                  ✕ Clear
                </button>
                <button
                  onClick={() => copy(editedSubject + "\n\n" + editedBody, "all")}
                  style={{
                    padding: "7px 14px", borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    background: copiedField === "all" ? T.greenDim : "transparent",
                    color: copiedField === "all" ? T.green : T.textSub,
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {copiedField === "all" ? "Copied ✓" : "Copy all"}
                </button>
                {activeLead?.email && (
                  <button
                    onClick={openMailto}
                    style={{
                      padding: "7px 14px", borderRadius: 8,
                      border: "none", background: T.accent,
                      color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    Open in Mail →
                  </button>
                )}
              </div>
            </div>

            {/* Subject */}
            <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Subject
                </label>
                <button
                  onClick={() => copy(editedSubject, "subject")}
                  style={{ fontSize: 11, color: copiedField === "subject" ? T.green : T.textMuted, background: "none", border: "none", cursor: "pointer" }}
                >
                  {copiedField === "subject" ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <input
                value={editedSubject}
                onChange={e => { setEditedSubject(e.target.value); persistDraft(e.target.value, editedBody); }}
                style={{
                  width: "100%", padding: "9px 11px",
                  background: T.card, border: `1px solid ${T.border}`,
                  borderRadius: 8, color: T.text, fontSize: 14, fontWeight: 600,
                  outline: "none", fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Body */}
            <div style={{ flex: 1, padding: "14px 20px 20px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexShrink: 0 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Body
                </label>
                <button
                  onClick={() => copy(editedBody, "body")}
                  style={{ fontSize: 11, color: copiedField === "body" ? T.green : T.textMuted, background: "none", border: "none", cursor: "pointer" }}
                >
                  {copiedField === "body" ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <textarea
                value={editedBody}
                onChange={e => { setEditedBody(e.target.value); persistDraft(editedSubject, e.target.value); }}
                style={{
                  flex: 1, padding: "12px 14px",
                  background: T.card, border: `1px solid ${T.border}`,
                  borderRadius: 10, color: T.text, fontSize: 13,
                  fontFamily: "inherit", lineHeight: 1.65,
                  outline: "none", resize: "none",
                }}
              />
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexShrink: 0 }}>
                {(() => {
                  const wc = editedBody.trim().split(/\s+/).filter(Boolean).length;
                  const wcColor = wc === 0 ? T.textMuted : wc < 40 ? T.amber : wc > 150 ? T.amber : T.green;
                  const wcHint = wc === 0 ? "" : wc < 40 ? " (too short)" : wc > 150 ? " (too long)" : " ✓";
                  return (
                    <span style={{ fontSize: 11, color: wcColor }}>
                      {wc} words{wcHint}
                    </span>
                  );
                })()}
                {activeLead?.fitScore && (
                  <span style={{ fontSize: 11, color: T.textMuted }}>
                    · {activeLead.fitScore}% fit score
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
