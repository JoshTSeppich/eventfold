# PRD-EF-V3-04: Activity Feed

## Overview

Introduce a persistent activity log that records all lead status changes and key actions, surfaced as a dedicated timeline view with filtering and navigation back to individual leads.

---

## Tickets

---

### EF-A01: Activity Log in AppContext

**Summary:** Add an `activityLog` state (max 200 entries) to AppContext with an `addActivity` callback, localStorage persistence, and automatic logging on status changes.

**Files:**
- `AppContext.jsx`

**Parallelizable:** Yes (coordinate with other AppContext changes in EF-T01 and EF-T05)

**Depends on:** None

**Acceptance Criteria:**
- `activityLog` is an array of entries capped at 200; when the cap is exceeded, the oldest entry is removed before adding the new one.
- Each entry has the shape: `{ id, leadId, leadName, action, detail, ts }` where `ts` is an ISO timestamp.
- `addActivity(action, leadId, detail)` creates and prepends a new entry, resolving `leadName` from current leads state.
- The log is persisted to localStorage and rehydrated on app load; entries older than 90 days are pruned on load.
- Status change handlers in AppContext automatically call `addActivity` with an appropriate action string (e.g., `"status_changed"`) whenever a lead's status is updated.

---

### EF-A02: ActivityView Component

**Summary:** Build a timeline view grouped by day, with action-type filter chips, relative timestamps, and click-to-navigate on lead names.

**Files:**
- `views/ActivityView.jsx` (new)

**Parallelizable:** Yes (new file, no conflicts)

**Depends on:** EF-A01

**Acceptance Criteria:**
- The view renders `activityLog` entries grouped into day sections (e.g., "Today", "Yesterday", "March 15").
- A row of filter chips at the top allows filtering by action type; selecting a chip shows only entries matching that action.
- Each entry shows a relative timestamp (e.g., "2h ago") that updates if the view is kept open, with an absolute tooltip on hover.
- Clicking a lead name in an entry switches the app to the Leads tab and selects that lead's detail panel.
- When the log is empty or all entries are filtered out, a clear empty state message is displayed.

---

### EF-A03: Wire ActivityView into App.jsx

**Summary:** Add "Activity" as the 8th tab in App.jsx, with a badge showing today's activity count.

**Files:**
- `App.jsx`

**Parallelizable:** No

**Depends on:** EF-A02

**Acceptance Criteria:**
- An "Activity" tab appears as the 8th tab in the main navigation, rendering `ActivityView` when selected.
- The tab label includes a numeric badge showing the count of log entries created today; the badge is hidden when the count is zero.
- The badge count updates reactively as new activity entries are added during the session.
- The tab is reachable via keyboard navigation in sequence with the other tabs.
- Selecting the Activity tab does not reset or alter the active state of the Leads tab or any other tab.
