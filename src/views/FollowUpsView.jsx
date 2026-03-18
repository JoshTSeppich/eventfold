import { useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../context/AppContext.jsx";
import { relativeTime } from "../utils/relativeTime.js";
import { STALE_THRESHOLD_MS } from "../constants/outreach.js";

const STATUS_COLORS = {
  contacted:  { bg: "#1e3a5f", fg: "#60a5fa" },
  responded:  { bg: "#14532d", fg: "#4ade80" },
  qualified:  { bg: "#3b1060", fg: "#c084fc" },
};

export function FollowUpsView({ T, onSwitchToLeads }) {
  const { leads, updateLead } = useApp();
  // Leads that need attention: contacted > 5d ago, responded, or qualified (not dead/new)
  const followUps = useMemo(() => {
    return leads
      .filter(l => l.outreachStatus !== "new" && l.outreachStatus !== "dead")
      .map(l => {
        const now = Date.now();  // computed per-evaluation, not stale
        const age = l.contactedAt ? now - new Date(l.contactedAt).getTime() : 0;
        const isStale = l.outreachStatus === "contacted" && age > STALE_THRESHOLD_MS;
        return { ...l, age, isStale };
      })
      .sort((a, b) => {
        if (a.isStale !== b.isStale) return a.isStale ? -1 : 1;
        return b.age - a.age;
      });
  }, [leads]);

  const staleCount = followUps.filter(l => l.isStale).length;

  const openFollowUpMailto = (lead) => {
    const email   = lead.email || "";
    const subject = encodeURIComponent(`Following up`);
    const body    = encodeURIComponent(`Hi ${lead.name?.split(" ")[0] || "there"},\n\nJust circling back on my previous email…\n\n`);
    invoke("open_url", { url: `mailto:${email}?subject=${subject}&body=${body}` });
  };

  if (followUps.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 48, color: T.textMuted, background: T.bg }}>
        <div style={{ fontSize: 44, marginBottom: 16, opacity: 0.12 }}>✓</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub, marginBottom: 8 }}>All clear</div>
        <div style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 300 }}>
          No active threads to follow up on.<br />
          Start reaching out from the <button onClick={onSwitchToLeads} style={{ color: T.accent, background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0 }}>Leads tab</button>.
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg }}>
      {/* Header */}
      <div style={{ padding: "16px 24px 12px", borderBottom: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0 }}>Follow-ups</h2>
          <span style={{ fontSize: 13, color: T.textMuted }}>{followUps.length} active</span>
          {staleCount > 0 && (
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 5, background: T.amberDim, color: T.amber, fontWeight: 700 }}>
              {staleCount} overdue
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: T.textMuted, margin: "4px 0 0" }}>
          Leads you've contacted — track replies and nudge stale threads.
        </p>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: T.surface, borderBottom: `1px solid ${T.border}` }}>
              {["Lead", "Status", "Contacted", "Follow-ups", "Actions"].map(h => (
                <th key={h} style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {followUps.map(lead => {
              const col = STATUS_COLORS[lead.outreachStatus] || { bg: T.surface, fg: T.textSub };
              return (
                <tr
                  key={lead.id}
                  style={{
                    borderBottom: `1px solid ${T.border}`,
                    borderLeft: lead.isStale ? `3px solid ${T.amber}` : "3px solid transparent",
                    background: lead.isStale ? `${T.amber}08` : "transparent",
                  }}
                >
                  {/* Lead */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, color: T.text }}>{lead.name}</div>
                    <div style={{ fontSize: 11, color: T.textSub }}>{lead.title} · {lead.company}</div>
                  </td>

                  {/* Status */}
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, background: col.bg, color: col.fg, fontWeight: 700 }}>
                      {lead.outreachStatus}
                    </span>
                    {lead.isStale && (
                      <div style={{ fontSize: 10, color: T.amber, marginTop: 3 }}>⚠ Stale — 5+ days</div>
                    )}
                  </td>

                  {/* Contacted */}
                  <td style={{ padding: "12px 16px", color: T.textSub, fontSize: 12, whiteSpace: "nowrap" }}>
                    {lead.contactedAt ? relativeTime(lead.contactedAt) : "—"}
                  </td>

                  {/* Follow-up count */}
                  <td style={{ padding: "12px 16px", color: T.textSub, fontSize: 12 }}>
                    {lead.followUpCount > 0 ? (
                      <span style={{ padding: "2px 8px", borderRadius: 4, background: T.card, border: `1px solid ${T.border}` }}>
                        {lead.followUpCount}×
                      </span>
                    ) : "—"}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {lead.email && (
                        <button
                          onClick={() => {
                            openFollowUpMailto(lead);
                            updateLead(lead.id, l => ({
                              ...l,
                              followUpCount: (l.followUpCount || 0) + 1,
                              lastFollowUpAt: new Date().toISOString(),
                            }));
                          }}
                          style={{
                            padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: T.accentDim, color: T.accent,
                            border: "none", cursor: "pointer", display: "inline-block",
                          }}
                        >
                          Follow up ↗
                        </button>
                      )}
                      <button
                        onClick={() => updateLead(lead.id, l => ({ ...l, outreachStatus: "responded" }))}
                        title="Mark as replied"
                        style={{
                          padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: "transparent", border: `1px solid ${T.border}`,
                          color: T.textSub, cursor: "pointer",
                        }}
                      >
                        Got reply ✓
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
