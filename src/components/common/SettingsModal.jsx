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
