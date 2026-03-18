import { useState, useCallback, useEffect, useMemo } from "react";
import { useApp }          from "../context/AppContext.jsx";
import { LeadsTable }      from "../components/leads/LeadsTable.jsx";
import { LeadsSummaryBar } from "../components/leads/LeadsSummaryBar.jsx";
import { LeadDetailPanel } from "../components/leads/LeadDetailPanel.jsx";
import { CopyToast }       from "../components/leads/CopyToast.jsx";
import { BulkActionBar }   from "../components/leads/BulkActionBar.jsx";
import { AddLeadModal }    from "../components/leads/AddLeadModal.jsx";
import { UndoToast }       from "../components/leads/UndoToast.jsx";
import { HookPickerModal } from "../components/leads/HookPickerModal.jsx";
import { CsvImportModal } from "../components/leads/CsvImportModal.jsx";
import { useLeadsFilter, useLeadsSummary } from "../hooks/useLeadsFilter.js";
import { updateOutreachStatus }            from "../utils/updateOutreachStatus.js";
import { useSelection }    from "../hooks/useSelection.js";
import { useUndo }         from "../hooks/useUndo.js";
import { exportLeadsCSV }  from "../utils/exportCSV.js";
import { STALE_THRESHOLD_MS } from "../constants/outreach.js";

