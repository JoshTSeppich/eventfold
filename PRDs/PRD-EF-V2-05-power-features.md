# PRD-EF-V2-05: Power User Features

**Epic:** Power User Features
**Version:** v2.0
**Status:** Ready for development
**All three tickets are independent and can be implemented in parallel.**

---

## Overview

Three features that unlock speed and daily workflow discipline for experienced users: a keyboard-driven command palette for instant navigation, a Today/Inbox view that surfaces exactly what needs to happen right now, and a hook library that makes the Intel pipeline's best-performing angles reusable across future runs.

---

## EF-P01: Command Palette — `⌘K` opens `CommandPalette.jsx`

### Problem

Navigating between tabs requires clicking. Copying a lead's email requires opening the Leads tab, finding the row, opening the detail panel, and clicking Copy. With 50+ leads in the system, there is no fast path to any specific lead or action. Power users who work in the app continuously are slowed by the lack of keyboard navigation.

### Acceptance Criteria

**Global keyboard listener:**
- [ ] In `App.jsx` (the `Shell` component), add a `useEffect` that registers a `keydown` listener on `window`
- [ ] Trigger when `e.key === "k" && (e.metaKey || e.ctrlKey)`: call `e.preventDefault()` and set `showPalette` state to `true`
- [ ] Press `Escape` to close: the listener should also close the palette on `Escape` when it is open
- [ ] Clean up the listener on unmount

**CommandPalette component:**
- [ ] Create `src/components/common/CommandPalette.jsx`
- [ ] Render as a centered modal overlay: fixed position, full viewport, semi-transparent backdrop (`rgba(0,0,0,0.5)`), z-index 9999
- [ ] Inner panel: max-width 560px, centered horizontally at 20% from top, `T.card` background, 12px border-radius, `T.border` border, `box-shadow: 0 16px 48px rgba(0,0,0,0.4)`
- [ ] Clicking the backdrop closes the palette

**Search input:**
- [ ] Auto-focus text input at the top of the panel, full width, no border, `T.bg` background, 16px font, 16px padding
- [ ] Placeholder: "Search leads, jump to tab, copy email…"
- [ ] Input is uncontrolled-style via `useState`; filter results on every keystroke

**Search results — three result types, rendered in a unified list:**

1. **Lead results** — search `leads` by `name` and `company` (case-insensitive `includes`):
   - Show up to 8 matching leads
   - Each row: lead name (bold), title + company (muted 12px), email if present (11px, right-aligned)
   - Two actions per lead result:
     - Primary action (Enter): jump to Leads tab and open the lead's detail panel (requires passing `onSelectLead(leadId)` callback from Shell — set `pendingLeadId` state in Shell and have `LeadsView` open the panel when it mounts with a pending ID)
     - Secondary action chip "Copy email": clicking copies `lead.email` to clipboard; show "Copied ✓" for 2 seconds

2. **Tab jump results** — only when query matches a tab name (Intel, Leads, Follow-ups, Email, Analytics, Features):
   - Show as a row: tab icon + "Go to [Tab Name]" text
   - Action: close palette and call `setActiveTab(tab.id)`

3. **Static action results** — always show if query is empty or matches:
   - "Open Settings" → `setShowSettings(true)`

**Keyboard navigation:**
- [ ] Arrow Down / Arrow Up move the active result index (highlighted row uses `T.accentGlow` background)
- [ ] Enter executes the primary action of the highlighted result
- [ ] Tab on a lead result focuses its "Copy email" chip if email is present
- [ ] Active index resets to 0 when the query changes
- [ ] Results list must be scrollable if it overflows; the active item must scroll into view (`scrollIntoView({ block: "nearest" })`)

**Result grouping:**
- [ ] Separate result types with a small section label (11px uppercase muted): "LEADS", "NAVIGATION", "ACTIONS"
- [ ] Only show a section if it has results
- [ ] Empty state (no results): show "No results for '[query]'" centered in 13px muted text

**Props interface:**
```jsx
<CommandPalette
  T={T}
  leads={leads}
  onClose={() => setShowPalette(false)}
  onSelectTab={(tabId) => setActiveTab(tabId)}
  onSelectLead={(leadId) => { setActiveTab("leads"); setPendingLeadId(leadId); }}
  onOpenSettings={() => setShowSettings(true)}
/>
```

