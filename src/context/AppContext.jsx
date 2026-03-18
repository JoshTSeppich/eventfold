import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { SAMPLE_LEADS }    from "../data/sampleLeads.js";
import { loadTemplates, saveTemplates } from "../data/defaultTemplates.js";

// ─── Keys ────────────────────────────────────────────────────────────────────

const LEADS_KEY    = "ef_leads_v1";
const RUNS_KEY     = "ef_saved_runs";
const DARK_KEY     = "ef_dark";
const SETTINGS_KEY = "ef_settings";
const DRAFTS_KEY   = "ef_email_drafts";
const HOOKS_KEY    = "ef_saved_hooks_v1";
const MAX_RUNS     = 15;
const ACTIVITY_KEY = "ef_activity_v1";
const MAX_ACTIVITY = 200;

function loadActivity() {
  try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]"); } catch { return []; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function migrate(lead) {
  return {
    outreachStatus: "new",
    contactedAt:    null,
    outreachNote:   null,
    followUpCount:  0,
    notes:          [],
    ...lead,
  };
}

function loadLeads() {
  try {
    const raw = localStorage.getItem(LEADS_KEY);
    return raw ? JSON.parse(raw).map(migrate) : SAMPLE_LEADS.map(migrate);
  } catch { return SAMPLE_LEADS.map(migrate); }
}

function loadRuns() {
  try { return JSON.parse(localStorage.getItem(RUNS_KEY) || "[]"); }
  catch { return []; }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { bookingUrl: "", weeklyGoal: 250, ...saved };
  }
  catch { return { bookingUrl: "", weeklyGoal: 250 }; }
}

// drafts: { [leadId]: { subject, body, tone, goal, updatedAt } }
function loadDrafts() {
  try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "{}"); }
  catch { return {}; }
}

