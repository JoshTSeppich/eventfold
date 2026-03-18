import { useApp } from "../context/AppContext.jsx";

const ACTION_ICONS = {
  contacted:  "✉",
  responded:  "↩",
  qualified:  "★",
  dead:       "✗",
  "note":     "📝",
  "tag":      "🏷",
  "imported": "📥",
  default:    "●",
};

function timeAgo(isoTs) {
  const diff = Date.now() - new Date(isoTs).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(isoTs).toLocaleDateString();
}

function groupByDate(entries) {
  const groups = {};
  for (const e of entries) {
    const key = new Date(e.ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }
  return Object.entries(groups);
}

export function ActivityView({ T }) {
  const { activityLog, isDark } = useApp();

  if (activityLog.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: T.textMuted }}>
        <span style={{ fontSize: 32 }}>📋</span>
        <p style={{ fontSize: 14 }}>No activity yet — actions like emailing and status changes will appear here.</p>
      </div>
    );
  }

  const groups = groupByDate(activityLog);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>
        Activity Feed · {activityLog.length} events
      </div>

      {groups.map(([dateLabel, entries]) => (
        <div key={dateLabel} style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: T.textMuted,
            textTransform: "uppercase", letterSpacing: "0.06em",
            marginBottom: 8, display: "flex", alignItems: "center", gap: 8,
          }}>
            <span>{dateLabel}</span>
            <div style={{ flex: 1, height: 1, background: T.border }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {entries.map((entry) => {
              const icon = ACTION_ICONS[entry.action] || ACTION_ICONS.default;
              return (
                <div
                  key={entry.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: isDark ? "#0a0f1a" : "#f8fafc",
                    border: `1px solid ${T.border}`,
                  }}
                >
                  <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{entry.leadName || "Unknown"}</span>
                    {entry.company && (
                      <span style={{ fontSize: 11, color: T.textMuted }}> · {entry.company}</span>
                    )}
                    <span style={{ fontSize: 12, color: T.textSub }}> — {entry.action}</span>
                    {entry.detail && (
                      <span style={{ fontSize: 11, color: T.textMuted }}> {entry.detail}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: T.textMuted, flexShrink: 0 }}>{timeAgo(entry.ts)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
