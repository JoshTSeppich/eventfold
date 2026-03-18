# PRD-EF-V3-03: Tags & Suppress List

## Overview

Add a tagging system to leads for organization and filtering, and introduce a suppress list that blocks specific emails, domains, or companies from appearing in Intel results.

---

## Tickets

---

### EF-T01: Tag Data Model

**Summary:** Add a `tags` array to every lead in AppContext, with `tagLead`/`untagLead` callbacks and localStorage persistence.

**Files:**
- `AppContext.jsx`

**Parallelizable:** Yes (coordinate with other AppContext changes in EF-T05 and EF-A01)

**Depends on:** None

**Acceptance Criteria:**
- Every lead object in AppContext state includes a `tags: []` field; existing leads without the field are initialized to an empty array on load.
- `tagLead(leadId, tag)` adds the tag string if not already present; `untagLead(leadId, tag)` removes it.
- Tag mutations are immediately persisted to localStorage under the leads storage key.
- Tags are preserved across page reloads.
- Tag values are trimmed and lowercased before storage to prevent duplicates from casing differences.

---

### EF-T02: TagPill Component

**Summary:** A small colored pill component for displaying a tag, with color derived from the tag string hash and an optional remove button.

**Files:**
- `components/leads/TagPill.jsx` (new)

**Parallelizable:** Yes

**Depends on:** None

**Acceptance Criteria:**
- `<TagPill tag="string" onRemove={fn} />` renders a compact pill with the tag label.
- Background color is deterministically derived from a hash of the tag string, producing a consistent color per unique tag across the app.
- When `onRemove` is provided, a small "×" button appears inside the pill; clicking it calls `onRemove` without bubbling the click event.
- When `onRemove` is omitted, the pill renders as read-only with no interactive elements.
- The pill is accessible: it has an appropriate `aria-label` when the remove button is present.

---

### EF-T03: Tag UI in LeadDetailPanel

**Summary:** Show tags on a lead detail panel with inline add (type + Enter) and remove support.

**Files:**
- `LeadDetailPanel.jsx`

**Parallelizable:** No

**Depends on:** EF-T01, EF-T02

**Acceptance Criteria:**
- The detail panel shows all tags for the selected lead as `TagPill` components in a wrapping row.
- An inline text input allows the user to type a new tag and press Enter to add it via `tagLead`.
- Clicking the remove button on a `TagPill` calls `untagLead` and removes the pill immediately.
- If a lead has no tags, a faint placeholder ("Add a tag...") is shown in place of the tag row.
- The tag input field is cleared after a successful add.

---

### EF-T04: Tag Filter in LeadsView

**Summary:** Add a multi-select tag filter chip row to LeadsView, integrated with the existing filter hook.

**Files:**
- `LeadsView.jsx`
- `hooks/useLeadsFilter.js`

**Parallelizable:** No

**Depends on:** EF-T01

**Acceptance Criteria:**
- A row of filter chips appears below the search bar, one chip per unique tag across all leads.
- Multiple chips can be selected simultaneously; selecting chips filters leads to those matching any selected tag (OR logic).
- `useLeadsFilter.js` accepts a `selectedTags` parameter and applies tag filtering alongside existing filters.
- Active filter chips are visually distinguished from inactive ones.
- When no chips are selected, all leads are shown (no tag filter applied).

---

### EF-T05: Blacklist / Suppress List

**Summary:** Add a `suppressList` state to AppContext backed by a Tauri SQLite table; filter Intel results against the list before display.

**Files:**
- `AppContext.jsx`
- `lib.rs`
- `IntelView.jsx`

**Parallelizable:** Yes (coordinate with other AppContext changes in EF-T01 and EF-A01)

**Depends on:** None

**Acceptance Criteria:**
- A SQLite table `suppress_list` is created in `lib.rs` with columns: `id`, `entry`, `type` (`email` | `domain` | `company`), `created_at`.
- AppContext loads the suppress list from Tauri on startup and exposes `addSuppression(entry, type)` and `removeSuppression(id)` callbacks.
- After each Intel run, contacts are filtered against the suppress list before being rendered: exact email matches, domain suffix matches, and company name matches (case-insensitive) are all removed.
- Suppressed contacts are counted and shown in the query log: "N contacts suppressed."
- Suppress list mutations are immediately reflected in subsequent Intel result filtering without requiring a re-run.

---

### EF-T06: Suppress List UI in Settings

**Summary:** Add a section to SettingsModal for managing suppressed emails, domains, and companies with add and remove actions.

**Files:**
- `SettingsModal.jsx`

**Parallelizable:** No

**Depends on:** EF-T05

**Acceptance Criteria:**
- A "Suppress List" section appears in SettingsModal listing all current entries grouped by type (email, domain, company).
- Each entry displays the value, its type, and a remove button that calls `removeSuppression`.
- An "Add" form lets the user enter a value and select a type, then calls `addSuppression` on submit.
- The list updates immediately after add or remove without requiring a modal close/reopen.
- Empty state shows a message explaining what the suppress list does and inviting the first entry.