export function LeadsView({ T, onRequestSwitchTab }) {
  const { isDark, leads, setLeads, addLeads } = useApp();

  const [showDead, setShowDead]     = useState(false);
  const [filters, setFilters]       = useState({ emailStatus: "all", outreachStatus: "all", search: "" });
  const [focusedId, setFocusedId]   = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHookPicker, setShowHookPicker] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [tagFilter, setTagFilter] = useState(null); // null = all, "tagname" = filtered
  const [toast, setToast]           = useState(null);

  const { selected, toggle, selectAll, clear } = useSelection();

  // ── Undo ──────────────────────────────────────────────────────────────────
  const restoreSnapshot = useCallback((leadId, snapshot) => {
    setLeads((prev) => prev.map((l) => l.id === leadId ? snapshot : l));
  }, [setLeads]);

  const { undoItem, push: pushUndo, undo, dismiss: dismissUndo, UNDO_WINDOW_MS } = useUndo(restoreSnapshot);

  // ── Status update ─────────────────────────────────────────────────────────
  const handleStatusUpdate = useCallback((leadId, newStatus, reason, manualNote) => {
    setLeads((prev) => prev.map((l) => {
      if (l.id !== leadId) return l;
      const label = { contacted: "in-flight", responded: "replied", qualified: "booked", dead: "dead", new: "reopened" }[newStatus] || newStatus;
      pushUndo(leadId, `Marked ${l.name.split(" ")[0]} as ${label}`, l);
      let updated = updateOutreachStatus(l, newStatus, reason);
      if (manualNote) {
        updated = { ...updated, notes: [...updated.notes, { id: crypto.randomUUID(), body: manualNote, source: "user", createdAt: new Date().toISOString() }] };
      }
      return updated;
    }));
  }, [setLeads, pushUndo]);

  // ── Bulk ──────────────────────────────────────────────────────────────────
  const handleBulkMark = useCallback((status) => {
    selected.forEach((id) => handleStatusUpdate(id, status));
    clear();
  }, [selected, handleStatusUpdate, clear]);

  // ── Copy + toast ──────────────────────────────────────────────────────────
  const handleCopy = useCallback((lead) => {
    if (!lead.email) return;
    navigator.clipboard.writeText(lead.email).catch(() => {});
    if (lead.outreachStatus === "new") {
      setToast({ id: Date.now(), leadId: lead.id, name: lead.name.split(" ")[0], email: lead.email });
    }
  }, []);

  // ── Add lead ──────────────────────────────────────────────────────────────
  const handleAddLead = useCallback((lead) => {
    addLeads([lead]);
    setFocusedId(lead.id);
    setShowDetail(true);
  }, [addLeads]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const handleFilter = useCallback((key, val) => {
    if (key === "outreachStatus" && val === "dead") { setShowDead((p) => !p); return; }
    setFilters((p) => ({ ...p, [key]: val }));
  }, []);

  const filteredLeads = useLeadsFilter(leads, filters, showDead);
  const tagFilteredLeads = tagFilter
    ? filteredLeads.filter(l => (l.tags || []).includes(tagFilter))
    : filteredLeads;
  const summary       = useLeadsSummary(leads);

  const allTags = useMemo(() => {
    const tagSet = new Set();
    leads.forEach(l => (l.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [leads]);
  const focusedLead   = leads.find((l) => l.id === focusedId) || null;

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const ids = filteredLeads.map((l) => l.id);
      const idx = ids.indexOf(focusedId);
      switch (e.key) {
        case "ArrowDown": case "j": e.preventDefault(); setFocusedId(ids[Math.min(idx + 1, ids.length - 1)] ?? ids[0]); break;
        case "ArrowUp":   case "k": e.preventDefault(); setFocusedId(ids[Math.max(idx - 1, 0)] ?? ids[ids.length - 1]); break;
        case "Enter":  if (focusedId) setShowDetail(true); break;
        case "Escape": setShowDetail(false); break;
        case "e": case "E": if (focusedId) { const l = leads.find((l) => l.id === focusedId); if (l) handleCopy(l); } break;
        case "c": case "C": if (focusedId) handleStatusUpdate(focusedId, "contacted"); break;
        case "r": case "R": if (focusedId) handleStatusUpdate(focusedId, "responded"); break;
        case "x": case "X": if (focusedId) toggle(focusedId); break;
        default: break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filteredLeads, focusedId, leads, handleCopy, handleStatusUpdate, toggle]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 16px", borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        <div style={{ position: "relative" }}>
          <input
            value={filters.search}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
            placeholder="Search leads…"
            style={{
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 7, padding: "5px 10px 5px 28px",
              color: T.text, fontSize: 12, width: 200, outline: "none",
            }}
          />
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: T.textMuted, fontSize: 12, pointerEvents: "none" }}>⌕</span>
        </div>

        <button onClick={() => setShowAddModal(true)} style={{ background: T.accent, border: "none", borderRadius: 7, padding: "5px 11px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Lead</button>
        <button onClick={() => exportLeadsCSV(filteredLeads)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 7, padding: "5px 9px", color: T.textSub, fontSize: 11, cursor: "pointer" }} title="Export to CSV">↓ CSV</button>
        <button onClick={() => setShowCsvImport(true)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 7, padding: "5px 9px", color: T.textSub, fontSize: 11, cursor: "pointer" }} title="Import from CSV">↑ CSV</button>
        <button onClick={() => setShowDead((p) => !p)} style={{ background: showDead ? (isDark ? "#1e293b" : "#f1f5f9") : "transparent", border: `1px solid ${T.border}`, borderRadius: 7, padding: "5px 9px", color: T.textSub, fontSize: 11, cursor: "pointer" }}>
          {showDead ? "Hide dead" : "Dead"}
        </button>
        <span style={{ marginLeft: "auto", fontSize: 11, color: T.textMuted }}>
          {filteredLeads.length} leads
        </span>
      </div>

      {/* Summary bar */}
      <LeadsSummaryBar summary={summary} filters={filters} onFilter={handleFilter} isDark={isDark} />

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div style={{ display: "flex", gap: 4, padding: "6px 16px", borderBottom: `1px solid ${T.border}`, flexWrap: "wrap", flexShrink: 0 }}>
          <button
            onClick={() => setTagFilter(null)}
            style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, border: `1px solid ${tagFilter === null ? T.accent : T.border}`, background: tagFilter === null ? T.accentGlow : "transparent", color: tagFilter === null ? T.accent : T.textMuted, cursor: "pointer" }}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, border: `1px solid ${tagFilter === tag ? T.accent : T.border}`, background: tagFilter === tag ? T.accentGlow : "transparent", color: tagFilter === tag ? T.accent : T.textMuted, cursor: "pointer" }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Bulk bar */}
      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          onMark={handleBulkMark}
          onClear={clear}
          onExport={() => { exportLeadsCSV(leads.filter((l) => selected.has(l.id))); clear(); }}
          onApplyHook={() => setShowHookPicker(true)}
          isDark={isDark}
        />
      )}

      {/* Table + Detail */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <LeadsTable
          leads={tagFilteredLeads}
          isDark={isDark}
          onStatusUpdate={handleStatusUpdate}
          onCopy={handleCopy}
          focusedId={focusedId}
          onFocusRow={(id) => { setFocusedId(id); setShowDetail(true); }}
          selected={selected}
          onToggleSelect={toggle}
          onSelectAll={selectAll}
        />
        {showDetail && focusedLead && (
          <LeadDetailPanel
            key={focusedLead.id}
            lead={focusedLead}
            isDark={isDark}
            onStatusUpdate={handleStatusUpdate}
            onClose={() => setShowDetail(false)}
          />
        )}
      </div>

      {/* Overlays */}
      {showAddModal && <AddLeadModal isDark={isDark} onAdd={handleAddLead} onClose={() => setShowAddModal(false)} />}
      {showCsvImport && (
        <CsvImportModal
          isDark={isDark}
          T={T}
          onImport={(newLeads) => { addLeads(newLeads); setShowCsvImport(false); }}
          onClose={() => setShowCsvImport(false)}
        />
      )}
      {showHookPicker && (
        <HookPickerModal
          selectedLeadIds={selected}
          leads={leads}
          isDark={isDark}
          T={isDark ? {
            text: "#dde8f5", textSub: "#7a8fa6", textMuted: "#3d5266",
            accent: "#2d7ef7", accentDim: "#1a4a94", border: "#1a2e45", borderLight: "#1e3a54",
            surface: "#0d1521", card: "#111d2e", bg: "#080c14",
            green: "#22c55e", amber: "#f59e0b",
          } : {
            text: "#0f172a", textSub: "#475569", textMuted: "#94a3b8",
            accent: "#4f46e5", accentDim: "#e0e7ff", border: "#e2e8f0", borderLight: "#cbd5e1",
            surface: "#ffffff", card: "#ffffff", bg: "#f1f5f9",
            green: "#16a34a", amber: "#d97706",
          }}
          onClose={() => { setShowHookPicker(false); clear(); }}
        />
      )}
      <CopyToast toast={toast} onConfirm={() => { if (toast) { handleStatusUpdate(toast.leadId, "contacted"); setToast(null); } }} onDismiss={() => setToast(null)} isDark={isDark} />
      <UndoToast undoItem={undoItem} onUndo={undo} onDismiss={dismissUndo} isDark={isDark} UNDO_WINDOW_MS={UNDO_WINDOW_MS} />
    </div>
  );
}
