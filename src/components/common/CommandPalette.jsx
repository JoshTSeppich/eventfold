import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../../context/AppContext.jsx";

// ─── Static action definitions ────────────────────────────────────────────────

const ACTIONS = [
  { id: "goto-prospect", label: "Go to Prospect Intel", icon: "◉", action: "tab:prospect" },
  { id: "goto-intel",     icon: "◎", label: "Go to Intel",      tab: "intel",     hint: "I" },
  { id: "goto-leads",     icon: "◈", label: "Go to Leads",      tab: "leads",     hint: "L" },
  { id: "goto-followups", icon: "↩", label: "Go to Follow-ups", tab: "followups", hint: "F" },
  { id: "goto-email",     icon: "✉", label: "Go to Email",      tab: "email",     hint: "E" },
  { id: "goto-analytics", icon: "◷", label: "Go to Analytics",  tab: "analytics", hint: "A" },
  { id: "goto-today",     icon: "✦", label: "Go to Today",      tab: "today",     hint: "T" },
  { id: "goto-features",  icon: "◇", label: "Go to Features",   tab: "features",  hint: null },
  { id: "goto-activity",  icon: "◳", label: "Go to Activity",   tab: "activity",  hint: null },
  { id: "open-settings",  icon: "⚙", label: "Open Settings",    tab: null,        hint: "," },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function matchesQuery(str, query) {
  return (str || "").toLowerCase().includes(query.toLowerCase());
}

// ─── StatusPill ───────────────────────────────────────────────────────────────

const STATUS_PILL = {
  new:       { label: "New",       bg: "transparent", text: "#64748b", border: "#334155" },
  contacted: { label: "In-flight", bg: "#1e3a5f",     text: "#93c5fd", border: "transparent" },
  responded: { label: "Replied",   bg: "#2e1065",     text: "#c4b5fd", border: "transparent" },
  qualified: { label: "Booked",    bg: "#052e16",     text: "#86efac", border: "transparent" },
  dead:      { label: "Dead",      bg: "transparent", text: "#475569", border: "#1e293b" },
};

function StatusPill({ status }) {
  const cfg = STATUS_PILL[status] || STATUS_PILL.new;
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 500,
      padding: "1px 7px",
      borderRadius: 99,
      background: cfg.bg,
      color: cfg.text,
      border: `1px solid ${cfg.border || "transparent"}`,
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

// ─── CommandPalette ───────────────────────────────────────────────────────────

export function CommandPalette({ T, onClose, onSwitchTab }) {
  const { leads } = useApp();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // ── Build result list ─────────────────────────────────────────────────────

  const matchedLeads = query.trim()
    ? leads
        .filter((l) => matchesQuery(l.name, query) || matchesQuery(l.company, query))
        .slice(0, 6)
    : [];

  const matchedActions = ACTIONS.filter((a) =>
    !query.trim() || matchesQuery(a.label, query)
  );

  // Flat list of items for keyboard navigation
  // Each item: { type: "lead"|"action", data, index }
  const items = [
    ...matchedLeads.map((l) => ({ type: "lead", data: l })),
    ...matchedActions.map((a) => ({ type: "action", data: a })),
  ];

  // ── Select item ───────────────────────────────────────────────────────────

  const selectItem = useCallback((item) => {
    if (!item) return;
    if (item.type === "lead") {
      onSwitchTab("leads");
    } else {
      const { tab } = item.data;
      if (tab) {
        onSwitchTab(tab);
      } else if (item.data.id === "open-settings") {
        onSwitchTab("settings");
      }
    }
    onClose();
  }, [onClose, onSwitchTab]);

  // ── Keyboard handler ──────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" || (e.key === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectItem(items[selectedIndex]);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items, selectedIndex, onClose, selectItem]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Autofocus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderLead = (lead, flatIdx) => {
    const isSelected = flatIdx === selectedIndex;
    return (
      <div
        key={lead.id}
        data-idx={flatIdx}
        onClick={() => selectItem({ type: "lead", data: lead })}
        onMouseEnter={() => setSelectedIndex(flatIdx)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          cursor: "pointer",
          background: isSelected ? `${T.accent}18` : "transparent",
          borderLeft: isSelected ? `2px solid ${T.accent}` : "2px solid transparent",
          transition: "background 0.1s",
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: T.accent + "33",
          color: T.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {getInitials(lead.name)}
        </div>

        {/* Name + company */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {lead.name}
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {[lead.title, lead.company].filter(Boolean).join(" · ")}
          </div>
        </div>

        <StatusPill status={lead.outreachStatus} />
      </div>
    );
  };

  const renderAction = (action, flatIdx) => {
    const isSelected = flatIdx === selectedIndex;
    return (
      <div
        key={action.id}
        data-idx={flatIdx}
        onClick={() => selectItem({ type: "action", data: action })}
        onMouseEnter={() => setSelectedIndex(flatIdx)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          cursor: "pointer",
          background: isSelected ? `${T.accent}18` : "transparent",
          borderLeft: isSelected ? `2px solid ${T.accent}` : "2px solid transparent",
          transition: "background 0.1s",
        }}
      >
        <div style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: T.surface,
          border: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          color: T.textSub,
          flexShrink: 0,
        }}>
          {action.icon}
        </div>

        <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: T.text }}>
          {action.label}
        </div>

        {action.hint && (
          <div style={{
            fontSize: 11,
            color: T.textMuted,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 4,
            padding: "1px 6px",
            fontFamily: "monospace",
          }}>
            {action.hint}
          </div>
        )}
      </div>
    );
  };

  const renderSectionHeader = (label, count) => (
    <div style={{
      padding: "6px 14px 4px",
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: T.textMuted,
      borderBottom: `1px solid ${T.borderLight}`,
    }}>
      {label}
      {count !== undefined && (
        <span style={{ marginLeft: 6, opacity: 0.6 }}>{count}</span>
      )}
    </div>
  );

  const hasResults = items.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 120,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: "calc(100vw - 32px)",
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "60vh",
        }}
      >
        {/* Search input */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderBottom: `1px solid ${T.border}`,
        }}>
          <span style={{ fontSize: 16, color: T.textMuted, flexShrink: 0 }}>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads or jump to..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 15,
              color: T.text,
              fontFamily: "inherit",
            }}
          />
          <kbd style={{
            fontSize: 11,
            color: T.textMuted,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 4,
            padding: "2px 6px",
          }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {!hasResults && (
            <div style={{
              padding: "24px 14px",
              textAlign: "center",
              color: T.textMuted,
              fontSize: 13,
            }}>
              No results for "{query}"
            </div>
          )}

          {matchedLeads.length > 0 && (
            <>
              {renderSectionHeader("Leads", matchedLeads.length)}
              {matchedLeads.map((lead, i) => renderLead(lead, i))}
            </>
          )}

          {matchedActions.length > 0 && (
            <>
              {renderSectionHeader("Actions")}
              {matchedActions.map((action, i) => renderAction(action, matchedLeads.length + i))}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          display: "flex",
          gap: 14,
          padding: "8px 14px",
          borderTop: `1px solid ${T.borderLight}`,
          fontSize: 11,
          color: T.textMuted,
        }}>
          <span><kbd style={{ fontFamily: "monospace" }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ fontFamily: "monospace" }}>↵</kbd> select</span>
          <span><kbd style={{ fontFamily: "monospace" }}>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
