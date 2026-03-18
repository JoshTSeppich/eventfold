import { useState, useEffect, useCallback } from "react";
import { AppProvider, useApp } from "./context/AppContext.jsx";
import { LeadsView }      from "./views/LeadsView.jsx";
import { IntelView }      from "./views/IntelView.jsx";
import { EmailView }      from "./views/EmailView.jsx";
import { FeaturesView }   from "./views/FeaturesView.jsx";
import { FollowUpsView }  from "./views/FollowUpsView.jsx";
import { AnalyticsView }  from "./views/AnalyticsView.jsx";
import { TodayView }      from "./views/TodayView.jsx";
import { SettingsModal }  from "./components/common/SettingsModal.jsx";
import { CommandPalette } from "./components/common/CommandPalette.jsx";
import { TemplateManager } from "./components/common/TemplateManager.jsx";
import { useDailyStats }  from "./hooks/useDailyStats.js";

// ─── Theme tokens ─────────────────────────────────────────────────────────────

const DARK = {
  bg:          "#080c14",
  surface:     "#0d1521",
  card:        "#111d2e",
  cardHover:   "#152237",
  border:      "#1a2e45",
  borderLight: "#1e3a54",
  text:        "#dde8f5",
  textSub:     "#7a8fa6",
  textMuted:   "#3d5266",
  accent:      "#2d7ef7",
  accentDim:   "#1a4a94",
  accentGlow:  "rgba(45,126,247,0.15)",
  green:       "#22c55e",
  greenDim:    "#14532d",
  amber:       "#f59e0b",
  amberDim:    "#451a03",
  red:         "#ef4444",
  redDim:      "#450a0a",
};

const LIGHT = {
  bg:          "#f1f5f9",
  surface:     "#ffffff",
  card:        "#ffffff",
  cardHover:   "#f8fafc",
  border:      "#e2e8f0",
  borderLight: "#cbd5e1",
  text:        "#0f172a",
  textSub:     "#475569",
  textMuted:   "#94a3b8",
  accent:      "#4f46e5",
  accentDim:   "#e0e7ff",
  accentGlow:  "rgba(79,70,229,0.08)",
  green:       "#16a34a",
  greenDim:    "#dcfce7",
  amber:       "#d97706",
  amberDim:    "#fef3c7",
  red:         "#dc2626",
  redDim:      "#fee2e2",
};

// ─── Nav tabs ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "intel",     label: "Intel",      icon: "◎" },
  { id: "leads",     label: "Leads",      icon: "◈" },
  { id: "followups", label: "Follow-ups", icon: "↩" },
  { id: "email",     label: "Email",      icon: "✉" },
  { id: "analytics", label: "Analytics",  icon: "◷" },
  { id: "features",  label: "Features",   icon: "◇" },
  { id: "today",     label: "Today",      icon: "✦" },
];

// ─── Global styles ────────────────────────────────────────────────────────────
const styleTag = document.createElement("style");
styleTag.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  * { box-sizing: border-box; }
  body { margin: 0; overflow: hidden; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(100,120,160,0.3); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(100,120,160,0.55); }
