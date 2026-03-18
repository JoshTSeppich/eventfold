export function LeadsSummaryBar({ summary, filters, onFilter, isDark }) {
  const txt   = isDark ? "#e2e8f0" : "#1e293b";
  const muted = isDark ? "#475569" : "#94a3b8";
  const bg    = isDark ? "#0f172a" : "#f8fafc";
  const border= isDark ? "#1e293b" : "#e2e8f0";

  function Chip({ label, count, filterKey, filterVal, color, warn }) {
    const isActive = filters[filterKey] === filterVal;
    const base = {
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 9999,
      fontSize: 11, fontWeight: 600, cursor: "pointer",
      border: `1px solid ${isActive ? (color || "#3b82f6") : border}`,
      background: isActive ? (isDark ? "#1e293b" : "#eff6ff") : "transparent",
      color: warn ? "#f59e0b" : isActive ? (color || (isDark ? "#93c5fd" : "#1d4ed8")) : muted,
      transition: "all 0.12s",
      userSelect: "none",
    };

    return (
      <button
        style={base}
        onClick={() =>
          onFilter(filterKey, isActive ? "all" : filterVal)
        }
        title={warn ? `${summary.staleContacted} need follow-up` : undefined}
      >
        {count} {label}
        {warn && summary.staleContacted > 0 && (
          <span style={{ color: "#f59e0b", marginLeft: 2 }}>
            ⚠ {summary.staleContacted}
          </span>
        )}
      </button>
    );
  }

  return (
    <div style={{
      padding: "10px 20px",
      background: bg,
      borderBottom: `1px solid ${border}`,
      fontSize: 12,
    }}>
      {/* Row 1: Email coverage */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        flexWrap: "wrap", marginBottom: 6,
      }}>
        <span style={{ color: txt, fontWeight: 600, fontSize: 12 }}>
          {summary.total} leads
        </span>
        <span style={{ color: muted }}>·</span>
        <Chip label="verified"  count={`✓ ${summary.verified}`} filterKey="emailStatus" filterVal="verified" />
        <Chip label="likely"    count={`~ ${summary.likely}`}   filterKey="emailStatus" filterVal="likely"   />
        <Chip label="no email"  count={`✗ ${summary.noEmail}`}  filterKey="emailStatus" filterVal="none"     />
      </div>

      {/* Row 2: Pipeline health */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ color: muted, fontSize: 11, minWidth: 50 }} />
        <Chip label="new"       count={summary.new}       filterKey="outreachStatus" filterVal="new"       />
        <Chip
          label="in-flight"
          count={summary.contacted}
          filterKey="outreachStatus"
          filterVal="contacted"
          warn={summary.staleContacted > 0}
        />
        <Chip label="replied"   count={summary.responded} filterKey="outreachStatus" filterVal="responded" />
        <Chip label="booked"    count={summary.qualified} filterKey="outreachStatus" filterVal="qualified" color="#16a34a" />
        {summary.dead > 0 && (
          <Chip label=""          count={`✗ ${summary.dead}`} filterKey="outreachStatus" filterVal="dead" />
        )}
      </div>
    </div>
  );
}
