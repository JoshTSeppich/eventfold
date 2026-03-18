# PRD-EF-V2-02: Data Visibility & Lead Intelligence

**Epic:** Data Visibility & Lead Intelligence
**Version:** v2.0
**Status:** Ready for development
**Tickets EF-D01, EF-D02, EF-D03 can run in parallel. EF-D02 and EF-D03 depend on EF-D01 being merged first so the fields exist on lead objects.**

---

## Overview

The Apollo enrichment pipeline in `IntelView.jsx` already collects rich data per contact: `companySize`, `industry`, `location`, `companyDomain`, `photoUrl`, `qualChecks`, and a `runId`. However, `addLeads()` in `AppContext.jsx` (lines 72–89) explicitly whitelists only a narrow set of fields when mapping incoming contacts into the leads store. Every enrichment field is silently dropped at the bridge between Intel and Leads.

Additionally, `LeadDetailPanel.jsx` has no UI to surface company info, qual breakdown, or source attribution even if the fields were present.

This epic closes both gaps: persist the enrichment data through `addLeads()`, then expose it in `LeadDetailPanel`.

---

## EF-D01: Extend `addLeads()` to preserve Apollo enrichment fields

### Problem

`AppContext.jsx` lines 72–89 construct each new lead with an explicit property list. Any field not in that list is dropped. The following fields produced by `IntelView`'s `mapContact()` and `runQualChecks()` are currently stripped:

- `companySize` — employee count string from Apollo `organization.estimated_num_employees`
- `industry` — from Apollo `organization.industry`
- `location` — city/state/country joined string
- `companyDomain` — `organization.primary_domain`
- `photoUrl` — `p.photo_url` from Apollo person record
- `qualChecks` — array of `{ criterion, category, checkable, passed, note }` objects
- `runId` — not yet a field; must be added to carry the Intel run timestamp

These fields are computed and attached to contacts in `IntelView` lines 449–452 but never survive `addLeads()`.

### Acceptance Criteria

- [ ] In `AppContext.jsx`, update the `fresh` mapping inside `addLeads()` to include:
  ```js
  companySize:   l.companySize   || null,
  industry:      l.industry      || null,
  location:      l.location      || null,
  companyDomain: l.companyDomain || null,
  photoUrl:      l.photoUrl      || null,
  qualChecks:    l.qualChecks    || [],
  runId:         l.runId         || null,
  ```
- [ ] Update the `migrate()` helper (line 15) to include default values for all new fields so existing persisted leads without these fields don't produce undefined errors:
  ```js
  companySize:   null,
  industry:      null,
  location:      null,
  companyDomain: null,
  photoUrl:      null,
  qualChecks:    [],
  runId:         null,
  ```
- [ ] In `IntelView.jsx`, set `runId` on each contact before calling `onSendToLeads` — use the run's `savedAt` timestamp: each scored contact gets `runId: new Date().toISOString()` (set once at the end of `run()`, line 455 area, before calling `saveRun`)
- [ ] Verify via localStorage inspection that a lead added from Intel contains all six new fields
- [ ] Existing leads (loaded from localStorage without these fields) must migrate cleanly via `migrate()` with no console errors

### Dependencies

None.

### Estimated Effort

S (1–2 hours)

---

## EF-D02: Update `LeadDetailPanel` — show photo, company info, and qual breakdown

### Problem

`LeadDetailPanel.jsx` currently shows: status, email, hook, LinkedIn, and notes. It has no section for:

- Photo / avatar (uses initials-only `Avatar` component even when `photoUrl` is present)
- Company information (size, industry, location, domain)
- Qualification breakdown (per-criterion pass/fail list from `qualChecks`)

An engineer using the panel to decide whether to reach out has to go back to Intel to see qual data.

### Acceptance Criteria

**Photo / avatar:**
- [ ] Modify the `Avatar` component in `LeadDetailPanel.jsx` to accept a `photoUrl` prop
- [ ] When `lead.photoUrl` is truthy, render `<img src={lead.photoUrl} />` with the same 44px circular dimensions and `object-fit: cover`
- [ ] When `photoUrl` is falsy or the image errors (`onError`), fall back to the existing initials avatar
- [ ] The `<img>` must have `referrerPolicy="no-referrer"` (Apollo CDN images require it)

**Company info section:**
- [ ] Add a "Company" section below the hook section (if at least one of `companySize`, `industry`, `location`, `companyDomain` is non-null on the lead)
- [ ] Render as a compact list of rows, each with a muted label and value:
  - Industry: `lead.industry`
  - Size: `lead.companySize` employees
  - Location: `lead.location`
  - Domain: `lead.companyDomain` (render as a clickable link using `invoke("open_url")`)
- [ ] Only render rows for fields that are non-null/non-empty
- [ ] Use the same `labelStyle` pattern (10px uppercase muted) already established in the component

**Qual breakdown:**
- [ ] Add a "Qualification" section below the company section (only if `lead.qualChecks?.length > 0`)
- [ ] Render as a compact checklist: one row per `qualChecks` item
- [ ] Each row shows:
  - Pass/fail indicator: green check (✓) if `passed === true`, red cross (✗) if `passed === false`, grey dash (—) if `checkable === false`
  - Criterion text: `item.criterion` in 11px
  - Note: `item.note` in 10px muted italic (only when non-null)
- [ ] Display `lead.fitScore` as a percentage badge in the section header if non-null (e.g., "Qualification · 83%")
- [ ] Color thresholds for fitScore badge: ≥ 75 green, ≥ 50 amber, < 50 red — matching `IntelView`'s `scoreColor` logic

### Dependencies

EF-D01 must be merged first so `lead.companySize`, `lead.industry`, etc. exist on lead objects in the store.

### Estimated Effort

M (3–5 hours)

---

## EF-D03: Add source tracing — "Intel run" badge in detail panel

### Problem

Leads can enter the system from two sources: `"manual"` (added via `AddLeadModal`) or `"intel"` (added via the Intel pipeline). When source is `"intel"`, `lead.runId` carries the ISO timestamp of the run. Neither the source nor the run timestamp is currently surfaced anywhere in the UI. An operator reviewing leads has no way to know which pipeline run produced a given lead or when.

### Acceptance Criteria

- [ ] In `LeadDetailPanel.jsx`, add a source badge in the panel header area, below the name/title line, conditionally rendered when `lead.source === "intel"` and `lead.runId` is non-null
- [ ] Badge format: `Intel run · [relative date]` — use the existing `relativeTime()` utility imported in `LeadDetailPanel.jsx` with `lead.runId` as the input
- [ ] Badge styling: 10px, pill shape, muted background (`card`), muted text — consistent with the `fitScore` badge style already in the component. Should not be visually prominent.
- [ ] When `lead.source === "manual"`, render nothing (no badge)
- [ ] When `lead.source === "intel"` but `lead.runId` is null (migrated old record), render `Intel run · unknown date`
- [ ] The badge must be inside the sticky header `div` so it scrolls with the header, not the body

### Dependencies

EF-D01 must be merged first so `lead.runId` and `lead.source` are reliably present on leads added from Intel.

### Estimated Effort

S (1–2 hours)
