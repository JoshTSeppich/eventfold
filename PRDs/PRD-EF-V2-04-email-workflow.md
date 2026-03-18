# PRD-EF-V2-04: Email Workflow Improvements

**Epic:** Email Workflow Improvements
**Version:** v2.0
**Status:** Ready for development
**All three tickets are independent and can be implemented in parallel.**

---

## Overview

The current `EmailView.jsx` and template system have three friction points: generated drafts are lost when switching leads, templates cannot be managed in-app (only hardcoded defaults exist), and clicking "Open in Mail" does not record outreach. This epic addresses all three.

---

## EF-E01: Email draft persistence — save drafts to `AppContext`, auto-restore per lead

### Problem

`EmailView.jsx` holds `draft`, `editedSubject`, and `editedBody` as local React state. Switching the selected lead (via the `selectedLeadId` dropdown) does not save the current draft anywhere — it is silently discarded. A user who drafts an email, switches to check another lead's details, and returns finds a blank draft and must regenerate.

There is no persistence layer for drafts; they exist only in the component's in-memory state for the current selection.

### Acceptance Criteria

**AppContext changes:**
- [ ] Add a `drafts` map to `AppContext` state: `const [drafts, setDrafts] = useState({})` — keyed by lead ID, value is `{ subject: string, body: string, tone: string, goal: string, savedAt: string }`
- [ ] Add a `DRAFTS_KEY = "ef_drafts_v1"` localStorage key and persist `drafts` with a `useEffect` (same pattern as `leads` persistence)
- [ ] Add `loadDrafts()` helper following the same `try/catch` pattern as `loadLeads()`
- [ ] Expose `drafts`, `saveDraft(leadId, draftObj)`, and `clearDraft(leadId)` from the context value
- [ ] `saveDraft` merges into the map: `setDrafts(prev => ({ ...prev, [leadId]: { ...draftObj, savedAt: new Date().toISOString() } }))`
- [ ] `clearDraft` removes a single key: `setDrafts(prev => { const next = { ...prev }; delete next[leadId]; return next; })`

**EmailView changes:**
- [ ] Destructure `drafts`, `saveDraft`, `clearDraft` from `useApp()` in `EmailView.jsx`
- [ ] When `selectedLeadId` changes (via the lead picker `onChange`): if a draft exists for the new lead in `drafts[newLeadId]`, auto-populate `editedSubject`, `editedBody`, `tone`, and `goal` from the saved draft
- [ ] When `editedSubject` or `editedBody` changes (i.e., on every keystroke in the edit fields), debounce-save to context: call `saveDraft(selectedLeadId, { subject: editedSubject, body: editedBody, tone, goal })` with a 500ms debounce using `useRef` for the timer
- [ ] When the user clicks "Regenerate" and a new draft is set, overwrite the saved draft for the current lead
- [ ] Show a subtle "Draft saved" indicator (11px muted text, "Draft saved · [relativeTime]") below the body word count when a draft exists for the current lead
- [ ] Drafts are scoped per lead: switching leads never shows the wrong draft

### Dependencies

None.

### Estimated Effort

M (3–5 hours)

---

## EF-E02: Template CRUD — `TemplateManager` modal with list/create/edit/delete and variable helper

### Problem

Templates are defined in `src/data/defaultTemplates.js` as a hardcoded `DEFAULT_TEMPLATES` array. The `loadTemplates()` / `saveTemplates()` functions already support localStorage persistence, and `AppContext` already holds `templates` in state with `setTemplates`. However there is no UI to create, edit, rename, or delete templates — the user is locked into the three default templates shipped with the app.

The `TemplatePickerPopover` in `LeadDetailPanel` and the template reference dropdown in `EmailView` both consume `templates` from `AppContext`, so any CRUD management will automatically propagate.

### Acceptance Criteria

