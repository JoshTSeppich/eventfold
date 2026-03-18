# PRD-EF-V2-03: Analytics & Closed-Loop Learning

**Epic:** Analytics & Closed-Loop Learning
**Version:** v2.0
**Status:** Ready for development
**EF-A01 is independent. EF-A02 depends on EF-A01 (it adds a button inside the completed pipeline state of `IntelView`, not inside `AnalyticsView`, but requires the response-rate data model established in EF-A01 to be understood first). Implement EF-A01 before EF-A02.**

---

## Overview

The data required to measure campaign performance is fully present in `AppContext`: lead `outreachStatus`, `contactedAt`, `followUpCount`, `fitScore`, `industry`, `companySize`, `createdAt`, and the `qualChecks` array. None of it is visualized. There is no way to answer questions like "what's my response rate by title?" or "how many leads did I contact this week?".

This epic adds an `AnalyticsView` tab with the core campaign funnel and segment breakdowns, then leverages Claude to turn that data into ICP refinement suggestions inside `IntelView`.

---

## EF-A01: New `AnalyticsView.jsx` — funnel, segment charts, daily bar chart

### Problem

There is currently no analytics tab. The `TABS` array in `App.jsx` has five entries (`intel`, `leads`, `followups`, `email`, `features`) — none is analytics. Operators cannot see whether their outreach is working without manually counting rows.

### Acceptance Criteria

**Tab registration:**
- [ ] Add `{ id: "analytics", label: "Analytics", icon: "◉" }` to the `TABS` array in `App.jsx`
- [ ] Add `{activeTab === "analytics" && <AnalyticsView T={T} />}` to the view area in `App.jsx`
- [ ] Create `src/views/AnalyticsView.jsx`

**Funnel chart:**
- [ ] Display a vertical funnel showing four stages in order: New → Contacted → Responded → Qualified
- [ ] Each stage shows: count, percentage of total leads, and a horizontal fill bar proportional to count (relative to "New" as 100%)
- [ ] Use `leads` from `useApp()` — do not filter to a date range; show all-time totals
- [ ] Stage counts:
  - New: `leads.filter(l => l.outreachStatus === "new").length`
  - Contacted: `leads.filter(l => ["contacted","responded","qualified"].includes(l.outreachStatus)).length`
  - Responded: `leads.filter(l => ["responded","qualified"].includes(l.outreachStatus)).length`
  - Qualified: `leads.filter(l => l.outreachStatus === "qualified").length`
- [ ] Funnel bars use the theme accent color with opacity stepping down per stage
- [ ] Dead leads are excluded from all funnel counts

**Response rate by title segment:**
- [ ] Segment leads by title seniority using the same `seniorityScore()` logic from `IntelView.jsx` — bucket into: C-Suite, Founder, VP, Director, Manager/Senior, Other
- [ ] For each segment with at least 2 contacted leads, show: segment name, contacted count, responded count, response rate % as a colored pill
- [ ] Response rate = `(responded + qualified) / contacted * 100` — only count leads where `outreachStatus` is `"contacted"`, `"responded"`, or `"qualified"` as the denominator
- [ ] Color the rate pill: ≥ 30% green, ≥ 15% amber, < 15% red
- [ ] Sort segments by response rate descending

**Response rate by company size segment:**
- [ ] Only include leads where `lead.companySize` is non-null (requires EF-D01 to be merged; degrade gracefully if the field is missing — show "No company size data" state)
- [ ] Bucket into: 1–10, 11–50, 51–200, 201–500, 501–1000, 1000+ employees
- [ ] Parse `companySize` as an integer (it is stored as a string from Apollo)
- [ ] Same response rate pill and sort logic as title segments

**Contacted-per-day 14-day bar chart:**
- [ ] Show the last 14 calendar days as columns (most recent on the right)
- [ ] Column height = count of leads where `l.contactedAt` falls on that calendar day (use `new Date(l.contactedAt).toDateString()` for grouping)
- [ ] Show day label below each column (e.g., "Mon", "Tue") and count above each bar
- [ ] Use the theme accent color; today's column uses a brighter fill or border
- [ ] Render as pure CSS/HTML — no external charting library

**Layout:**
- [ ] Single-column scrollable view with section headers: "Pipeline Funnel", "By Title", "By Company Size", "14-Day Activity"
- [ ] Each section in a card with `T.card` background and `T.border` border, 12px border-radius
- [ ] Empty state: if `leads.length === 0`, show a centered message "No leads yet — add leads from the Intel or Leads tab"
- [ ] All calculations are pure derived values inside `useMemo` blocks keyed on `leads`

### Dependencies

None (though company size segments degrade gracefully without EF-D01).

### Estimated Effort

L (6–10 hours)

---

## EF-A02: ICP Refinement — "Analyze what's working" button in `IntelView`

### Problem

After a pipeline run, the engineer has no mechanism to close the loop. The contacts returned by Apollo are scored against the ICP checklist, but there is no path from "here's what the data shows" back to "here's how to tighten your ICP for next time."

This ticket adds a post-pipeline analysis step: a button that sends current outreach outcome data to Claude and returns a structured ICP refinement suggestion, displayed inline.

### Acceptance Criteria

**Button placement:**
- [ ] When `done === true` and `contacts.length > 0` in `IntelView`, add an "Analyze what's working" button to the results toolbar (right side, next to "Send N to Leads")
- [ ] Button is secondary styled: border + accent color text, not filled
- [ ] Button is only visible after pipeline completion (`done === true`)

**Data assembly:**
- [ ] When clicked, assemble a summary payload from the current `leads` in `AppContext` filtered to `source === "intel"` (i.e., leads previously added from Intel runs, not just the current run's contacts)
- [ ] Payload includes:
  - Per-status counts: new, contacted, responded, qualified, dead
  - Top 5 responded/qualified leads: `{ title, company, industry, companySize, fitScore }`
  - Top 5 dead leads (if any): same fields
  - Current checklist criteria (the `checklist` state array from the current run)
  - Current `targetTitles` from the current run
- [ ] If fewer than 3 contacted leads exist in the store, show an inline notice: "Not enough outreach data yet — contact at least 3 leads and check back" and do not call the API

**Claude call:**
- [ ] Use the existing `chat()` helper in `IntelView` with `SONNET` model
- [ ] System prompt: `"You are a B2B sales strategist. Analyze outreach performance data and return a concise ICP refinement suggestion."`
- [ ] User message: a compact JSON-serialized version of the payload above plus the instruction: `"Based on this outreach data, suggest 2-3 specific changes to the ICP (titles, company size, industry, or qualification criteria) that would improve response rate. Return JSON: { 'summary': string, 'suggestions': [{ 'dimension': string, 'current': string, 'recommended': string, 'rationale': string }] }"`
- [ ] `maxTokens: 1024`
- [ ] Show a spinner on the button while the call is in-flight; disable the button
- [ ] Parse the response with the existing `parseJson()` utility

**Display:**
- [ ] Render the result as a dismissible card below the results toolbar, above the contact grid
- [ ] Card header: "ICP Refinement Suggestion" with a dismiss (×) button
- [ ] Show `result.summary` in 13px text
- [ ] Show each suggestion as a row: `dimension` label (bold), `current → recommended` in 12px, `rationale` in 11px muted italic
- [ ] Card uses `T.card` background with a left border in `T.accent` color (2px)
- [ ] On error, show the existing error styling (red banner) with the error message

### Dependencies

EF-A01 (establishes the response-rate data model and ensures the engineer understands the segment logic before building the prompt payload here).

### Estimated Effort

M (4–6 hours)
