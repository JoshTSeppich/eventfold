import { STATUS_CONFIG, STALE_THRESHOLD_MS } from "../../constants/outreach.js";
import { relativeTime } from "../../utils/relativeTime.js";

export function OutreachStatusPill({ status = "new", contactedAt, isDark, size = "sm", onClick }) {
  const cfg  = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const bg   = isDark ? cfg.darkBg   : cfg.bg;
  const text = isDark ? cfg.darkText : cfg.text;

  const height  = size === "md" ? 22 : 18;
  const font    = size === "md" ? 11 : 10;
  const padding = size === "md" ? "2px 8px" : "1px 6px";

  const isStale =
    status === "contacted" &&
    contactedAt &&
    Date.now() - new Date(contactedAt).getTime() > STALE_THRESHOLD_MS;

  const ageLabel = status === "contacted" && contactedAt
    ? relativeTime(contactedAt)
    : null;

  const border = isStale
    ? "1.5px solid #fbbf24"
    : cfg.border && cfg.border !== "transparent"
    ? `1px solid ${isDark ? cfg.darkBorder : cfg.border}`
    : "none";

  if (status === "new") {
    return (
      <span
        onClick={onClick}
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          height, fontSize: font, fontWeight: 600,
          padding, borderRadius: 9999, cursor: onClick ? "pointer" : "default",
          color: isDark ? "#475569" : "#94a3b8",
          border: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
          userSelect: "none",
        }}
      >
        · New
      </span>
    );
  }

  if (status === "dead") {
    return (
      <span
        onClick={onClick}
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          height, fontSize: font, fontWeight: 600,
          padding, borderRadius: 9999, cursor: onClick ? "pointer" : "default",
          color: isDark ? "#475569" : "#94a3b8",
          border: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
          userSelect: "none",
        }}
      >
        ✗
      </span>
    );
  }

  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        height, fontSize: font, fontWeight: 600,
        padding, borderRadius: 9999, border,
        background: bg, color: text,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      {cfg.icon} {cfg.label}
      {ageLabel && (
        <span style={{ opacity: 0.7, fontWeight: 400 }}>
          · {ageLabel}
        </span>
      )}
    </span>
  );
}