### Dependencies

None.

### Estimated Effort

L (6–10 hours)

---

## EF-P02: Today/Inbox view — `TodayView.jsx` with three sections and daily goal bar

### Problem

The Leads tab shows all leads with filters, but no view answers the question "what should I do right now?". Users must manually scan the table for new leads worth contacting, check FollowUpsView for stale threads, and remember who has replied. There is no daily-focus UI.

### Acceptance Criteria

**Tab registration:**
- [ ] Add `{ id: "today", label: "Today", icon: "◷" }` to the `TABS` array in `App.jsx` — insert it as the second tab (after Intel, before Leads)
- [ ] Add `{activeTab === "today" && <TodayView T={T} onSwitchToLeads={() => setActiveTab("leads")} onSwitchToFollowUps={() => setActiveTab("followups")} />}` in the view area
- [ ] Create `src/views/TodayView.jsx`

**Daily goal bar:**
- [ ] At the top of the view, show a full-width goal bar component
- [ ] Reuse the `useDailyStats` hook already imported in `App.jsx` (`src/hooks/useDailyStats.js`) — import it in `TodayView`
- [ ] Display: "Today: [contactedToday] / [goal] contacted" with a fill bar
- [ ] When goal is met: bar fills green, label shows "Goal met!" with a green checkmark
- [ ] Bar fills from left; uses `T.accent` color; transitions `width` with `0.3s ease`
- [ ] Goal pill is the same component already in the titlebar — extract it to `src/components/common/DailyGoalBar.jsx` if it isn't already (there is already a `DailyGoalBar.jsx` file in `src/components/leads/` — use or adapt that)

**Section 1: "To contact today"**
- [ ] Show leads matching: `outreachStatus === "new"` AND `email` is non-null
- [ ] Sort by `fitScore` descending (nulls last)
- [ ] Limit to 10 leads
- [ ] Section header: "To contact today · [count]" (count capped at display of actual list, not total matching)
- [ ] Each lead row: name, title + company, fitScore badge (if present), email status pill, "Open in Mail" action button
- [ ] "Open in Mail" calls `invoke("open_url", { url: generateMailtoUrl(lead, templates[0]) })` and calls `updateLead` to set `outreachStatus: "contacted"` and `contactedAt: new Date().toISOString()` — same logic as `LeadDetailPanel`
- [ ] Import `generateMailtoUrl` from `../../utils/generateMailto.js` and `loadTemplates` from `../../data/defaultTemplates.js`
- [ ] If no leads match: show "No new leads with emails — add leads from the Intel tab" with a link that calls `onSwitchToLeads()`

**Section 2: "Stale follow-ups"**
- [ ] Show leads matching: `outreachStatus === "contacted"` AND `contactedAt` is more than `STALE_THRESHOLD_MS` (5 days) ago
- [ ] Import `STALE_THRESHOLD_MS` from `../../constants/outreach.js`
- [ ] Sort by `contactedAt` ascending (oldest stalest first)
- [ ] No display limit
- [ ] Section header: "Stale follow-ups · [count]" with an amber warning badge if count > 0
- [ ] Each lead row: name, title + company, "Contacted [relativeTime]" in muted amber text, `followUpCount` if > 0 as a badge
- [ ] Action buttons: "Follow up ↗" (mailto link, increments `followUpCount`, keeps `outreachStatus: "contacted"`) and "Got reply ✓" (sets `outreachStatus: "responded"`)
- [ ] If no stale leads: show a green "All clear — no overdue threads" notice
- [ ] Link to FollowUpsView via `onSwitchToFollowUps()`

**Section 3: "Awaiting qualification"**
- [ ] Show leads matching: `outreachStatus === "responded"`
- [ ] Sort by `contactedAt` descending (most recent reply first)
- [ ] Section header: "Awaiting qualification · [count]"
- [ ] Each lead row: name, title + company, responded date, fitScore badge
- [ ] Action buttons: "Qualify ✓" (sets `outreachStatus: "qualified"`) and "Pass ✗" (sets `outreachStatus: "dead"`)
- [ ] If no responded leads: show muted "No replies yet"

