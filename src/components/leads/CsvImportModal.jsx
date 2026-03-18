import { useState, useRef, useCallback } from "react";
import { parseCSV, FIELD_MAP, autoDetectColumns } from "../../utils/parseCSV.js";

const FIELD_LABELS = {
  name: "Name *",
  email: "Email",
  title: "Job Title",
  company: "Company",
  linkedinUrl: "LinkedIn URL",
  location: "Location",
  companySize: "Company Size",
  industry: "Industry",
};

export function CsvImportModal({ isDark, T, onImport, onClose }) {
  const [step, setStep] = useState("upload"); // "upload" | "map" | "preview"
  const [parsed, setParsed] = useState(null);   // { headers, rows }
  const [mapping, setMapping] = useState({});    // { field: colIndex }
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  // ── File handling ────────────────────────────────────────────────────────────

  function handleFile(file) {
    if (!file) return;
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setError("Please upload a .csv file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = parseCSV(e.target.result);
      if (result.headers.length === 0) { setError("Could not parse CSV — check the file format"); return; }
      setParsed(result);
      setMapping(autoDetectColumns(result.headers));
      setError(null);
      setStep("map");
    };
    reader.readAsText(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  // ── Build leads from mapping ──────────────────────────────────────────────────

  function buildLeads() {
    if (!parsed) return [];
    return parsed.rows
      .filter((row) => {
        const nameIdx = mapping.name;
        return nameIdx != null && row[nameIdx]?.trim();
      })
      .map((row) => {
        const get = (field) => (mapping[field] != null ? (row[mapping[field]] || "").trim() : "");
        return {
          name:        get("name"),
          email:       get("email") || null,
          title:       get("title"),
          company:     get("company"),
          linkedinUrl: get("linkedinUrl") || null,
          location:    get("location"),
          companySize: get("companySize"),
          industry:    get("industry"),
          source:      "csv",
        };
      });
  }

  const previewLeads = buildLeads().slice(0, 5);
  const totalLeads   = buildLeads().length;

  // ── Render ────────────────────────────────────────────────────────────────────

  const overlay = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.65)",
    display: "flex", alignItems: "center", justifyContent: "center",
  };

  const modal = {
    width: 520, maxWidth: "calc(100vw - 32px)",
    background: T.card, border: `1px solid ${T.border}`,
    borderRadius: 12, boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
    display: "flex", flexDirection: "column", maxHeight: "80vh",
    overflow: "hidden",
  };

  const header = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Import from CSV</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: T.textMuted }}>✕</button>
    </div>
  );

  if (step === "upload") return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        {header}
        <div style={{ padding: 20, flex: 1, overflowY: "auto" }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? T.accent : T.border}`,
              borderRadius: 10, padding: "36px 20px",
              textAlign: "center", cursor: "pointer",
              background: dragging ? (isDark ? "#0a1628" : "#eff6ff") : "transparent",
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>Drop a CSV file here</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>or click to browse</div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
          </div>
          {error && <div style={{ marginTop: 10, fontSize: 12, color: isDark ? "#f87171" : "#dc2626" }}>{error}</div>}
          <div style={{ marginTop: 16, fontSize: 11, color: T.textMuted }}>
            Expected columns: Name, Email, Title, Company, LinkedIn URL (order doesn't matter)
          </div>
        </div>
      </div>
    </div>
  );

  if (step === "map") return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        {header}
        <div style={{ padding: 20, flex: 1, overflowY: "auto" }}>
          <div style={{ fontSize: 12, color: T.textSub, marginBottom: 16 }}>
            Map your CSV columns ({parsed.rows.length} rows detected)
          </div>
          {Object.entries(FIELD_LABELS).map(([field, label]) => (
            <div key={field} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 120, fontSize: 12, fontWeight: 500, color: field === "name" ? T.text : T.textSub, flexShrink: 0 }}>
                {label}
              </div>
              <select
                value={mapping[field] != null ? mapping[field] : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setMapping((prev) => {
                    const next = { ...prev };
                    if (v === "") delete next[field];
                    else next[field] = parseInt(v, 10);
                    return next;
                  });
                }}
                style={{
                  flex: 1, padding: "5px 8px", fontSize: 12,
                  background: isDark ? "#0a0f1a" : "#ffffff",
                  border: `1px solid ${T.border}`, borderRadius: 6,
                  color: T.text, outline: "none",
                }}
              >
                <option value="">— skip —</option>
                {parsed.headers.map((h, i) => (
                  <option key={i} value={i}>{h}</option>
                ))}
              </select>
            </div>
          ))}
          {error && <div style={{ marginTop: 8, fontSize: 12, color: isDark ? "#f87171" : "#dc2626" }}>{error}</div>}
        </div>
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button onClick={() => { setStep("upload"); setParsed(null); }} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 14px", color: T.textSub, fontSize: 12, cursor: "pointer" }}>
            ← Back
          </button>
          <button
            onClick={() => {
              if (!mapping.name && mapping.name !== 0) { setError("Name column is required"); return; }
              setStep("preview");
            }}
            style={{ background: T.accent, border: "none", borderRadius: 7, padding: "7px 18px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Preview →
          </button>
        </div>
      </div>
    </div>
  );

  // step === "preview"
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        {header}
        <div style={{ padding: 20, flex: 1, overflowY: "auto" }}>
          <div style={{ fontSize: 12, color: T.textSub, marginBottom: 12 }}>
            Importing {totalLeads} leads (deduped by email)
          </div>
          {previewLeads.map((l, i) => (
            <div key={i} style={{
              background: isDark ? "#0a0f1a" : "#f8fafc",
              border: `1px solid ${T.border}`,
              borderRadius: 8, padding: "10px 12px", marginBottom: 8,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{l.name}</div>
              <div style={{ fontSize: 11, color: T.textSub, marginTop: 2 }}>
                {[l.title, l.company].filter(Boolean).join(" · ")}
              </div>
              {l.email && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{l.email}</div>}
            </div>
          ))}
          {totalLeads > 5 && (
            <div style={{ fontSize: 11, color: T.textMuted, textAlign: "center", padding: "8px 0" }}>
              + {totalLeads - 5} more
            </div>
          )}
        </div>
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button onClick={() => setStep("map")} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 14px", color: T.textSub, fontSize: 12, cursor: "pointer" }}>
            ← Back
          </button>
          <button
            onClick={() => { onImport(buildLeads()); onClose(); }}
            style={{ background: T.accent, border: "none", borderRadius: 7, padding: "7px 18px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Import {totalLeads} Leads
          </button>
        </div>
      </div>
    </div>
  );
}
