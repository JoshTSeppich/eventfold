import { useState } from "react";

const EMPTY = {
  name: "", title: "", company: "",
  email: "", emailStatus: "likely",
  fitScore: "", hook: "",
};

export function AddLeadModal({ isDark, onAdd, onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  const bg     = isDark ? "#0f172a" : "#ffffff";
  const card   = isDark ? "#1e293b" : "#f8fafc";
  const border = isDark ? "#334155" : "#e2e8f0";
  const txt    = isDark ? "#e2e8f0" : "#0f172a";
  const sub    = isDark ? "#94a3b8" : "#64748b";
  const accent = isDark ? "#3b82f6" : "#2563eb";

  function set(k) {
    return (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  }

  function submit() {
    if (!form.name.trim())    return setError("Name is required.");
    if (!form.company.trim()) return setError("Company is required.");

    const lead = {
      id:             crypto.randomUUID(),
      name:           form.name.trim(),
      title:          form.title.trim(),
      company:        form.company.trim(),
      email:          form.email.trim() || null,
      emailStatus:    form.email.trim() ? form.emailStatus : "none",
      fitScore:       form.fitScore ? parseInt(form.fitScore, 10) : null,
      hook:           form.hook.trim() || null,
      outreachStatus: "new",
      contactedAt:    null,
      outreachNote:   null,
      followUpCount:  0,
      notes:          [],
      createdAt:      new Date().toISOString(),
    };

    onAdd(lead);
    onClose();
  }

  const inputStyle = {
    width: "100%", padding: "8px 10px",
    background: isDark ? "#0a0f1a" : "#ffffff",
    border: `1px solid ${border}`,
    borderRadius: 7, color: txt, fontSize: 13,
    outline: "none", fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const labelStyle = {
    display: "block", fontSize: 11, fontWeight: 600,
    color: sub, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: bg, borderRadius: 14,
        border: `1px solid ${border}`,
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        width: 420, padding: 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: txt }}>Add Lead</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: sub, cursor: "pointer", fontSize: 20 }}>×</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Name + Title */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Sarah Chen" />
            </div>
            <div>
              <label style={labelStyle}>Title</label>
              <input style={inputStyle} value={form.title} onChange={set("title")} placeholder="CTO" />
            </div>
          </div>

          {/* Company */}
          <div>
            <label style={labelStyle}>Company *</label>
            <input style={inputStyle} value={form.company} onChange={set("company")} placeholder="Acme Technologies" />
          </div>

          {/* Email + Status */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={form.email} onChange={set("email")} placeholder="sarah@acme.io" type="email" />
            </div>
            <div>
              <label style={labelStyle}>Confidence</label>
              <select
                style={{ ...inputStyle, width: "auto" }}
                value={form.emailStatus}
                onChange={set("emailStatus")}
              >
                <option value="verified">Verified</option>
                <option value="likely">Likely</option>
              </select>
            </div>
          </div>

          {/* Fit score + Hook */}
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Fit %</label>
              <input
                style={inputStyle} value={form.fitScore}
                onChange={set("fitScore")} placeholder="85"
                type="number" min="0" max="100"
              />
            </div>
            <div>
              <label style={labelStyle}>Hook / Angle</label>
              <input style={inputStyle} value={form.hook} onChange={set("hook")} placeholder="Personalized outreach angle..." />
            </div>
          </div>
        </div>

        {error && (
          <p style={{ color: "#f87171", fontSize: 12, marginTop: 12 }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "9px 0",
              background: "transparent", border: `1px solid ${border}`,
              borderRadius: 8, color: sub, fontSize: 13, cursor: "pointer",
            }}
          >Cancel</button>
          <button
            onClick={submit}
            style={{
              flex: 2, padding: "9px 0",
              background: accent, border: "none",
              borderRadius: 8, color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >Add Lead</button>
        </div>
      </div>
    </div>
  );
}