**Layout:**
- [ ] Three sections render vertically in a scrollable container, each as a card with `T.card` background and `T.border` border
- [ ] Sections are always shown (even when empty, showing their empty state)
- [ ] Daily goal bar is sticky at the top

### Dependencies

None.

### Estimated Effort

L (6–10 hours)

---

## EF-P03: Hook library — star hooks from Intel runs, batch-apply to leads

### Problem

After a pipeline run, `IntelView` discards the extracted `topHooks` after the contact grid is shown — they exist only in the pipeline log. Good hooks that resonate with a particular title segment cannot be saved and reused in subsequent runs or applied to manually-added leads who are missing a hook value.

This feature surfaces hooks as reusable cards post-pipeline and lets users apply them to leads in bulk.

### Acceptance Criteria

**AppContext changes:**
- [ ] Add a `savedHooks` array to `AppContext` state: `const [savedHooks, setSavedHooks] = useState(loadSavedHooks)`
- [ ] Add `HOOKS_KEY = "ef_saved_hooks_v1"` with localStorage persistence
- [ ] `loadSavedHooks()` follows the same try/catch pattern as `loadLeads()`
- [ ] Each hook object shape: `{ id: string, hook: string, angle: string, starredAt: string, appliedCount: number }`
- [ ] Expose `savedHooks`, `starHook(hookObj)`, `unstarHook(hookId)`, `incrementHookApplied(hookId)` from context
- [ ] `starHook`: adds a new entry with `id: crypto.randomUUID()` and `starredAt: new Date().toISOString()` if the same `hook` string isn't already saved (deduplicate by `hook` text)

**IntelView post-pipeline hook cards:**
- [ ] After `done === true` and `contacts.length > 0`, add a "Hooks" collapsible section in the IntelView sidebar (below the pipeline steps and query log)
- [ ] Section header: "Hooks" with a collapse toggle chevron — collapsed by default
- [ ] When expanded, render one card per entry in the current run's `topHooks` (extracted during Stage 3 `haiku3`)
- [ ] Store `topHooks` in component state so it persists through the `done` state (it is already set as `const { topHooks = [] } = parseJson(q3raw)` — lift it to a `useState` in the component)
- [ ] Each hook card: `angle` in 11px uppercase bold, `hook` text in 12px, and a star button (☆ / ★)
- [ ] Clicking star: calls `starHook({ hook: h.hook, angle: h.angle })`, button turns filled star (★) in amber (`T.amber`)
- [ ] If a hook is already in `savedHooks` (match by `hook` text), show it pre-starred
- [ ] Clicking a filled star: calls `unstarHook(existingHook.id)`, returns to ☆

**Hook library access — batch apply:**
- [ ] In `LeadsView.jsx` (or as a new modal), add a "Apply Hook" option to the bulk action bar (`BulkActionBar.jsx`) — only enabled when one or more leads are selected
- [ ] Clicking "Apply Hook" opens a `HookPickerModal.jsx` (create this file in `src/components/leads/`)
- [ ] Modal shows all `savedHooks` from context, sorted by `starredAt` descending
- [ ] Each row: `angle` label, `hook` text truncated to 2 lines, `appliedCount` badge ("Used [n]×")
- [ ] User selects one hook by clicking its row (single-select)
- [ ] "Apply to [N] leads" button: calls `updateLead` for each selected lead ID, setting `hook: selectedHook.hook`, then calls `incrementHookApplied(selectedHook.id)`
- [ ] Modal closes after apply; show a success toast using the existing `CopyToast.jsx` pattern or a new `UndoToast`
- [ ] Empty state: "No starred hooks yet — run the Intel pipeline and star the hooks you like"

**Hook library management (stretch, include in same ticket):**
- [ ] In `SettingsModal.jsx` or as a new section, add a "Saved Hooks" list showing all `savedHooks` with a delete button per hook (calls `unstarHook(id)`)
- [ ] This is a simple list + delete, no separate PRD needed

### Dependencies

None.

### Estimated Effort

L (8–12 hours)
