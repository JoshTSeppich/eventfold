import { useApp }            from "../context/AppContext.jsx";
import { STALE_THRESHOLD_MS } from "../constants/outreach.js";
import { useDailyStats }      from "../hooks/useDailyStats.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(ts) {
  return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
}

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function openMailto(email, name = "") {
  const subject = encodeURIComponent(`Following up — ${name}`);
  window.open(`mailto:${email}?subject=${subject}`, "_blank");
}

// ─── Small shared UI pieces ───────────────────────────────────────────────────

function FitBadge({ score, T }) {
  if (score == null) return null;
  const color =
    score >= 80 ? T.green :
    score >= 50 ? T.amber :
    T.red;
  const dimColor =
    score >= 80 ? T.greenDim :
    score >= 50 ? T.amberDim :
    T.redDim;
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      padding: "2px 7px",
      borderRadius: 99,
      background: dimColor,
      color,
      flexShrink: 0,
    }}>
      {score}
    </span>
  );
}

function SectionHeader({ title, count, T }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
        {title}
      </span>
      {count > 0 && (
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          padding: "1px 7px",
          borderRadius: 99,
          background: T.accentDim,
          color: T.accent,
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({ message, T }) {
  return (
    <div style={{
      padding: "14px 0",
      fontSize: 13,
      color: T.textMuted,
      fontStyle: "italic",
    }}>
      {message}
    </div>
  );
}

function ActionButton({ label, onClick, T, variant = "primary" }) {
  const isPrimary = variant === "primary";
  const isDanger  = variant === "danger";
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 500,
        padding: "4px 11px",
        borderRadius: 6,
        border: isPrimary
          ? "none"
          : isDanger
            ? `1px solid ${T.red}44`
            : `1px solid ${T.green}44`,
        background: isPrimary
          ? T.accent
          : isDanger
            ? T.redDim
            : T.greenDim,
        color: isPrimary
          ? "#fff"
          : isDanger
            ? T.red
            : T.green,
        cursor: "pointer",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

function Divider({ T }) {
  return (
    <div style={{
      height: 1,
      background: T.borderLight,
      margin: "20px 0",
    }} />
  );
}

// ─── Section 1: Ready to contact ─────────────────────────────────────────────

function ReadySection({ leads, updateLead, T, onContact }) {
  const ready = leads
    .filter((l) => l.outreachStatus === "new" && l.email)
    .sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1))
    .slice(0, 10);

  const handleContact = (lead) => {
    openMailto(lead.email, lead.name.split(" ")[0]);
    updateLead(lead.id, (l) => ({
      ...l,
      outreachStatus: "contacted",
      contactedAt: Date.now(),
    }));
    onContact?.();
  };

  return (
    <div>
      <SectionHeader title="Ready to contact" count={ready.length} T={T} />

      {ready.length === 0 ? (
        <EmptyState message="No uncontacted leads with emails — run Intel to find more" T={T} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {ready.map((lead) => (
            <div
              key={lead.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                borderRadius: 8,
                background: T.surface,
                border: `1px solid ${T.borderLight}`,
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: T.accent + "22",
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

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {lead.name}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {[lead.title, lead.company].filter(Boolean).join(" · ")}
                </div>
              </div>

              <FitBadge score={lead.fitScore} T={T} />

              {/* Email chip */}
              <span style={{
                fontSize: 11,
                padding: "2px 7px",
                borderRadius: 5,
                background: T.greenDim,
                color: T.green,
                maxWidth: 140,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}>
                ✉ {lead.email}
              </span>

              <ActionButton label="Contact →" onClick={() => handleContact(lead)} T={T} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section 2: Needs follow-up ───────────────────────────────────────────────

function FollowUpSection({ leads, updateLead, T }) {
  const stale = leads.filter(
    (l) =>
      l.outreachStatus === "contacted" &&
      l.contactedAt &&
      Date.now() - l.contactedAt > STALE_THRESHOLD_MS
  );

  const handleFollowUp = (lead) => {
    if (lead.email) openMailto(lead.email, lead.name.split(" ")[0]);
    updateLead(lead.id, (l) => ({
      ...l,
      followUpCount: (l.followUpCount || 0) + 1,
      lastFollowUpAt: Date.now(),
    }));
  };

  return (
    <div>
      <SectionHeader title="Needs follow-up" count={stale.length} T={T} />

      {stale.length === 0 ? (
        <EmptyState message="No stale threads — all clear ✓" T={T} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {stale.map((lead) => {
            const days = daysAgo(lead.contactedAt);
            return (
              <div
                key={lead.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: T.surface,
                  border: `1px solid ${T.borderLight}`,
                }}
              >
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: T.amberDim,
                  color: T.amber,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {getInitials(lead.name)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {lead.name}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>
                    {lead.company}
                  </div>
                </div>

                <span style={{ fontSize: 11, color: T.amber, whiteSpace: "nowrap", flexShrink: 0 }}>
                  contacted {days}d ago
                </span>

                {lead.followUpCount > 0 && (
                  <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>
                    {lead.followUpCount}× FU
                  </span>
                )}

                <ActionButton label="Follow up →" onClick={() => handleFollowUp(lead)} T={T} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Section 3: Awaiting qualification ───────────────────────────────────────

function QualifySection({ leads, updateLead, T }) {
  const responded = leads.filter((l) => l.outreachStatus === "responded");

  const handleQualified = (lead) => {
    updateLead(lead.id, (l) => ({ ...l, outreachStatus: "qualified", qualifiedAt: Date.now() }));
  };

  const handleDead = (lead) => {
    updateLead(lead.id, (l) => ({ ...l, outreachStatus: "dead", deadAt: Date.now() }));
  };

  return (
    <div>
      <SectionHeader title="Awaiting qualification" count={responded.length} T={T} />

      {responded.length === 0 ? (
        <EmptyState message="No replies to qualify yet" T={T} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {responded.map((lead) => (
            <div
              key={lead.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                borderRadius: 8,
                background: T.surface,
                border: `1px solid ${T.borderLight}`,
              }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#2e106544",
                color: "#c4b5fd",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {getInitials(lead.name)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {lead.name}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted }}>
                  {lead.company}
                </div>
              </div>

              {/* Responded pill */}
              <span style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 7px",
                borderRadius: 99,
                background: "#2e1065",
                color: "#c4b5fd",
                flexShrink: 0,
              }}>
                ↩ Replied
              </span>

              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <ActionButton label="Qualified ✓" onClick={() => handleQualified(lead)} T={T} variant="success" />
                <ActionButton label="Dead ✗"      onClick={() => handleDead(lead)}      T={T} variant="danger" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Daily goal bar ───────────────────────────────────────────────────────────

function DailyGoalBar({ T }) {
  const { stats, goal } = useDailyStats();
  const pct = Math.min((stats.contacted / goal) * 100, 100);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 12, color: T.textMuted, whiteSpace: "nowrap" }}>
        Daily goal
      </span>
      <div style={{
        flex: 1,
        height: 6,
        borderRadius: 99,
        background: T.borderLight,
        overflow: "hidden",
        maxWidth: 120,
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: pct >= 100 ? T.green : T.accent,
          borderRadius: 99,
          transition: "width 0.3s ease",
        }} />
      </div>
      <span style={{ fontSize: 12, color: T.textSub, whiteSpace: "nowrap" }}>
        {stats.contacted} / {goal}
      </span>
    </div>
  );
}

// ─── TodayView ────────────────────────────────────────────────────────────────

export function TodayView({ T, onSwitchTab }) {
  const { leads, updateLead } = useApp();
  const { increment: incrementContacted } = useDailyStats();

  const readyCount     = leads.filter((l) => l.outreachStatus === "new" && l.email).length;
  const staleCount     = leads.filter(
    (l) => l.outreachStatus === "contacted" && l.contactedAt && Date.now() - l.contactedAt > STALE_THRESHOLD_MS
  ).length;
  const respondedCount = leads.filter((l) => l.outreachStatus === "responded").length;
  const totalPending   = Math.min(readyCount, 10) + staleCount + respondedCount;

  const allEmpty = readyCount === 0 && staleCount === 0 && respondedCount === 0;

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: T.bg,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px 14px",
        borderBottom: `1px solid ${T.border}`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>
              Today
            </h2>
            <span style={{ fontSize: 13, color: T.textMuted }}>
              {todayLabel}
            </span>
            {totalPending > 0 && (
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "1px 7px",
                borderRadius: 99,
                background: T.accentDim,
                color: T.accent,
              }}>
                {totalPending} pending
              </span>
            )}
          </div>
        </div>

        <DailyGoalBar T={T} />
      </div>

      {/* Body */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "20px 24px",
      }}>
        {allEmpty ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            minHeight: 300,
            gap: 8,
          }}>
            <div style={{ fontSize: 32 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>
              You're all caught up!
            </div>
            <div style={{ fontSize: 13, color: T.textMuted }}>
              Nothing pending — run Intel to surface new leads.
            </div>
          </div>
        ) : (
          <>
            <ReadySection
              leads={leads}
              updateLead={updateLead}
              T={T}
              onContact={incrementContacted}
            />

            <Divider T={T} />

            <FollowUpSection
              leads={leads}
              updateLead={updateLead}
              T={T}
            />

            <Divider T={T} />

            <QualifySection
              leads={leads}
              updateLead={updateLead}
              T={T}
            />
          </>
        )}
      </div>
    </div>
  );
}