`;
document.head.appendChild(styleTag);

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell() {
  const { isDark, setIsDark, leads } = useApp();
  const T = isDark ? DARK : LIGHT;

  const [activeTab,        setActiveTab]        = useState("intel");
  const [showSettings,     setShowSettings]     = useState(false);
  const [showCmdPalette,   setShowCmdPalette]   = useState(false);
  const [showTemplatesMgr, setShowTemplatesMgr] = useState(false);

  const { stats: dailyStats, goal } = useDailyStats();
  const todayCount = dailyStats.contacted || 0;

  // ── ⌘K keyboard shortcut ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCmdPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Badges ────────────────────────────────────────────────────────────────
  const followUpBadge = leads.filter(l => {
    if (l.outreachStatus !== "contacted" || !l.contactedAt) return false;
    return Date.now() - new Date(l.contactedAt).getTime() > 5 * 24 * 3600 * 1000;
  }).length;

  const leadsBadge = leads.filter(l => l.outreachStatus === "new" && l.email).length;

  const respondedBadge = leads.filter(l => l.outreachStatus === "responded").length;

  const badges = {
    leads:     leadsBadge    > 0 ? leadsBadge    : null,
    followups: followUpBadge > 0 ? followUpBadge : null,
    today:     (followUpBadge + respondedBadge) > 0 ? (followUpBadge + respondedBadge) : null,
  };

  const handleSendToLeads = useCallback(() => {
    setActiveTab("leads");
  }, []);

  const switchTab = useCallback((tabId) => {
    if (tabId === "settings") { setShowSettings(true); return; }
    if (tabId === "templates") { setShowTemplatesMgr(true); return; }
    setActiveTab(tabId);
    setShowCmdPalette(false);
  }, []);

  const btnStyle = {
    width: 30, height: 30, borderRadius: 8,
    background: "transparent", border: `1px solid ${T.border}`,
    color: T.textSub, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.1s",
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      width: "100vw", height: "100vh",
      background: T.bg, color: T.text,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* ── Titlebar / Nav ───────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center",
        height: 48, flexShrink: 0,
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        paddingLeft: 16, paddingRight: 12,
        gap: 4,
        WebkitAppRegion: "drag",
      }}>
        {/* Wordmark */}
        <div style={{
          fontSize: 13, fontWeight: 800, color: T.text,
          letterSpacing: "-0.01em", marginRight: 14,
          WebkitAppRegion: "no-drag", userSelect: "none", flexShrink: 0,
        }}>
          event<span style={{ color: T.accent }}>fold</span>
        </div>

        {/* Nav tabs */}
        <nav style={{ display: "flex", gap: 1, flex: 1, WebkitAppRegion: "no-drag", overflow: "hidden" }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const badge    = badges[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", borderRadius: 7, flexShrink: 0,
                  background: isActive ? T.accentGlow : "transparent",
                  border: isActive ? `1px solid ${T.accentDim}` : "1px solid transparent",
                  color: isActive ? T.accent : T.textSub,
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  cursor: "pointer", transition: "all 0.1s",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = T.textSub; }}
              >
                <span style={{ fontSize: 11, opacity: 0.75 }}>{tab.icon}</span>
                {tab.label}
                {badge != null && (
                  <span style={{
                    fontSize: 9, fontWeight: 800,
                    padding: "1px 5px", borderRadius: 10,
                    background: tab.id === "followups" ? T.amber : T.accent,
                    color: "#fff", lineHeight: 1.4, minWidth: 16, textAlign: "center",
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, WebkitAppRegion: "no-drag" }}>
          {/* ⌘K hint */}
          <button
            onClick={() => setShowCmdPalette(true)}
            title="Command palette (⌘K)"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 7,
              background: "transparent", border: `1px solid ${T.border}`,
              color: T.textMuted, cursor: "pointer", fontSize: 11,
              transition: "all 0.1s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; }}
          >
            ⌘K
          </button>

          {/* Daily goal pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "3px 10px", borderRadius: 20,
            background: T.card, border: `1px solid ${T.border}`,
            fontSize: 11, color: T.textSub,
          }}>
            <span style={{ fontWeight: 700, color: todayCount >= goal ? T.green : T.text }}>{todayCount}</span>
            <span style={{ color: T.textMuted }}>/ {goal}</span>
            <div style={{ width: 32, height: 4, borderRadius: 2, background: T.border, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, (todayCount / goal) * 100)}%`,
                background: todayCount >= goal ? T.green : T.accent,
                borderRadius: 2, transition: "width 0.3s",
              }} />
            </div>
          </div>

          {/* Templates */}
          <button
            onClick={() => setShowTemplatesMgr(true)}
            title="Manage templates"
            style={{ ...btnStyle, fontSize: 13 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub; }}
          >
            ≡
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setIsDark(d => !d)}
            title={isDark ? "Light mode" : "Dark mode"}
            style={{ ...btnStyle, fontSize: 14 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub; }}
          >
            {isDark ? "☀" : "☾"}
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            title="Settings (API keys)"
            style={{ ...btnStyle, fontSize: 15 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub; }}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* ── Views ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "intel"     && <IntelView     T={T} onSendToLeads={handleSendToLeads} />}
        {activeTab === "leads"     && <LeadsView      T={T} />}
        {activeTab === "followups" && <FollowUpsView  T={T} onSwitchToLeads={() => setActiveTab("leads")} />}
        {activeTab === "email"     && <EmailView      T={T} />}
        {activeTab === "analytics" && <AnalyticsView  T={T} />}
        {activeTab === "features"  && <FeaturesView   T={T} />}
        {activeTab === "today"     && <TodayView      T={T} onSwitchTab={switchTab} />}
      </div>

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      {showSettings    && <SettingsModal    T={T} onClose={() => setShowSettings(false)} />}
      {showTemplatesMgr && <TemplateManager T={T} onClose={() => setShowTemplatesMgr(false)} />}
      {showCmdPalette  && <CommandPalette   T={T} onClose={() => setShowCmdPalette(false)} onSwitchTab={switchTab} />}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
