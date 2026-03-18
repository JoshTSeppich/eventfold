export const STALE_THRESHOLD_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export const STATUS_CONFIG = {
  new: {
    label: "New",
    shortLabel: "New",
    icon: null,
    bg: "transparent",
    text: "#94a3b8",
    border: "#cbd5e1",
    darkBg: "transparent",
    darkText: "#64748b",
    darkBorder: "#334155",
  },
  contacted: {
    label: "In-flight",
    shortLabel: "In-flight",
    icon: "✉",
    bg: "#eff6ff",
    text: "#1d4ed8",
    border: "transparent",
    darkBg: "#1e3a5f",
    darkText: "#93c5fd",
    darkBorder: "transparent",
  },
  responded: {
    label: "Replied",
    shortLabel: "Replied",
    icon: "↩",
    bg: "#f5f3ff",
    text: "#6d28d9",
    border: "transparent",
    darkBg: "#2e1065",
    darkText: "#c4b5fd",
    darkBorder: "transparent",
  },
  qualified: {
    label: "Booked",
    shortLabel: "Booked",
    icon: "✓",
    bg: "#ecfdf5",
    text: "#15803d",
    border: "transparent",
    darkBg: "#052e16",
    darkText: "#86efac",
    darkBorder: "transparent",
  },
  dead: {
    label: "Dead",
    shortLabel: "",
    icon: "✗",
    bg: "transparent",
    text: "#94a3b8",
    border: "#e2e8f0",
    darkBg: "transparent",
    darkText: "#475569",
    darkBorder: "#1e293b",
  },
};

export const EMAIL_STATUS_CONFIG = {
  verified: {
    label: "Verified",
    icon: "✓",
    bg: "#ecfdf5",
    text: "#15803d",
    darkBg: "#052e16",
    darkText: "#86efac",
  },
  likely: {
    label: "Likely",
    icon: "~",
    bg: "#fefce8",
    text: "#a16207",
    darkBg: "#1c1405",
    darkText: "#fde047",
  },
  none: {
    label: "No Email",
    icon: "✗",
    bg: "transparent",
    text: "#94a3b8",
    darkBg: "transparent",
    darkText: "#475569",
  },
};

export const STATUSES_ORDER = ["new", "contacted", "responded", "qualified", "dead"];
