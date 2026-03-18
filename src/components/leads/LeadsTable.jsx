import { useRef, useState } from "react";
import { OutreachStatusPill }  from "./OutreachStatusPill.jsx";
import { EmailStatusPill }     from "./EmailStatusPill.jsx";
import { StatusPickerPopover } from "./StatusPickerPopover.jsx";
import { STALE_THRESHOLD_MS }  from "../../constants/outreach.js";

function FitBadge({ score, isDark }) {
  const color =
    score >= 80 ? (isDark ? "#86efac" : "#15803d") :
    score >= 60 ? (isDark ? "#fde047" : "#a16207") :
                  (isDark ? "#f87171" : "#dc2626");
  const bg =
    score >= 80 ? (isDark ? "#052e16" : "#ecfdf5") :
    score >= 60 ? (isDark ? "#1c1405" : "#fefce8") :
                  (isDark ? "#1f0a0a" : "#fff5f5");
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 7px", borderRadius: 9999,
      background: bg, color, fontSize: 11, fontWeight: 700,
    }}>
      {score}%
    </span>
  );
}

function StatusCell({ lead, isDark, onPillClick, pillRefs }) {
  const [hovered, setHovered] = useState(false);
  const isNew = lead.outreachStatus === "new";

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 3 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && !isNew ? (
        <>
          <EmailStatusPill status={lead.emailStatus} isDark={isDark} />
          <div ref={(el) => { if (pillRefs) pillRefs.current[lead.id] = el; }}>
            <OutreachStatusPill
              status={lead.outreachStatus}
              contactedAt={lead.contactedAt}
              isDark={isDark}
              onClick={() => onPillClick(lead.id)}
            />
          </div>
        </>
      ) : isNew ? (
        <>
          <div ref={(el) => { if (pillRefs) pillRefs.current[lead.id] = el; }}>
            <EmailStatusPill status={lead.emailStatus} isDark={isDark} />
          </div>
          {hovered && (
            <OutreachStatusPill
              status="new" isDark={isDark}
              onClick={() => onPillClick(lead.id)}
            />
          )}
        </>
      ) : (
        <div ref={(el) => { if (pillRefs) pillRefs.current[lead.id] = el; }}>
          <OutreachStatusPill
            status={lead.outreachStatus}
            contactedAt={lead.contactedAt}
            isDark={isDark}
            onClick={() => onPillClick(lead.id)}
          />
        </div>
      )}
    </div>
  );
}