// savedHooks: [{ id, hook, angle, starredAt, appliedCount }]
function loadSavedHooks() {
  try { return JSON.parse(localStorage.getItem(HOOKS_KEY) || "[]"); }
  catch { return []; }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const s = localStorage.getItem(DARK_KEY);
    return s !== null ? s === "true" : true;
  });

  const [leads,      setLeads]      = useState(loadLeads);
  const [runs,       setRuns]       = useState(loadRuns);
  const [templates,  setTemplates]  = useState(loadTemplates);
  const [settings,   setSettings]   = useState(loadSettings);
  const [drafts,     setDrafts]     = useState(loadDrafts);
  const [savedHooks, setSavedHooks] = useState(loadSavedHooks);
  const [activityLog, setActivityLog] = useState(loadActivity);

  // Persist
  useEffect(() => { localStorage.setItem(LEADS_KEY, JSON.stringify(leads)); },     [leads]);
  useEffect(() => { localStorage.setItem(RUNS_KEY,  JSON.stringify(runs));  },     [runs]);
  useEffect(() => { localStorage.setItem(DARK_KEY,  isDark);                },     [isDark]);
  useEffect(() => { saveTemplates(templates);                                },     [templates]);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem(DRAFTS_KEY,   JSON.stringify(drafts));   }, [drafts]);
  useEffect(() => { localStorage.setItem(HOOKS_KEY,    JSON.stringify(savedHooks)); }, [savedHooks]);
  useEffect(() => {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activityLog.slice(0, MAX_ACTIVITY)));
  }, [activityLog]);

  // ── Lead actions ────────────────────────────────────────────────────────────

  const addLeads = useCallback((newLeads) => {
    setLeads((prev) => {
      const emailSet = new Set(prev.map((l) => l.email?.toLowerCase()).filter(Boolean));
      const fresh = newLeads
        .filter((l) => !l.email || !emailSet.has(l.email.toLowerCase()))
        .map((l) => ({
          id:             l.id || crypto.randomUUID(),
          name:           l.name,
          title:          l.title,
          company:        l.company,
          email:          l.email || null,
          emailStatus:    l.emailStatus || "none",
          fitScore:       l.fitScore || null,
          hook:           l.hook || null,
          linkedinUrl:    l.linkedinUrl || null,
          outreachStatus: "new",
          contactedAt:    null,
          outreachNote:   null,
          followUpCount:  0,
          notes:          [],
          createdAt:      l.createdAt || new Date().toISOString(),
          source:         l.source || "manual",
          companySize:    l.companySize   || null,
          companyDomain:  l.companyDomain || null,
          industry:       l.industry      || null,
          location:       l.location      || null,
          photoUrl:       l.photoUrl      || null,
          qualChecks:     l.qualChecks    || [],
          runId:          l.runId         || null,
          tags:           l.tags          || [],
        }));
      return [...fresh, ...prev];
    });
  }, []);

  const updateLead = useCallback((leadId, updater) => {
    setLeads((prev) => prev.map((l) => l.id === leadId ? updater(l) : l));
  }, []);

  const deleteLead = useCallback((leadId) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  }, []);

  // ── Runs (Intel saved results) ───────────────────────────────────────────────

  const saveRun = useCallback((run) => {
    setRuns((prev) => {
      const next = [{ ...run, id: crypto.randomUUID(), savedAt: new Date().toISOString() }, ...prev];
      return next.slice(0, MAX_RUNS);
    });
  }, []);

  const deleteRun = useCallback((id) => {
    setRuns((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ── Settings ─────────────────────────────────────────────────────────────────

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Email drafts ──────────────────────────────────────────────────────────────
  // Keyed by leadId. Persists subject/body/tone/goal per lead across tab switches.
  const saveDraft = useCallback((leadId, draft) => {
    setDrafts((prev) => ({ ...prev, [leadId]: { ...draft, updatedAt: new Date().toISOString() } }));
  }, []);

  const clearDraft = useCallback((leadId) => {
    setDrafts((prev) => { const n = { ...prev }; delete n[leadId]; return n; });
  }, []);

  // ── Saved hooks ───────────────────────────────────────────────────────────────

  const starHook = useCallback((hookObj) => {
    setSavedHooks((prev) => {
      if (prev.some((h) => h.hook === hookObj.hook)) return prev;
      return [{ id: crypto.randomUUID(), hook: hookObj.hook, angle: hookObj.angle || "", starredAt: new Date().toISOString(), appliedCount: 0 }, ...prev];
    });
  }, []);

  const unstarHook = useCallback((hookId) => {
    setSavedHooks((prev) => prev.filter((h) => h.id !== hookId));
  }, []);

  const incrementHookApplied = useCallback((hookId) => {
    setSavedHooks((prev) => prev.map((h) => h.id === hookId ? { ...h, appliedCount: (h.appliedCount || 0) + 1 } : h));
  }, []);

  // ── Activity log ──────────────────────────────────────────────────────────────

  const addActivity = useCallback((action, leadId, detail = "") => {
    const lead = leads.find(l => l.id === leadId);
    setActivityLog(prev => [{
      id: crypto.randomUUID(),
      leadId,
      leadName: lead?.name || "",
      company: lead?.company || "",
      action,
      detail,
      ts: new Date().toISOString(),
    }, ...prev].slice(0, MAX_ACTIVITY));
  }, [leads]);

  // ── Tag system ────────────────────────────────────────────────────────────────

  const tagLead = useCallback((leadId, tag) => {
    setLeads(prev => prev.map(l =>
      l.id === leadId
        ? { ...l, tags: l.tags?.includes(tag) ? l.tags : [...(l.tags || []), tag.trim()] }
        : l
    ));
  }, []);

  const untagLead = useCallback((leadId, tag) => {
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, tags: (l.tags || []).filter(t => t !== tag) } : l
    ));
  }, []);

  return (
    <AppContext.Provider value={{
      isDark, setIsDark,
      leads, setLeads, addLeads, updateLead, deleteLead,
      runs, saveRun, deleteRun,
      templates, setTemplates,
      settings, updateSettings,
      drafts, saveDraft, clearDraft,
      savedHooks, starHook, unstarHook, incrementHookApplied,
      activityLog, addActivity,
      tagLead, untagLead,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
