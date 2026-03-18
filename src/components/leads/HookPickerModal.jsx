import { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";

export function HookPickerModal({ selectedLeadIds, leads, onClose, isDark, T }) {
  const { savedHooks, updateLead, incrementHookApplied } = useApp();
  const [selectedHookId, setSelectedHookId] = useState(null);
  const [applied, setApplied] = useState(false);

  const sortedHooks = [...savedHooks].sort(
    (a, b) => new Date(b.starredAt).getTime() - new Date(a.starredAt).getTime()
  );

  const selectedHook = sortedHooks.find((h) => h.id === selectedHookId) || null;
  const count = selectedLeadIds.size;

  function handleApply() {
    if (!selectedHook) return;
    selectedLeadIds.forEach((id) => {
      updateLead(id, (l) => ({ ...l, hook: selectedHook.hook }));
    });
    incrementHookApplied(selectedHook.id);
    setApplied(true);
    setTimeout(onClose, 900);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 4000,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440, maxWidth: "calc(100vw - 32px)",
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          maxHeight: "70vh",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 18px 14px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Apply Hook</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
              Apply to <strong style={{ color: T.text }}>{count}</strong> selected lead{count !== 1 ? "s" : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
          >×</button>
        </div>

        {/* Hook list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
          {sortedHooks.length === 0 ? (
            <div style={{
              padding: "32px 16px",
              textAlign: "center",
              fontSize: 13,
              color: T.textMuted,
              lineHeight: 1.7,
            }}>
              No starred hooks yet.<br />
              Run the Intel pipeline and star the hooks you like.
            </div>
          ) : (
            sortedHooks.map((hook) => {
              const isSelected = selectedHookId === hook.id;
              return (
                <div
                  key={hook.id}
                  onClick={() => setSelectedHookId(isSelected ? null : hook.id)}
                  style={{
                    background: isSelected ? T.accentDim : T.card,
                    border: `1px solid ${isSelected ? T.accent : T.border}`,
                    borderRadius: 9,
                    padding: "11px 13px",
                    marginBottom: 7,
                    cursor: "pointer",
                    transition: "border-color 0.1s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {hook.angle && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: isSelected ? T.accent : T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                          {hook.angle}
                        </div>
                      )}
                      <div style={{
                        fontSize: 12, color: T.textSub, lineHeight: 1.55,
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        {hook.hook}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      {isSelected && (
                        <span style={{ fontSize: 10, color: T.accent, fontWeight: 700 }}>✓ selected</span>
                      )}
                      {hook.appliedCount > 0 && (
                        <span style={{
                          fontSize: 10, padding: "1px 6px", borderRadius: 4,
                          background: T.surface, border: `1px solid ${T.border}`,
                          color: T.textMuted,
                        }}>
                          Used {hook.appliedCount}×
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {sortedHooks.length > 0 && (
          <div style={{
            padding: "12px 14px",
            borderTop: `1px solid ${T.border}`,
            display: "flex", gap: 8, justifyContent: "flex-end",
            flexShrink: 0,
          }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px", borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: "transparent", color: T.textSub,
                fontSize: 12, cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedHook || applied}
              style={{
                padding: "8px 18px", borderRadius: 8,
                border: "none",
                background: applied ? T.green : (!selectedHook ? T.border : T.accent),
                color: !selectedHook && !applied ? T.textMuted : "#fff",
                fontSize: 12, fontWeight: 700,
                cursor: !selectedHook ? "default" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {applied ? "Applied ✓" : `Apply to ${count} lead${count !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
