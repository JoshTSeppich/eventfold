import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { SAMPLE_LEADS }    from "../data/sampleLeads.js";
import { loadTemplates, saveTemplates } from "../data/defaultTemplates.js";

// ─── Keys ────────────────────────────────────────────────────────────────────

const LEADS_KEY    = "ef_leads_v1";
const RUNS_KEY     = "ef_saved_runs";
const DARK_KEY     = "ef_dark";
const SETTINGS_KEY = "ef_settings";
const MAX_RUNS     = 15;

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
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); }
  catch { return {}; }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const s = localStorage.getItem(DARK_KEY);
    return s !== null ? s === "true" : true;
  });

  const [leads,     setLeads]     = useState(loadLeads);
  const [runs,      setRuns]      = useState(loadRuns);
  const [templates, setTemplates] = useState(loadTemplates);
  const [settings,  setSettings]  = useState(loadSettings);

  // Persist
  useEffect(() => { localStorage.setItem(LEADS_KEY, JSON.stringify(leads)); },     [leads]);
  useEffect(() => { localStorage.setItem(RUNS_KEY,  JSON.stringify(runs));  },     [runs]);
  useEffect(() => { localStorage.setItem(DARK_KEY,  isDark);                },     [isDark]);
  useEffect(() => { saveTemplates(templates);                                },     [templates]);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);

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
        }));
      return [...fresh, ...prev];
    });
  }, []);

  const updateLead = useCallback((leadId, updater) => {
    setLeads((prev) => prev.map((l) => l.id === leadId ? updater(l) : l));
  }, []);

  // ── Runs (Intel saved results) ───────────────────────────────────────────────

  const saveRun = useCallback((run) => {
    setRuns((prev) => {
      const next = [{ ...run, id: Date.now(), savedAt: new Date().toISOString() }, ...prev];
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

  return (
    <AppContext.Provider value={{
      isDark, setIsDark,
      leads, setLeads, addLeads, updateLead,
      runs, saveRun, deleteRun,
      templates, setTemplates,
      settings, updateSettings,
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
