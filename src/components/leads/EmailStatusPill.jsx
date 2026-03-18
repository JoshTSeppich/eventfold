import { EMAIL_STATUS_CONFIG } from "../../constants/outreach.js";

export function EmailStatusPill({ status = "none", isDark, size = "sm" }) {
  const cfg = EMAIL_STATUS_CONFIG[status] || EMAIL_STATUS_CONFIG.none;
  const bg   = isDark ? cfg.darkBg   : cfg.bg;
  const text = isDark ? cfg.darkText : cfg.text;

  const height  = size === "md" ? 22 : 18;
  const font    = size === "md" ? 11 : 10;
  const padding = size === "md" ? "2px 8px" : "1px 6px";

  if (status === "none") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        height, fontSize: font, fontWeight: 600,
        padding, borderRadius: 9999,
        color: isDark ? "#475569" : "#94a3b8",
        border: `1px solid ${isDark ? "#1e293b" : "#e2e8f0"}`,
      }}>
        ✗ No Email
      </span>
    );
  }

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      height, fontSize: font, fontWeight: 600,
      padding, borderRadius: 9999,
      background: bg, color: text,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}
