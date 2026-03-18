import { useState } from "react";
import { OutreachStatusPill }    from "./OutreachStatusPill.jsx";
import { EmailStatusPill }       from "./EmailStatusPill.jsx";
import { StatusPickerPopover }   from "./StatusPickerPopover.jsx";
import { TemplatePickerPopover } from "./TemplatePickerPopover.jsx";
import { generateMailtoUrl }     from "../../utils/generateMailto.js";
import { fullDate, relativeTime } from "../../utils/relativeTime.js";
import { useApp }                from "../../context/AppContext.jsx";

function Avatar({ name, size = 44, isDark }) {
  const initials = name
    ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const hue = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `hsl(${hue},55%,${isDark ? "28%" : "75%"})`,
      color: `hsl(${hue},55%,${isDark ? "85%" : "25%"})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function NoteItem({ note, isDark }) {
  const sub = isDark ? "#475569" : "#94a3b8";
  const txt = isDark ? "#94a3b8" : "#64748b";

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: isDark ? "#334155" : "#e2e8f0", marginTop: 6, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 12, color: txt }}>{note.body}</div>
        <div style={{ fontSize: 10, color: sub, marginTop: 2 }}>{fullDate(note.createdAt)}</div>
      </div>
    </div>
  );
}

export function LeadDetailPanel({ lead, isDark, onStatusUpdate, onClose }) {
  const [showStatusPicker, setShowStatusPicker]   = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [noteText, setNoteText]                   = useState("");
  const [addingNote, setAddingNote]               = useState(false);
  const [copiedEmail, setCopiedEmail]             = useState(false);
  const [selectedTemplate, setSelectedTemplate]   = useState(null);

  const { templates: ctxTemplates, deleteLead } = useApp();
  const templates = ctxTemplates;
  const bg        = isDark ? "#0f172a" : "#ffffff";
  const border    = isDark ? "#1e293b" : "#f1f5f9";
  const txt       = isDark ? "#e2e8f0" : "#0f172a";
  const sub       = isDark ? "#94a3b8" : "#64748b";
  const muted     = isDark ? "#475569" : "#94a3b8";
  const card      = isDark ? "#1e293b" : "#f8fafc";
  const accent    = isDark ? "#3b82f6" : "#2563eb";
  const accentDim = isDark ? "#1a4a94" : "#e0e7ff";

  function copyEmail() {
    if (!lead.email) return;
    navigator.clipboard.writeText(lead.email).catch(() => {});
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  }

  function openMailto(tpl) {
    const t = tpl || selectedTemplate || templates[0];
    const url = generateMailtoUrl(lead, t);
    if (!url) return;
    // Use Tauri if available, fallback to window.open
    try {
      const { invoke } = window.__TAURI__?.core || {};
      invoke ? invoke("open_url", { url }) : window.open(url);
    } catch {
      window.open(url);
    }
    // Auto-prompt to mark as contacted if still new
    if (lead.outreachStatus === "new") {
      onStatusUpdate(lead.id, "contacted");
    }
  }

  function addNote() {
    if (!noteText.trim()) return;
    onStatusUpdate(lead.id, lead.outreachStatus, undefined, noteText.trim());
    setNoteText("");
    setAddingNote(false);
  }

  const sortedNotes = [...(lead.notes || [])].reverse();
  const labelStyle = {
    fontSize: 10, fontWeight: 600, color: muted,
    textTransform: "uppercase", letterSpacing: "0.06em",
    marginBottom: 4, display: "block",
  };

  return (
    <div style={{
      width: 300, flexShrink: 0,
      background: bg,
      borderLeft: `1px solid ${border}`,
      display: "flex", flexDirection: "column",
      overflowY: "auto",
      position: "relative",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 16px 14px",
        borderBottom: `1px solid ${border}`,
        position: "sticky", top: 0, background: bg, zIndex: 5,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {lead.photoUrl
            ? <img src={lead.photoUrl} alt={lead.name} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={e => { e.target.style.display = "none"; }} />
            : <Avatar name={lead.name} isDark={isDark} />
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: txt, lineHeight: 1.3 }}>{lead.name}</div>
            <div style={{ fontSize: 12, color: sub, marginTop: 3, lineHeight: 1.4 }}>
              {lead.title}{lead.title && lead.company ? " · " : ""}{lead.company}
            </div>
            {lead.source === "intel" && (
              <div style={{ fontSize: 10, color: accent, background: accentDim, padding: "2px 7px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                ◎ Via Intel{lead.runId ? ` · ${new Date(parseInt(lead.runId.replace("run-", ""))).toLocaleDateString()}` : ""}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 18, lineHeight: 1, marginTop: -2 }}
          >×</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Status section */}
        <div>
          <label style={labelStyle}>Status</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <OutreachStatusPill
                status={lead.outreachStatus}
                contactedAt={lead.contactedAt}
                isDark={isDark}
                size="md"
                onClick={() => setShowStatusPicker((p) => !p)}
              />
              {showStatusPicker && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200 }}>
                  <StatusPickerPopover
                    currentStatus={lead.outreachStatus}
                    isDark={isDark}
                    anchorRef={{ current: null }}
                    onSelect={(status, reason) => {
                      onStatusUpdate(lead.id, status, reason);
                      setShowStatusPicker(false);
                    }}
                    onClose={() => setShowStatusPicker(false)}
                  />
                </div>
              )}
            </div>
            <EmailStatusPill status={lead.emailStatus} isDark={isDark} size="md" />
            {lead.fitScore != null && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: lead.fitScore >= 80 ? (isDark ? "#86efac" : "#15803d") : sub,
                background: lead.fitScore >= 80 ? (isDark ? "#052e16" : "#ecfdf5") : card,
                padding: "2px 8px", borderRadius: 9999,
              }}>
                {lead.fitScore}% fit
              </span>
            )}
          </div>
        </div>

        {/* Email + Actions */}
        {lead.email && (
          <div>
            <label style={labelStyle}>Email</label>
            <div style={{
              background: card, borderRadius: 8,
              border: `1px solid ${border}`,
              padding: "8px 12px",
            }}>
              <div style={{ fontSize: 13, color: txt, marginBottom: 8, wordBreak: "break-all" }}>
                {lead.email}
              </div>
              <div style={{ display: "flex", gap: 6, position: "relative" }}>
                <button
                  onClick={copyEmail}
                  style={{
                    flex: 1, padding: "6px 0",
                    background: "transparent",
                    border: `1px solid ${border}`,
                    borderRadius: 6, color: copiedEmail ? "#16a34a" : sub,
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {copiedEmail ? "✓ Copied" : "Copy"}
                </button>
                <button
                  onClick={() => openMailto()}
                  style={{
                    flex: 1, padding: "6px 0",
                    background: accent, border: "none",
                    borderRadius: 6, color: "#fff",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Open in Mail ↗
                </button>
                <button
                  onClick={() => setShowTemplatePicker((p) => !p)}
                  style={{
                    padding: "6px 8px",
                    background: "transparent",
                    border: `1px solid ${border}`,
                    borderRadius: 6, color: sub,
                    fontSize: 11, cursor: "pointer",
                  }}
                  title="Pick template"
                >▾</button>

                {showTemplatePicker && (
                  <TemplatePickerPopover
                    templates={templates}
                    lead={lead}
                    isDark={isDark}
                    onSelect={(tpl) => { setSelectedTemplate(tpl); openMailto(tpl); }}
                    onClose={() => setShowTemplatePicker(false)}
                  />
                )}
              </div>
              {selectedTemplate && (
                <div style={{ fontSize: 10, color: muted, marginTop: 6 }}>
                  Template: {selectedTemplate.name}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hook */}
        {lead.hook && (
          <div>
            <label style={labelStyle}>Hook</label>
            <div style={{
              background: card, borderRadius: 8,
              border: `1px solid ${border}`,
              padding: "8px 12px",
              fontSize: 12, color: sub, lineHeight: 1.5,
              fontStyle: "italic",
            }}>
              "{lead.hook}"
            </div>
          </div>
        )}

        {/* Company */}
        {(lead.industry || lead.companySize || lead.location || lead.companyDomain) && (
          <div>
            <label style={labelStyle}>Company</label>
            <div style={{ background: card, borderRadius: 8, border: `1px solid ${border}`, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
              {lead.industry && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: muted }}>Industry</span>
                  <span style={{ fontSize: 12, color: sub }}>{lead.industry}</span>
                </div>
              )}
              {lead.companySize && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: muted }}>Size</span>
                  <span style={{ fontSize: 12, color: sub }}>{typeof lead.companySize === "number" ? lead.companySize.toLocaleString() + " employees" : lead.companySize}</span>
                </div>
              )}
              {lead.location && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: muted }}>Location</span>
                  <span style={{ fontSize: 12, color: sub }}>{lead.location}</span>
                </div>
              )}
              {lead.companyDomain && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: muted }}>Domain</span>
                  <span style={{ fontSize: 12, color: sub }}>{lead.companyDomain}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Qualification Checks */}
        {lead.qualChecks?.length > 0 && (
          <div>
            <label style={labelStyle}>Qualification Checks</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {lead.qualChecks.map((chk, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1, color: chk.passed === true ? (isDark ? "#4ade80" : "#16a34a") : chk.passed === false ? (isDark ? "#f87171" : "#dc2626") : muted }}>
                    {chk.passed === true ? "✓" : chk.passed === false ? "✗" : "·"}
                  </span>
                  <div>
                    <div style={{ fontSize: 11, color: txt }}>{chk.criterion}</div>
                    {chk.note && <div style={{ fontSize: 10, color: muted }}>{chk.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LinkedIn */}
        {lead.linkedinUrl && (
          <div>
            <label style={labelStyle}>LinkedIn</label>
            <button
              onClick={() => {
                try { window.__TAURI__?.core?.invoke("open_url", { url: lead.linkedinUrl }); }
                catch { window.open(lead.linkedinUrl); }
              }}
              style={{
                background: "transparent", border: `1px solid ${border}`,
                borderRadius: 7, padding: "6px 12px",
                color: sub, fontSize: 12, cursor: "pointer",
              }}
            >
              View Profile ↗
            </button>
          </div>
        )}

        {/* Add Note */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Notes</label>
            <button
              onClick={() => setAddingNote((p) => !p)}
              style={{ background: "none", border: "none", color: accent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >+ Add</button>
          </div>

          {addingNote && (
            <div style={{ marginBottom: 10 }}>
              <textarea
                autoFocus
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note…"
                rows={3}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "8px 10px",
                  background: isDark ? "#0a0f1a" : "#ffffff",
                  border: `1px solid ${border}`,
                  borderRadius: 7, color: txt, fontSize: 12,
                  resize: "none", outline: "none", fontFamily: "inherit",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote();
                  if (e.key === "Escape") setAddingNote(false);
                }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button
                  onClick={() => setAddingNote(false)}
                  style={{ flex: 1, padding: "5px 0", background: "transparent", border: `1px solid ${border}`, borderRadius: 6, color: sub, fontSize: 11, cursor: "pointer" }}
                >Cancel</button>
                <button
                  onClick={addNote}
                  style={{ flex: 1, padding: "5px 0", background: accent, border: "none", borderRadius: 6, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                >Save ⌘↵</button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sortedNotes.length === 0 && !addingNote && (
              <span style={{ fontSize: 12, color: muted }}>No history yet.</span>
            )}
            {sortedNotes.map((n) => (
              <NoteItem key={n.id} note={n} isDark={isDark} />
            ))}
          </div>
        </div>
      </div>

      {/* Delete lead */}
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${border}`, marginTop: "auto" }}>
        <button
          onClick={() => { if (window.confirm(`Delete ${lead.name}? This cannot be undone.`)) { deleteLead(lead.id); onClose(); } }}
          style={{ fontSize: 11, color: muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onMouseEnter={e => e.target.style.color = isDark ? "#f87171" : "#dc2626"}
          onMouseLeave={e => e.target.style.color = muted}
        >
          Delete lead
        </button>
      </div>
    </div>
  );
}
