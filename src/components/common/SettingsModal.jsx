import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../../context/AppContext.jsx";

export function SettingsModal({ T, onClose }) {
  const { settings, updateSettings, savedHooks, unstarHook } = useApp();

  const [anthropicKey,  setAnthropicKey]  = useState(settings.anthropicKey  || "");
  const [apolloKey,     setApolloKey]     = useState(settings.apolloKey     || "");
  const [githubPat,     setGithubPat]     = useState("");
  const [senderName,    setSenderName]    = useState(settings.senderName    || "");
  const [ghPatExists,   setGhPatExists]   = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [bookingUrl,    setBookingUrl]    = useState(settings.bookingUrl || "");
  const [weeklyGoal,    setWeeklyGoal]    = useState(settings.weeklyGoal ?? 250);
  const [suppressList,  setSuppressList]  = useState([]);
  const [suppressInput, setSuppressInput] = useState("");
  const [suppressType,  setSuppressType]  = useState("email");

  useEffect(() => {
    // Pre-load from keychain on open
    invoke("get_credential", { key: "anthropic_key" })
      .then(v => { if (v && !anthropicKey) setAnthropicKey(v); })
      .catch(() => {});
    invoke("get_credential", { key: "apollo_key" })
      .then(v => { if (v && !apolloKey) setApolloKey(v); })
      .catch(() => {});
    invoke("get_credential", { key: "github_pat" })
      .then(v => { if (v) setGhPatExists(true); })
      .catch(() => {});
    invoke("get_suppress_list").then(list => setSuppressList(list || [])).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    // Persist API keys to keychain + app settings
    if (anthropicKey.trim()) {
      try { await invoke("save_credential", { key: "anthropic_key", value: anthropicKey }); } catch {}
      updateSettings({ anthropicKey: anthropicKey.trim() });
    }
    if (apolloKey.trim()) {
      try { await invoke("save_credential", { key: "apollo_key", value: apolloKey }); } catch {}
      updateSettings({ apolloKey: apolloKey.trim() });
    }
    if (githubPat.trim()) {
      try { await invoke("save_credential", { key: "github_pat", value: githubPat }); setGhPatExists(true); } catch {}
    }
    if (senderName.trim()) {
      updateSettings({ senderName: senderName.trim() });
    }
    updateSettings({ bookingUrl: bookingUrl.trim(), weeklyGoal: weeklyGoal || 250 });

    setSaved(true);
    setTimeout(onClose, 700);
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px",
    background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: 8, color: T.text, fontSize: 13,
    outline: "none", fontFamily: "monospace",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: T.textSub,
    display: "block", marginBottom: 6,
  };

  const Section = ({ children, top }) => (
    <div style={{ marginTop: top ?? 18 }}>{children}</div>
  );

  const handleAddSuppress = async () => {
    const entry = suppressInput.trim();
    if (!entry) return;
    try {
      const id = await invoke("add_to_suppress_list", { entry, entryType: suppressType });
      setSuppressList(prev => [{ id, entry, entry_type: suppressType, created_at: new Date().toISOString() }, ...prev]);
      setSuppressInput("");
    } catch (e) { console.error("add suppress:", e); }
  };

  const handleRemoveSuppress = async (id) => {
    try {
      await invoke("remove_from_suppress_list", { id });
      setSuppressList(prev => prev.filter(i => i.id !== id));
    } catch (e) { console.error("remove suppress:", e); }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}
      onClick={onClose}
    >
      <div
        style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, width: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.35)", maxHeight: "90vh", overflow: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text, margin: 0 }}>Settings</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.textSub, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 22 }}>
          Credentials saved to OS keychain — never written to disk as plaintext.
        </p>

        {/* Anthropic API key */}
        <Section top={0}>
          <label style={labelStyle}>Anthropic API Key</label>
          <input
            type="password"
            value={anthropicKey}
            onChange={e => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-api03-…"
            style={inputStyle}
          />
          <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>Used for Intel pipeline and Email drafting —</span>
            <button
              onClick={() => invoke("open_url", { url: "https://console.anthropic.com/settings/keys" })}
              style={{ fontSize: 12, color: T.accent, background: "none", border: "none", padding: 0, cursor: "pointer" }}
              onMouseEnter={e => e.target.style.textDecoration = "underline"}
              onMouseLeave={e => e.target.style.textDecoration = "none"}
            >
              Get key →
            </button>
          </div>
        </Section>

        {/* Apollo API key */}
        <Section>
          <label style={labelStyle}>Apollo.io API Key</label>
          <input
            type="password"
            value={apolloKey}
            onChange={e => setApolloKey(e.target.value)}
            placeholder="TlHGetzV…"
            style={inputStyle}
          />
          <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>Used for contact search in Intel —</span>
            <button
              onClick={() => invoke("open_url", { url: "https://app.apollo.io/#/settings/integrations/api" })}
              style={{ fontSize: 12, color: T.accent, background: "none", border: "none", padding: 0, cursor: "pointer" }}
              onMouseEnter={e => e.target.style.textDecoration = "underline"}
              onMouseLeave={e => e.target.style.textDecoration = "none"}
            >
              Get key →
            </button>
          </div>
        </Section>

        {/* GitHub PAT */}
        <Section>
          <label style={labelStyle}>
            GitHub Personal Access Token
            {ghPatExists && !githubPat && (
              <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 6px", borderRadius: 4, background: T.greenDim, color: T.green, fontWeight: 700 }}>
                Saved
              </span>
            )}
          </label>
          <input
            type="password"
            value={githubPat}
            onChange={e => setGithubPat(e.target.value)}
            placeholder={ghPatExists ? "●●●●●●●●●●●●●●●● (leave blank to keep)" : "ghp_…"}
            style={inputStyle}
          />
          <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>
              Needs <code style={{ fontSize: 11, background: T.bg, padding: "1px 4px", borderRadius: 3 }}>repo</code> scope —
            </span>
            <button
              onClick={() => invoke("open_url", { url: "https://github.com/settings/tokens/new" })}
              style={{ fontSize: 12, color: T.accent, background: "none", border: "none", padding: 0, cursor: "pointer" }}
              onMouseEnter={e => e.target.style.textDecoration = "underline"}
              onMouseLeave={e => e.target.style.textDecoration = "none"}
            >
              Create token →
            </button>
          </div>
        </Section>

        {/* Sender name */}
        <Section>
          <label style={{ ...labelStyle, fontFamily: "inherit" }}>Your Name <span style={{ fontWeight: 400, color: T.textMuted }}>(for email sign-offs)</span></label>
          <input
            type="text"
            value={senderName}
            onChange={e => setSenderName(e.target.value)}
            placeholder="Josh Tseppich"
            style={{ ...inputStyle, fontFamily: "inherit" }}
          />
        </Section>

        {/* Booking URL */}
        <Section>
          <label style={{ ...labelStyle, fontFamily: "inherit" }}>Booking URL <span style={{ fontWeight: 400, color: T.textMuted }}>(e.g. Calendly link for email CTAs)</span></label>
          <input
            type="text"
            value={bookingUrl}
            onChange={e => setBookingUrl(e.target.value)}
            placeholder="https://calendly.com/yourname/30min"
            style={{ ...inputStyle, fontFamily: "inherit" }}
          />
        </Section>

        {/* Weekly goal */}
        <Section>
          <label style={{ ...labelStyle, fontFamily: "inherit" }}>Weekly Outreach Goal <span style={{ fontWeight: 400, color: T.textMuted }}>(contacts/week)</span></label>
          <input
            type="number"
            min="1"
            max="9999"
            value={weeklyGoal}
            onChange={e => setWeeklyGoal(parseInt(e.target.value, 10) || 0)}
            style={{ ...inputStyle, fontFamily: "inherit", width: 120 }}
          />
        </Section>

        {/* Suppress list */}
        <Section>
          <label style={labelStyle}>Suppress List ({suppressList.length})</label>
          <p style={{ fontSize: 11, color: T.textMuted, margin: "0 0 10px" }}>
            Contacts, emails, or domains here are never shown in Intel results.
          </p>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input
              type="text"
              value={suppressInput}
              onChange={e => setSuppressInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAddSuppress(); }}
              placeholder="email@example.com or example.com"
              style={{ ...inputStyle, flex: 1, fontSize: 12 }}
            />
            <select
              value={suppressType}
              onChange={e => setSuppressType(e.target.value)}
              style={{ ...inputStyle, width: 90, fontFamily: "inherit" }}
            >
              <option value="email">Email</option>
              <option value="domain">Domain</option>
              <option value="company">Company</option>
            </select>
            <button
              onClick={handleAddSuppress}
              disabled={!suppressInput.trim()}
              style={{ padding: "8px 14px", borderRadius: 7, border: "none", background: T.accent, color: "#fff", fontSize: 12, fontWeight: 600, cursor: suppressInput.trim() ? "pointer" : "not-allowed", opacity: suppressInput.trim() ? 1 : 0.5, whiteSpace: "nowrap" }}
            >
              + Add
            </button>
          </div>
          {suppressList.length > 0 && (
            <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {suppressList.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6 }}>
                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: T.surface, color: T.textMuted, fontWeight: 600, textTransform: "uppercase", flexShrink: 0 }}>
                    {item.entry_type}
                  </span>
                  <span style={{ flex: 1, fontSize: 12, color: T.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.entry}
                  </span>
                  <button
                    onClick={() => handleRemoveSuppress(item.id)}
                    style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = T.red}
                    onMouseLeave={e => e.currentTarget.style.color = T.textMuted}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Saved Hooks */}
        {savedHooks.length > 0 && (
          <Section>
            <label style={labelStyle}>Saved Hooks ({savedHooks.length})</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
              {savedHooks.map((hook) => (
                <div
                  key={hook.id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 8,
                    padding: "8px 10px",
                    background: T.bg, border: `1px solid ${T.border}`,
                    borderRadius: 8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {hook.angle && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                        {hook.angle}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.5 }}>{hook.hook}</div>
                    {hook.appliedCount > 0 && (
                      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>Used {hook.appliedCount}×</div>
                    )}
                  </div>
                  <button
                    onClick={() => unstarHook(hook.id)}
                    title="Remove hook"
                    style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0 }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = T.red; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = T.textMuted; }}
                  >×</button>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${T.border}`, background: "transparent", color: T.textSub, fontSize: 13, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "8px 22px", borderRadius: 8, border: "none",
              background: saved ? T.green : T.accent,
              color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