**TemplateManager modal:**
- [ ] Create `src/components/leads/TemplateManager.jsx` — a full-screen modal overlay (same pattern as `SettingsModal.jsx`)
- [ ] Add a "Manage Templates" button in `EmailView.jsx` left panel, below the template reference dropdown — small text link style (`fontSize: 11, color: T.textMuted`)
- [ ] Clicking it sets a `showTemplateManager` boolean in local state and renders `<TemplateManager />`

**List view (default state):**
- [ ] Left column: scrollable list of all templates. Each row shows template name, truncated subject, and an "Edit" button
- [ ] "New Template" button at the top of the list
- [ ] Selecting a template opens the edit form in the right column

**Edit form:**
- [ ] Fields: Name (text input), Subject (text input), Body (textarea, minimum 8 rows)
- [ ] Variable helper chip strip below the body textarea: one chip per supported variable — `{{firstName}}`, `{{fullName}}`, `{{title}}`, `{{company}}`, `{{hook}}`
- [ ] Clicking a chip inserts the variable text at the cursor position in the body textarea (use `selectionStart`/`selectionEnd` on the textarea ref)
- [ ] "Save" button: validates name is non-empty and subject is non-empty before saving
- [ ] Save calls `setTemplates` from `useApp()`: for an existing template, replace by `id`; for a new template, generate `id: crypto.randomUUID()` and prepend
- [ ] "Delete" button: only on existing templates, with a confirmation step ("Are you sure? This cannot be undone") inline below the button — no modal within modal
- [ ] Deleting a default template (IDs `tpl-001`, `tpl-002`, `tpl-003`) is permitted — they have no special protection once in localStorage
- [ ] "Discard" / cancel button returns to list view without saving

**Behavior:**
- [ ] Changes persist immediately via `AppContext`'s `saveTemplates` effect (already wired)
- [ ] Modal closes with the × button or pressing `Escape`
- [ ] The variable helper chips use `T.accentDim` background and `T.accent` text, matching the existing chip style in `EmailView`

### Dependencies

None.

### Estimated Effort

M (4–6 hours)

---

## EF-E03: Auto-mark contacted — set `outreachStatus: "contacted"` when "Open in Mail" is clicked in `EmailView`

### Problem

`EmailView.jsx`'s `openMailto()` function (lines 134–140) opens a mailto URL but does not update the lead's `outreachStatus`. A user who drafts and sends an email via the Email tab must manually go to the Leads tab and change the status to "contacted" — an extra step that is often skipped, leaving leads incorrectly in `"new"` status.

Compare with `LeadDetailPanel.jsx`'s `openMailto()` (lines 68–83), which already auto-sets status to `"contacted"` when `lead.outreachStatus === "new"`. `EmailView` must match this behavior.

### Acceptance Criteria

- [ ] Destructure `updateLead` from `useApp()` in `EmailView.jsx`
- [ ] In `openMailto()`, after calling `invoke("open_url", ...)`, call:
  ```js
  if (activeLead && activeLead.outreachStatus === "new") {
    updateLead(activeLead.id, l => ({
      ...l,
      outreachStatus: "contacted",
      contactedAt: new Date().toISOString(),
    }));
  }
  ```
- [ ] Do not overwrite `outreachStatus` if it is already `"contacted"`, `"responded"`, or `"qualified"` — the condition must check `=== "new"` only
- [ ] After the status update, show a transient inline notice below the "Open in Mail" button: "Marked as contacted" in 11px green text, fading out after 3 seconds (use a boolean state + `setTimeout` to toggle visibility)
- [ ] The `activeLead` ref in the `openMailto` closure must be current at call time — verify it uses the `activeLead` derived from the current `leads` state, not a stale closure value (it is already derived as `leads.find(l => l.id === selectedLeadId)` so re-deriving at call time is sufficient)
- [ ] Verify end-to-end: open Email tab, select a new lead, generate a draft, click "Open in Mail", switch to Leads tab — confirm the lead's status is "contacted"

### Dependencies

None.

### Estimated Effort

S (1–2 hours)
