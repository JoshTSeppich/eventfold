// Tag colors derived from tag text hash for consistent coloring
const TAG_COLORS = [
  { bg: "#1e3a5f", text: "#93c5fd" },  // blue
  { bg: "#1a2e1a", text: "#86efac" },  // green
  { bg: "#2e1065", text: "#c4b5fd" },  // purple
  { bg: "#1f1500", text: "#fde047" },  // yellow
  { bg: "#1f0a0a", text: "#f87171" },  // red
  { bg: "#1a1f2e", text: "#a5b4fc" },  // indigo
  { bg: "#0f1f1a", text: "#6ee7b7" },  // teal
];

function tagColorIndex(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = ((h << 5) - h + tag.charCodeAt(i)) | 0;
  return Math.abs(h) % TAG_COLORS.length;
}

export function TagPill({ tag, isDark, onRemove, onClick }) {
  const { bg, text } = isDark
    ? TAG_COLORS[tagColorIndex(tag)]
    : { bg: "#e0e7ff", text: "#3730a3" };

  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "1px 7px",
        borderRadius: 9999,
        background: bg, color: text,
        fontSize: 10, fontWeight: 600,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {tag}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(tag); }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: text, opacity: 0.7, fontSize: 10,
            padding: 0, lineHeight: 1, marginLeft: 1,
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
