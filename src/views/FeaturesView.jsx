import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRepoInput(input) {
  const clean = input.trim();
  const urlMatch = clean.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/);
  if (urlMatch) return { owner: urlMatch[1], repoName: urlMatch[2].replace(/\.git$/, "") };
  const slashMatch = clean.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (slashMatch) return { owner: slashMatch[1], repoName: slashMatch[2] };
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FeaturesView({ T }) {
  const [subView,       setSubView]       = useState("input");
  const [savedRepos,    setSavedRepos]    = useState([]);
  const [selectedRepo,  setSelectedRepo]  = useState(null);
  const [ideaText,      setIdeaText]      = useState("");
  const [genOutput,     setGenOutput]     = useState(null);
  const [editedIssues,  setEditedIssues]  = useState([]);
  const [issueResults,  setIssueResults]  = useState([]);
  const [generating,    setGenerating]    = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [genError,      setGenError]      = useState(null);
  const [expandedIdx,   setExpandedIdx]   = useState(0);
  const [addingRepo,    setAddingRepo]    = useState(false);
  const [newRepoInput,  setNewRepoInput]  = useState("");
  const [addRepoError,  setAddRepoError]  = useState(null);

  const loadRepos = () => {
    invoke("list_saved_repos").then(setSavedRepos).catch(() => {});
  };

  useEffect(() => { loadRepos(); }, []);

  const handleAddRepo = async () => {
    const parsed = parseRepoInput(newRepoInput);
    if (!parsed) { setAddRepoError("Use format: owner/repo or a GitHub URL"); return; }
    try {
      await invoke("upsert_saved_repo", { owner: parsed.owner, repoName: parsed.repoName, displayLabel: null });
      await loadRepos();
      setSelectedRepo(`${parsed.owner}/${parsed.repoName}`);
      setNewRepoInput("");
      setAddingRepo(false);
      setAddRepoError(null);
    } catch (e) {
      setAddRepoError(String(e));
    }
  };

  const handleGenerate = async () => {
    if (!selectedRepo || ideaText.trim().length < 10) return;
    const [owner, repoName] = selectedRepo.split("/");
    setGenerating(true);
    setGenError(null);
    try {
      const output = await invoke("generate_feature_request", { owner, repoName, idea: ideaText });
      setGenOutput(output);
      setEditedIssues(output.issues.map(i => ({ ...i })));
      setExpandedIdx(0);
      setSubView("preview");
    } catch (e) {
      setGenError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateIssues = async () => {
    if (!selectedRepo) return;
    const [owner, repoName] = selectedRepo.split("/");
    setSubmitting(true);
    try {
      const results = await invoke("create_github_issues", { owner, repoName, issues: editedIssues });
      setIssueResults(results);
      setSubView("confirmation");
    } catch (e) {
      setIssueResults([{ title: "Error", status: "error", url: null, error: String(e) }]);
      setSubView("confirmation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    setSubView("input");
    setGenOutput(null);
    setEditedIssues([]);
    setIssueResults([]);
    setGenError(null);
    setIdeaText("");
  };

  const updateIssue = (idx, field, value) => {
    setEditedIssues(prev => prev.map((iss, i) => i === idx ? { ...iss, [field]: value } : iss));
  };

  const inputStyle = {
    width: "100%", padding: "9px 12px",
    background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: 8, color: T.text, fontSize: 13,
    outline: "none", fontFamily: "inherit",
    boxSizing: "border-box",
  };

  // ── Input sub-view ──────────────────────────────────────────────────────────
  if (subView === "input") {
    const ideaLen   = ideaText.trim().length;
    const canGenerate = selectedRepo && ideaLen >= 10 && ideaLen <= 2000 && !generating;

    return (
      <div style={{ flex: 1, display: "flex", overflow: "hidden", height: "100%" }}>
        {/* Left panel */}
        <div style={{
          width: 320, flexShrink: 0,
          borderRight: `1px solid ${T.border}`,
          display: "flex", flexDirection: "column",
          background: T.surface, padding: "24px 20px",
          overflow: "auto",
        }}>
          {/* Repository selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
              Target Repository
            </div>
            {savedRepos.length > 0 && (
              <select
                value={selectedRepo || ""}
                onChange={e => setSelectedRepo(e.target.value || null)}
                style={{ ...inputStyle, marginBottom: 8 }}
              >
                <option value="">Select a repository…</option>
                {savedRepos.map(r => (
                  <option key={r.id} value={`${r.owner}/${r.repo_name}`}>{r.display_label}</option>
                ))}
              </select>
            )}

            {!addingRepo ? (
              <button
                onClick={() => setAddingRepo(true)}
                style={{ fontSize: 12, color: T.accent, background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add repository
              </button>
            ) : (
              <div style={{ marginTop: 4 }}>
                <input
                  type="text"
                  value={newRepoInput}
                  onChange={e => { setNewRepoInput(e.target.value); setAddRepoError(null); }}
                  onKeyDown={e => {
                    if (e.key === "Enter")  handleAddRepo();
                    if (e.key === "Escape") { setAddingRepo(false); setNewRepoInput(""); setAddRepoError(null); }
                  }}
                  placeholder="owner/repo or GitHub URL"
                  autoFocus
                  style={{
                    ...inputStyle,
                    fontFamily: "monospace", fontSize: 12,
                    borderColor: addRepoError ? T.red : T.border,
                    marginBottom: 6,
                  }}
                />
                {addRepoError && (
                  <div style={{ fontSize: 11, color: T.red, marginBottom: 6 }}>{addRepoError}</div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={handleAddRepo}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", background: T.accent, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAddingRepo(false); setNewRepoInput(""); setAddRepoError(null); }}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: `1px solid ${T.border}`, background: "transparent", color: T.textSub, fontSize: 12, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Idea textarea */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
              Feature Idea
            </div>
            <textarea
              value={ideaText}
              onChange={e => setIdeaText(e.target.value.slice(0, 2000))}
              placeholder={"Describe your feature idea in plain text.\n\nExample: Add a dark mode toggle that persists between sessions and respects the user's system preference by default."}
              style={{
                flex: 1, minHeight: 180, padding: "12px",
                background: T.bg, border: `1px solid ${T.border}`,
                borderRadius: 10, color: T.text,
                fontSize: 13, fontFamily: "inherit",
                lineHeight: 1.6, outline: "none", resize: "none",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <span style={{ fontSize: 11, color: ideaLen > 2000 ? T.red : ideaLen < 10 && ideaLen > 0 ? T.amber : T.textMuted }}>
                {ideaLen}/2000
              </span>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            style={{
              marginTop: 16, width: "100%", padding: "12px 0",
              borderRadius: 10, border: "none", background: T.accent,
              color: "#fff", fontSize: 14, fontWeight: 700,
              opacity: canGenerate ? 1 : 0.45,
              cursor: canGenerate ? "pointer" : "default",
              transition: "opacity 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {generating ? (
              <>
                <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                Generating…
              </>
            ) : "Generate Issues"}
          </button>

          {genError && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: T.redDim, border: `1px solid ${T.red}44`, borderRadius: 10, fontSize: 12, color: T.red }}>
              <strong>Error:</strong> {genError}
              <button onClick={handleGenerate} style={{ display: "block", marginTop: 8, fontSize: 12, color: T.accent, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                Try again →
              </button>
            </div>
          )}
        </div>

        {/* Right panel — empty state */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: T.textMuted, textAlign: "center", padding: 40, background: T.bg }}>
          <div style={{ fontSize: 44, marginBottom: 16, opacity: 0.12 }}>◈</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub, marginBottom: 8 }}>Idea → GitHub Issues</div>
          <div style={{ fontSize: 13, color: T.textMuted, maxWidth: 360, lineHeight: 1.7 }}>
            Select a repo, describe your feature, and click <strong style={{ color: T.textSub }}>Generate Issues</strong>.<br /><br />
            Claude will produce a feature brief and implementation tickets ready to publish to GitHub.
          </div>
          {!savedRepos.length && (
            <div style={{ marginTop: 24, padding: "12px 16px", background: T.amberDim, border: `1px solid ${T.amber}44`, borderRadius: 10, fontSize: 12, color: T.amber, maxWidth: 320 }}>
              Add a repository in the left panel to get started.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Preview sub-view ────────────────────────────────────────────────────────
  if (subView === "preview" && genOutput) {
    const { brief } = genOutput;
    const hasEmptyTitle = editedIssues.some(i => !i.title.trim());

    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>
        {/* Top bar */}
        <div style={{
          padding: "14px 24px", borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: T.surface, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setSubView("input")}
              style={{ fontSize: 12, color: T.textSub, background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              ← Back
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{brief.feature_name}</span>
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 5, background: T.accentDim, color: T.accent, fontWeight: 700 }}>
              {editedIssues.length} issues
            </span>
          </div>
          <button
            onClick={handleCreateIssues}
            disabled={hasEmptyTitle || submitting}
            style={{
              padding: "9px 20px", borderRadius: 9, border: "none",
              background: T.accent, color: "#fff", fontSize: 13, fontWeight: 700,
              opacity: hasEmptyTitle || submitting ? 0.5 : 1,
              cursor: hasEmptyTitle || submitting ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {submitting ? (
              <>
                <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                Creating…
              </>
            ) : "Create Issues on GitHub →"}
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 24, display: "flex", gap: 20, alignItems: "flex-start", background: T.bg }}>
          {/* Feature Brief sidebar */}
          <div style={{ width: 260, flexShrink: 0 }}>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Feature Brief</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>{brief.feature_name}</div>
              <div style={{ fontSize: 12, color: T.textSub, marginBottom: 12, lineHeight: 1.6 }}>{brief.summary}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Problem</div>
              <div style={{ fontSize: 12, color: T.textSub, marginBottom: 12, lineHeight: 1.6 }}>{brief.problem}</div>
              {brief.goals?.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Goals</div>
                  <ul style={{ margin: 0, padding: "0 0 0 14px", marginBottom: 12 }}>
                    {brief.goals.map((g, i) => <li key={i} style={{ fontSize: 12, color: T.textSub, marginBottom: 4, lineHeight: 1.5 }}>{g}</li>)}
                  </ul>
                </>
              )}
              {brief.non_goals?.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Non-Goals (v1)</div>
                  <ul style={{ margin: 0, padding: "0 0 0 14px" }}>
                    {brief.non_goals.map((g, i) => <li key={i} style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, lineHeight: 1.5 }}>{g}</li>)}
                  </ul>
                </>
              )}
            </div>
          </div>

          {/* Issue cards */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            {editedIssues.map((issue, idx) => (
              <IssueCard
                key={idx}
                issue={issue}
                idx={idx}
                expanded={expandedIdx === idx}
                onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                onChange={(field, value) => updateIssue(idx, field, value)}
                T={T}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Confirmation sub-view ───────────────────────────────────────────────────
  if (subView === "confirmation") {
    const success = issueResults.filter(r => r.status === "created");
    const failed  = issueResults.filter(r => r.status !== "created");

    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, background: T.bg }}>
        <div style={{ maxWidth: 480, width: "100%" }}>
          <div style={{ fontSize: 32, textAlign: "center", marginBottom: 16 }}>
            {failed.length === 0 ? "🎉" : "⚠️"}
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, textAlign: "center", marginBottom: 6 }}>
            {failed.length === 0 ? `${success.length} Issues Created` : `${success.length} created, ${failed.length} failed`}
          </h2>
          <p style={{ fontSize: 13, color: T.textSub, textAlign: "center", marginBottom: 24 }}>
            on <strong style={{ color: T.text }}>{selectedRepo}</strong>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
            {issueResults.map((r, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 9,
                background: T.card, border: `1px solid ${r.status === "created" ? T.green + "40" : T.red + "40"}`,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{r.status === "created" ? "✓" : "✕"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                  {r.error && <div style={{ fontSize: 11, color: T.red }}>{r.error}</div>}
                </div>
                {r.url && (
                  <button
                    onClick={() => invoke("open_url", { url: r.url })}
                    style={{ fontSize: 11, color: T.accent, background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
                  >
                    View →
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={handleDone}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 10,
              border: "none", background: T.accent,
              color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            Generate Another Feature
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ─── IssueCard ────────────────────────────────────────────────────────────────

function IssueCard({ issue, idx, expanded, onToggle, onChange, T }) {
  const labelColors = {
    feature:     { bg: T.accentDim,  fg: T.accent },
    enhancement: { bg: T.accentDim,  fg: T.accent },
    backend:     { bg: T.amberDim,   fg: T.amber  },
    frontend:    { bg: T.greenDim,   fg: T.green  },
    "api":       { bg: T.amberDim,   fg: T.amber  },
    default:     { bg: T.surface,    fg: T.textSub },
  };

  const textareaStyle = {
    width: "100%", padding: "9px 11px",
    background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: 8, color: T.text, fontSize: 12,
    fontFamily: "monospace", lineHeight: 1.5,
    outline: "none", resize: "vertical",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${expanded ? T.borderLight : T.border}`,
      borderRadius: 12, overflow: "hidden",
      transition: "border-color 0.15s",
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          padding: "14px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, flexShrink: 0 }}>#{idx + 1}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {issue.title || <em style={{ color: T.textMuted }}>Untitled</em>}
          </span>
          {issue.labels?.map(lbl => {
            const col = labelColors[lbl.toLowerCase()] || labelColors.default;
            return (
              <span key={lbl} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: col.bg, color: col.fg, fontWeight: 700, flexShrink: 0 }}>
                {lbl}
              </span>
            );
          })}
        </div>
        <span style={{ fontSize: 12, color: T.textMuted, flexShrink: 0, marginLeft: 8 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Title */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>Title</label>
            <input
              value={issue.title}
              onChange={e => onChange("title", e.target.value)}
              style={{
                width: "100%", padding: "8px 10px",
                background: T.bg, border: `1px solid ${!issue.title.trim() ? T.red : T.border}`,
                borderRadius: 8, color: T.text, fontSize: 13,
                outline: "none", fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Body */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>Body</label>
            <textarea
              value={issue.body}
              onChange={e => onChange("body", e.target.value)}
              rows={8}
              style={{ ...textareaStyle }}
            />
          </div>

          {/* Acceptance Criteria */}
          {issue.acceptance_criteria?.length > 0 && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>
                Acceptance Criteria
              </label>
              <textarea
                value={issue.acceptance_criteria.join("\n")}
                onChange={e => onChange("acceptance_criteria", e.target.value.split("\n"))}
                rows={Math.min(6, issue.acceptance_criteria.length + 1)}
                style={{ ...textareaStyle }}
              />
            </div>
          )}

          {/* Labels */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 5 }}>
              Labels <span style={{ fontWeight: 400, color: T.textMuted }}>(comma-separated)</span>
            </label>
            <input
              value={(issue.labels || []).join(", ")}
              onChange={e => onChange("labels", e.target.value.split(",").map(l => l.trim()).filter(Boolean))}
              style={{
                width: "100%", padding: "8px 10px",
                background: T.bg, border: `1px solid ${T.border}`,
                borderRadius: 8, color: T.text, fontSize: 12,
                outline: "none", fontFamily: "monospace",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
