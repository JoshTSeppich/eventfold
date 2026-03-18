export function DailyGoalBar({ contacted, goal, isDark }) {
  const pct       = Math.min(100, Math.round((contacted / goal) * 100));
  const remaining = Math.max(0, goal - contacted);
  const done      = contacted >= goal;

  const trackBg   = isDark ? "#1e293b" : "#e2e8f0";
  const fillColor  = done ? "#16a34a" : contacted > goal * 0.6 ? "#f59e0b" : "#3b82f6";
  const txt        = isDark ? "#94a3b8" : "#64748b";
  const strong     = isDark ? "#e2e8f0" : "#0f172a";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "0 4px",
    }}>
      {/* Count */}
      <span style={{ fontSize: 12, color: txt, whiteSpace: "nowrap" }}>
        <span style={{ fontWeight: 700, color: done ? "#16a34a" : strong }}>
          {contacted}
        </span>
        <span style={{ opacity: 0.6 }}>/{goal}</span>
      </span>

      {/* Bar */}
      <div style={{
        width: 72, height: 5,
        background: trackBg, borderRadius: 9999, overflow: "hidden",
        flexShrink: 0,
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: fillColor,
          borderRadius: 9999,
          transition: "width 0.4s ease",
        }} />
      </div>

      {/* Label */}
      <span style={{ fontSize: 11, color: txt, whiteSpace: "nowrap" }}>
        {done ? "🎯 Goal hit!" : `${remaining} to go`}
      </span>
    </div>
  );
}
