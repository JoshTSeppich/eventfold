export function BulkActionBar({ count, onMark, onClear, onExport, onApplyHook, isDark }) {
  const bg     = isDark ? "#1e3a5f" : "#eff6ff";
  const border = isDark ? "#2563eb" : "#bfdbfe";
  const txt    = isDark ? "#93c5fd" : "#1d4ed8";
  const muted  = isDark ? "#60a5fa" : "#3b82f6";

  const Btn = ({ label, onClick, red }) => (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: `1px solid ${red ? (isDark ? "#7f1d1d" : "#fecaca") : border}`,
        borderRadius: 7, padding: "4px 12px",
        color: red ? (isDark ? "#f87171" : "#dc2626") : txt,
        fontSize: 12, fontWeight: 600, cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 20px",
      background: bg,
      borderBottom: `1px solid ${border}`,
      animation: "slideDown 0.15s ease",
    }}>
      <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }`}</style>

      <span style={{ fontSize: 12, fontWeight: 700, color: txt, marginRight: 4 }}>
        {count} selected
      </span>

      <Btn label="✉ Mark in-flight"  onClick={() => onMark("contacted")} />
      <Btn label="↩ Mark replied"    onClick={() => onMark("responded")} />
      <Btn label="✓ Mark booked"     onClick={() => onMark("qualified")} />
      <Btn label="✗ Mark dead"       onClick={() => onMark("dead")} red />
      {onApplyHook && <Btn label="☆ Apply Hook" onClick={onApplyHook} />}

      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <Btn label="Export CSV" onClick={onExport} />
        <button
          onClick={onClear}
          style={{
            background: "none", border: "none",
            color: muted, cursor: "pointer", fontSize: 18, lineHeight: 1,
          }}
        >×</button>
      </div>
    </div>
  );
}
