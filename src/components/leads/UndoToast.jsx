import { useEffect, useState } from "react";

export function UndoToast({ undoItem, onUndo, onDismiss, isDark, UNDO_WINDOW_MS }) {
  const [pct, setPct] = useState(100);

  useEffect(() => {
    if (!undoItem) return;
    const start = undoItem.startedAt;
    let raf;
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.max(0, 100 - (elapsed / UNDO_WINDOW_MS) * 100);
      setPct(p);
      if (p > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [undoItem, UNDO_WINDOW_MS]);

  useEffect(() => {
    if (!undoItem) return;
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        onUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undoItem, onUndo]);

  if (!undoItem) return null;

  const bg     = isDark ? "#1e293b" : "#ffffff";
  const border = isDark ? "#334155" : "#e2e8f0";
  const txt    = isDark ? "#e2e8f0" : "#1e293b";
  const sub    = isDark ? "#94a3b8" : "#64748b";

  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%",
      transform: "translateX(-50%)",
      zIndex: 3000,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 10,
      boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.12)",
      minWidth: 260, overflow: "hidden",
      animation: "slideUp 0.18s ease",
    }}>
      <style>{`@keyframes slideUp { from { transform: translateX(-50%) translateY(10px); opacity:0 } to { transform: translateX(-50%) translateY(0); opacity:1 } }`}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px" }}>
        <span style={{ fontSize: 13, color: txt }}>{undoItem.label}</span>
        <button
          onClick={onUndo}
          style={{
            marginLeft: "auto",
            background: isDark ? "#334155" : "#f1f5f9",
            border: "none", borderRadius: 6,
            padding: "4px 10px", color: txt,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Undo <span style={{ opacity: 0.5, fontWeight: 400 }}>⌘Z</span>
        </button>
        <button
          onClick={onDismiss}
          style={{ background: "none", border: "none", color: sub, cursor: "pointer", fontSize: 16, padding: 0 }}
        >×</button>
      </div>

      <div style={{ height: 2, background: isDark ? "#0f172a" : "#f1f5f9" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#3b82f6", transition: "width 0.05s linear" }} />
      </div>
    </div>
  );
}
