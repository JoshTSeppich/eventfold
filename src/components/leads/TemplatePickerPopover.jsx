import { useEffect, useRef } from "react";
import { fillTemplate } from "../../data/defaultTemplates.js";

export function TemplatePickerPopover({ templates, lead, isDark, onSelect, onClose }) {
  const ref = useRef(null);

  const bg     = isDark ? "#1e293b" : "#ffffff";
  const border = isDark ? "#334155" : "#e2e8f0";
  const txt    = isDark ? "#e2e8f0" : "#1e293b";
  const sub    = isDark ? "#64748b" : "#94a3b8";
  const hover  = isDark ? "#0f172a" : "#f8fafc";

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute", bottom: "calc(100% + 8px)", right: 0,
        zIndex: 500,
        background: bg, border: `1px solid ${border}`,
        borderRadius: 10,
        boxShadow: isDark
          ? "0 8px 32px rgba(0,0,0,0.5)"
          : "0 8px 32px rgba(0,0,0,0.12)",
        minWidth: 260, overflow: "hidden",
      }}
    >
      <div style={{ padding: "8px 12px 6px", borderBottom: `1px solid ${border}` }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Pick template
        </span>
      </div>

      {templates.map((tpl) => {
        const { subject } = fillTemplate(tpl, lead);
        return (
          <button
            key={tpl.id}
            onClick={() => { onSelect(tpl); onClose(); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "10px 14px",
              background: "transparent", border: "none",
              color: txt, cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{tpl.name}</div>
            <div style={{ fontSize: 11, color: sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {subject}
            </div>
          </button>
        );
      })}
    </div>
  );
}
