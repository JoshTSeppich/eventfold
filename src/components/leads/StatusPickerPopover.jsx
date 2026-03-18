import { useEffect, useRef, useState } from "react";
import { STATUS_CONFIG, STATUSES_ORDER } from "../../constants/outreach.js";

export function StatusPickerPopover({ currentStatus, isDark, onSelect, onClose, anchorRef }) {
  const [deadExpanded, setDeadExpanded] = useState(false);
  const [deadReason, setDeadReason]     = useState("");
  const [pos, setPos]                   = useState({ top: 0, left: 0 });
  const popRef = useRef(null);
  const reasonRef = useRef(null);

  const bg     = isDark ? "#1e293b" : "#ffffff";
  const border = isDark ? "#334155" : "#e2e8f0";
  const hover  = isDark ? "#0f172a" : "#f8fafc";
  const txt    = isDark ? "#e2e8f0" : "#1e293b";
  const muted  = isDark ? "#475569" : "#94a3b8";

  // Position below / above anchor
  useEffect(() => {
    if (!anchorRef?.current || !popRef.current) return;
    const rect    = anchorRef.current.getBoundingClientRect();
    const popH    = popRef.current.offsetHeight;
    const spaceB  = window.innerHeight - rect.bottom;
    const top     = spaceB > popH + 8 ? rect.bottom + 4 : rect.top - popH - 4;
    setPos({ top, left: rect.left });
  }, [deadExpanded]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Focus reason input when expanded
  useEffect(() => {
    if (deadExpanded && reasonRef.current) reasonRef.current.focus();
  }, [deadExpanded]);

  // Keyboard
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleSelect(status) {
    if (status === "dead") {
      setDeadExpanded(true);
    } else {
      onSelect(status);
      onClose();
    }
  }

  function confirmDead() {
    onSelect("dead", deadReason.trim() || undefined);
    onClose();
  }

  const items = STATUSES_ORDER.filter((s) => s !== "dead");

  return (
    <div
      ref={popRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 1000,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        boxShadow: isDark
          ? "0 8px 32px rgba(0,0,0,0.5)"
          : "0 8px 32px rgba(0,0,0,0.12)",
        minWidth: 210,
        overflow: "hidden",
        fontSize: 13,
      }}
    >
      {items.map((status) => {
        const cfg      = STATUS_CONFIG[status];
        const isActive = status === currentStatus;
        return (
          <button
            key={status}
            onClick={() => handleSelect(status)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", padding: "9px 14px",
              background: "transparent", border: "none",
              color: isActive ? (isDark ? "#60a5fa" : "#2563eb") : txt,
              fontWeight: isActive ? 600 : 400,
              fontSize: 13, cursor: "pointer", textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 14, textAlign: "center", opacity: cfg.icon ? 1 : 0.3 }}>
                {cfg.icon || "·"}
              </span>
              {cfg.label}
            </span>
            {isActive && <span style={{ fontSize: 12 }}>✓</span>}
          </button>
        );
      })}

      {/* Divider */}
      <div style={{ height: 1, background: border, margin: "2px 0" }} />

      {/* Dead */}
      <button
        onClick={() => handleSelect("dead")}
        style={{
          display: "flex", alignItems: "center",
          width: "100%", padding: "9px 14px",
          background: "transparent", border: "none",
          color: isDark ? "#f87171" : "#dc2626",
          fontSize: 13, cursor: "pointer", textAlign: "left",
          fontWeight: currentStatus === "dead" ? 600 : 400,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "#1f0a0a" : "#fff5f5")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 14, textAlign: "center" }}>✗</span>
          Mark as Dead
        </span>
        {currentStatus === "dead" && <span style={{ fontSize: 12, marginLeft: "auto" }}>✓</span>}
      </button>

      {/* Dead reason expansion */}
      {deadExpanded && (
        <div style={{ padding: "0 12px 12px" }}>
          <textarea
            ref={reasonRef}
            value={deadReason}
            onChange={(e) => setDeadReason(e.target.value)}
            placeholder="Reason (optional)"
            rows={2}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "7px 10px",
              background: isDark ? "#0f172a" : "#f8fafc",
              border: `1px solid ${border}`,
              borderRadius: 6, color: txt, fontSize: 12,
              resize: "none", outline: "none", fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
            <button
              onClick={() => { setDeadExpanded(false); setDeadReason(""); }}
              style={{
                flex: 1, padding: "6px 0",
                background: "transparent", border: `1px solid ${border}`,
                borderRadius: 6, color: muted, fontSize: 12, cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmDead}
              style={{
                flex: 1, padding: "6px 0",
                background: isDark ? "#7f1d1d" : "#fee2e2",
                border: "none", borderRadius: 6,
                color: isDark ? "#fca5a5" : "#991b1b",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
