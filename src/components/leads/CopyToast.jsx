import { useEffect, useRef, useState } from "react";

const DURATION = 8000;

export function CopyToast({ toast, onConfirm, onDismiss, isDark }) {
  const [progress, setProgress] = useState(100);
  const startRef   = useRef(null);
  const rafRef     = useRef(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!toast) return;
    startRef.current = Date.now();
    setProgress(100);

    function tick() {
      const elapsed = Date.now() - startRef.current;
      const pct     = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(pct);
      if (pct > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        dismissRef.current();
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [toast?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!toast) return;
    const handler = (e) => {
      if (e.key === "y" || e.key === "Y" || e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
      if (e.key === "n" || e.key === "N" || e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toast, onConfirm, onDismiss]);

  if (!toast) return null;

  const bg     = isDark ? "#1e293b" : "#ffffff";
  const border = isDark ? "#334155" : "#e5e7eb";
  const txt    = isDark ? "#e2e8f0" : "#1e293b";
  const sub    = isDark ? "#94a3b8" : "#64748b";

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 2000,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 12,
      boxShadow: isDark
        ? "0 8px 32px rgba(0,0,0,0.5)"
        : "0 8px 32px rgba(0,0,0,0.12)",
      width: 320, overflow: "hidden",
      animation: "slideUp 0.2s ease",
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <div style={{ padding: "14px 16px 12px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: txt, marginBottom: 2 }}>
              Copied {toast.email}
            </div>
            <div style={{ fontSize: 12, color: sub }}>
              Mark <strong style={{ color: txt }}>{toast.name}</strong> as in-flight?
            </div>
          </div>
          <button
            onClick={onDismiss}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: sub, fontSize: 16, lineHeight: 1, padding: "0 0 0 8px",
              marginTop: -2,
            }}
          >
            ×
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: "7px 0",
              background: isDark ? "#1e3a5f" : "#eff6ff",
              border: `1px solid ${isDark ? "#2563eb" : "#bfdbfe"}`,
              borderRadius: 8, color: isDark ? "#93c5fd" : "#1d4ed8",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            Yes  <span style={{ opacity: 0.55, fontWeight: 400 }}>(Y)</span>
          </button>
          <button
            onClick={onDismiss}
            style={{
              flex: 1, padding: "7px 0",
              background: "transparent",
              border: `1px solid ${border}`,
              borderRadius: 8, color: sub,
              fontSize: 12, cursor: "pointer",
            }}
          >
            Not yet  <span style={{ opacity: 0.55 }}>(N)</span>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: isDark ? "#0f172a" : "#f1f5f9" }}>
        <div style={{
          height: "100%", background: "#3b82f6",
          width: `${progress}%`,
          transition: "width 0.05s linear",
        }} />
      </div>
    </div>
  );
}