function ActionButtons({ lead, isDark, onCopy, onStatusUpdate }) {
  const sub   = isDark ? "#475569" : "#94a3b8";
  const hover = isDark ? "#e2e8f0" : "#1e293b";
  const alreadyContacted = ["contacted", "responded", "qualified", "dead"].includes(lead.outreachStatus);

  const btn = (icon, title, onClick, dim, red) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      title={title}
      style={{
        background: "none", border: "none", cursor: "pointer",
        color: dim ? sub : sub,
        opacity: dim ? 0.35 : 0.75,
        fontSize: 15, padding: "3px 4px", borderRadius: 5,
        display: "flex", alignItems: "center",
        transition: "opacity 0.1s, color 0.1s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = red ? "#f87171" : hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = dim ? "0.35" : "0.75"; e.currentTarget.style.color = sub; }}
    >
      {icon}
    </button>
  );

  if (lead.outreachStatus === "dead") {
    return (
      <div style={{ display: "flex", gap: 1 }}>
        {btn("↺", "Reopen lead", () => onStatusUpdate(lead.id, "new"))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 1 }}>
      {lead.email
        ? btn("✉", alreadyContacted ? "Already reached out — copy anyway" : `Copy ${lead.email}`,
            () => onCopy(lead), alreadyContacted)
        : btn("✉", "No email", null, true)}
      {lead.outreachStatus === "new"      && btn("✓", "Mark in-flight", () => onStatusUpdate(lead.id, "contacted"))}
      {lead.outreachStatus === "contacted" && btn("↩", "Got a reply", () => onStatusUpdate(lead.id, "responded"))}
    </div>
  );
}

export function LeadsTable({
  leads, isDark, onStatusUpdate, onCopy,
  focusedId, onFocusRow,
  selected, onToggleSelect, onSelectAll,
}) {
  const [openPopover, setOpenPopover] = useState(null);
  const pillRefs = useRef({});

  const txt    = isDark ? "#e2e8f0" : "#1e293b";
  const sub    = isDark ? "#94a3b8" : "#64748b";
  const border = isDark ? "#1e293b" : "#f1f5f9";
  const rowHov = isDark ? "#0a1628" : "#f8fafc";
  const focBg  = isDark ? "#1e2d3d" : "#eff6ff";
  const chkCol = isDark ? "#334155" : "#e2e8f0";

  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));

  if (leads.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: sub, fontSize: 14 }}>
        No leads match the current filters.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      {/* Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr 148px 64px 80px",
        padding: "7px 16px",
        borderBottom: `1px solid ${border}`,
        fontSize: 10, fontWeight: 700,
        color: isDark ? "#334155" : "#cbd5e1",
        textTransform: "uppercase", letterSpacing: "0.07em",
        position: "sticky", top: 0,
        background: isDark ? "#0a0f1a" : "#ffffff",
        zIndex: 10,
      }}>
        {/* Select all */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => allSelected ? leads.forEach((l) => selected.has(l.id) && onToggleSelect(l.id)) : onSelectAll(leads.map((l) => l.id))}
            style={{ width: 13, height: 13, cursor: "pointer", accentColor: "#3b82f6" }}
          />
        </div>
        <span>Lead</span>
        <span>Status</span>
        <span style={{ textAlign: "right" }}>Score</span>
        <span style={{ textAlign: "right" }}>Actions</span>
      </div>

      {leads.map((lead) => {
        const isDead   = lead.outreachStatus === "dead";
        const isStale  = lead.outreachStatus === "contacted" && lead.contactedAt &&
          Date.now() - new Date(lead.contactedAt).getTime() > STALE_THRESHOLD_MS;
        const isFocused  = focusedId === lead.id;
        const isSelected = selected.has(lead.id);

        return (
          <div
            key={lead.id}
            onClick={() => onFocusRow(lead.id)}
            style={{
              display: "grid",
              gridTemplateColumns: "32px 1fr 148px 64px 80px",
              padding: "10px 16px",
              borderBottom: `1px solid ${border}`,
              borderLeft: isStale
                ? "3px solid #f59e0b"
                : isSelected
                ? "3px solid #3b82f6"
                : "3px solid transparent",
              background: isFocused ? focBg : isSelected ? (isDark ? "#111c2e" : "#f0f7ff") : "transparent",
              opacity: isDead ? 0.55 : 1,
              cursor: "default",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => { if (!isFocused && !isSelected) e.currentTarget.style.background = rowHov; }}
            onMouseLeave={(e) => { if (!isFocused && !isSelected) e.currentTarget.style.background = "transparent"; }}
          >
            {/* Checkbox */}
            <div style={{ display: "flex", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(lead.id)}
                style={{ width: 13, height: 13, cursor: "pointer", accentColor: "#3b82f6" }}
              />
            </div>

            {/* Name + Role */}
            <div style={{ minWidth: 0, paddingRight: 10 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: txt,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                textDecoration: isDead ? "line-through" : "none",
                textDecorationColor: isDark ? "#334155" : "#cbd5e1",
              }}>
                {lead.name}
              </div>
              <div style={{ fontSize: 11, color: sub, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {lead.title}{lead.title && lead.company ? " · " : ""}{lead.company}
              </div>
            </div>

            {/* Status */}
            <div style={{ display: "flex", alignItems: "flex-start", paddingTop: 1 }}>
              <StatusCell
                lead={lead} isDark={isDark}
                onPillClick={(id) => { setOpenPopover(openPopover === id ? null : id); }}
                pillRefs={pillRefs}
              />
            </div>

            {/* Score */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              {lead.fitScore != null && <FitBadge score={lead.fitScore} isDark={isDark} />}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <ActionButtons lead={lead} isDark={isDark} onCopy={onCopy} onStatusUpdate={onStatusUpdate} />
            </div>
          </div>
        );
      })}

      {/* Status popover */}
      {openPopover && (() => {
        const lead = leads.find((l) => l.id === openPopover);
        if (!lead) return null;
        return (
          <StatusPickerPopover
            currentStatus={lead.outreachStatus}
            isDark={isDark}
            anchorRef={{ current: pillRefs.current[openPopover] }}
            onSelect={(status, reason) => { onStatusUpdate(openPopover, status, reason); setOpenPopover(null); }}
            onClose={() => setOpenPopover(null)}
          />
        );
      })()}
    </div>
  );
}
