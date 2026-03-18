import { useState, useRef, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";

const FAKE_LEAD = { firstName: "Sarah", fullName: "Sarah Chen", company: "Acme", hook: "growing fast in the enterprise space", title: "VP of Sales" };

function fillPreview(body, lead) {
  if (!body) return "";
  return body
    .replace(/\{\{firstName\}\}/g, lead.firstName)
    .replace(/\{\{fullName\}\}/g, lead.fullName)
    .replace(/\{\{company\}\}/g, lead.company)
    .replace(/\{\{hook\}\}/g, lead.hook)
    .replace(/\{\{title\}\}/g, lead.title);
}

export function TemplateManager({ T, onClose }) {
  const { templates, setTemplates, isDark } = useApp();

  const [selectedId, setSelectedId] = useState(templates[0]?.id || null);
  const [editName,    setEditName]   = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBody,    setEditBody]   = useState("");
  const [savedMsg,    setSavedMsg]   = useState(false);
  const bodyRef = useRef(null);

  const bg     = isDark ? "#0f172a" : "#ffffff";
  const panel  = isDark ? "#1e293b" : "#f8fafc";
  const border = isDark ? "#1e293b" : "#e2e8f0";
  const txt    = isDark ? "#e2e8f0" : "#0f172a";
  const sub    = isDark ? "#94a3b8" : "#64748b";
  const muted  = isDark ? "#475569" : "#94a3b8";
  const accent = isDark ? "#3b82f6" : "#2563eb";
  const card   = isDark ? "#0f172a" : "#ffffff";

  const selected = templates.find((t) => t.id === selectedId) || null;

  // Sync editor when selection changes
  useEffect(() => {
    if (selected) {
      setEditName(selected.name || "");
      setEditSubject(selected.subject || "");
      setEditBody(selected.body || "");
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectTemplate(id) {
    setSelectedId(id);
    setSavedMsg(false);
  }

  function handleNew() {
    const newTpl = {
      id:      `tpl-${Date.now()}`,
      name:    "New Template",
      subject: "",
      body:    "",
    };
    setTemplates((prev) => [...prev, newTpl]);
    setSelectedId(newTpl.id);
    setEditName(newTpl.name);
    setEditSubject(newTpl.subject);
    setEditBody(newTpl.body);
    setSavedMsg(false);
  }

  function handleDelete(id) {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    if (!window.confirm(`Delete template "${tpl.name}"? This cannot be undone.`)) return;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (selectedId === id) {
      const remaining = templates.filter((t) => t.id !== id);
      setSelectedId(remaining[0]?.id || null);
    }
  }

  function handleSave() {
    if (!selectedId) return;
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === selectedId
          ? { ...t, name: editName, subject: editSubject, body: editBody }
          : t
      )
    );
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  }

  function insertVariable(variable) {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const before = editBody.slice(0, start);
    const after  = editBody.slice(end);
    const next   = before + variable + after;
    setEditBody(next);
    // Restore cursor after inserted text
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  }

  const VARS = ["{{firstName}}", "{{fullName}}", "{{company}}", "{{hook}}", "{{title}}"];

  const labelStyle = {
    fontSize: 10, fontWeight: 600, color: muted,
    textTransform: "uppercase", letterSpacing: "0.06em",
    marginBottom: 4, display: "block",
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    padding: "7px 10px",
    background: isDark ? "#0a0f1a" : "#ffffff",
    border: `1px solid ${border}`,
    borderRadius: 6, color: txt, fontSize: 13,
    outline: "none", fontFamily: "inherit",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 640, maxHeight: "80vh",
        background: bg,
        borderRadius: 12,
        border: `1px solid ${border}`,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: txt }}>Email Templates</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={handleNew}
              style={{
                padding: "5px 14px", background: accent, border: "none",
                borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 600,
                cursor: "pointer",
              }}
            >New Template</button>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 20, lineHeight: 1 }}
            >×</button>
          </div>
        </div>

        {/* Body: split layout */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left: template list */}
          <div style={{
            width: 220, flexShrink: 0,
            borderRight: `1px solid ${border}`,
            overflowY: "auto",
            padding: "8px 0",
          }}>
            {templates.length === 0 && (
              <div style={{ padding: "12px 16px", fontSize: 12, color: muted }}>No templates yet.</div>
            )}
            {templates.map((tpl) => {
              const isActive = tpl.id === selectedId;
              return (
                <ListItem
                  key={tpl.id}
                  tpl={tpl}
                  isActive={isActive}
                  isDark={isDark}
                  txt={txt}
                  sub={sub}
                  muted={muted}
                  accent={accent}
                  panel={panel}
                  onSelect={() => selectTemplate(tpl.id)}
                  onDelete={() => handleDelete(tpl.id)}
                />
              );
            })}
          </div>

          {/* Right: editor */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
            {!selected ? (
              <div style={{ fontSize: 13, color: muted, marginTop: 20 }}>Select a template or create a new one.</div>
            ) : (
              <>
                {/* Name */}
                <div>
                  <label style={labelStyle}>Template Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={inputStyle}
                    placeholder="e.g. Intro outreach"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label style={labelStyle}>Subject Line</label>
                  <input
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    style={inputStyle}
                    placeholder="e.g. Quick question for {{firstName}}"
                  />
                </div>

                {/* Variable chips */}
                <div>
                  <label style={labelStyle}>Insert Variable</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {VARS.map((v) => (
                      <button
                        key={v}
                        onClick={() => insertVariable(v)}
                        style={{
                          padding: "3px 9px",
                          background: isDark ? "#1e293b" : "#f1f5f9",
                          border: `1px solid ${border}`,
                          borderRadius: 5, color: accent,
                          fontSize: 11, fontFamily: "monospace",
                          cursor: "pointer",
                        }}
                      >{v}</button>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div>
                  <label style={labelStyle}>Body</label>
                  <textarea
                    ref={bodyRef}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={12}
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                      lineHeight: 1.6,
                    }}
                    placeholder={"Hi {{firstName}},\n\nI noticed {{company}} is…"}
                  />
                </div>

                {/* Save */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={handleSave}
                    style={{
                      padding: "7px 20px", background: accent, border: "none",
                      borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >Save</button>
                  {savedMsg && (
                    <span style={{ fontSize: 12, color: isDark ? "#4ade80" : "#16a34a" }}>Saved ✓</span>
                  )}
                </div>

                {/* Preview */}
                <div>
                  <label style={labelStyle}>Preview — Sarah at Acme</label>
                  <div style={{
                    background: panel,
                    border: `1px solid ${border}`,
                    borderRadius: 8, padding: "10px 14px",
                  }}>
                    {editSubject && (
                      <div style={{ fontSize: 12, fontWeight: 600, color: txt, marginBottom: 6 }}>
                        {fillPreview(editSubject, FAKE_LEAD)}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: sub, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                      {fillPreview(editBody, FAKE_LEAD) || <span style={{ color: muted, fontStyle: "italic" }}>Nothing to preview yet.</span>}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListItem({ tpl, isActive, isDark, txt, sub, muted, accent, panel, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const [delHover, setDelHover] = useState(false);

  const bg = isActive
    ? (isDark ? "#1e3a5f" : "#eff6ff")
    : hovered
      ? (isDark ? "#1e293b" : "#f1f5f9")
      : "transparent";

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setDelHover(false); }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 14px",
        background: bg,
        cursor: "pointer",
        borderLeft: isActive ? `2px solid ${accent}` : "2px solid transparent",
      }}
    >
      <span style={{
        fontSize: 13, color: isActive ? (isDark ? "#93c5fd" : "#1d4ed8") : txt,
        fontWeight: isActive ? 600 : 400,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        flex: 1, minWidth: 0,
      }}>
        {tpl.name || "Untitled"}
      </span>
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          onMouseEnter={() => setDelHover(true)}
          onMouseLeave={() => setDelHover(false)}
          style={{
            background: "none", border: "none",
            color: delHover ? (isDark ? "#f87171" : "#dc2626") : muted,
            cursor: "pointer", fontSize: 14, lineHeight: 1,
            padding: "0 2px", flexShrink: 0, marginLeft: 6,
          }}
          title="Delete template"
        >×</button>
      )}
    </div>
  );
}
