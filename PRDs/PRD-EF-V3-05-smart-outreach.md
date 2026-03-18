# PRD-EF-V3-05: Smart Outreach Features

## Overview

Enhance the outreach workflow with booking link insertion, AI-powered reply sentiment analysis, automated follow-up copy generation, and a duplicate lead detection and merge tool.

---

## Tickets

---

### EF-S01: Booking Link in Email

**Summary:** Save a booking URL in Settings, expose an "Insert booking link" button in EmailView that injects a `{{bookingUrl}}` variable, and resolve the variable on send.

**Files:**
- `SettingsModal.jsx`
- `EmailView.jsx`
- `AppContext.jsx`

**Parallelizable:** Partially (SettingsModal and AppContext changes can proceed independently; EmailView depends on the variable being defined in AppContext)

**Depends on:** None

**Acceptance Criteria:**
- A "Booking URL" field in SettingsModal saves a URL string to AppContext and localStorage under a `bookingUrl` key.
- An "Insert booking link" button in the EmailView email composer inserts the literal string `{{bookingUrl}}` at the current cursor position.
- On send, `{{bookingUrl}}` in the email body is replaced with the saved URL before the content is passed to the send handler.
- If no booking URL is saved, clicking the insert button shows an inline prompt directing the user to add one in Settings.
- The resolved URL is shown in a send-preview step so the user can verify substitution before sending.

---

### EF-S02: Reply Sentiment Detection

**Summary:** In FollowUpsView, allow the user to paste a reply and run "Analyze Reply" to get a Claude-powered positive/neutral/negative classification with a suggested next action.

**Files:**
- `FollowUpsView.jsx`

**Parallelizable:** Yes (can be developed alongside EF-S03 in the same file, coordinate on shared state)

**Depends on:** None

**Acceptance Criteria:**
- A collapsible "Analyze Reply" panel appears per lead row in FollowUpsView with a textarea for pasting reply text.
- Clicking "Analyze Reply" sends the pasted text to Claude (Haiku) with a classification prompt and displays a result label: Positive, Neutral, or Negative.
- The result includes a one-sentence suggested next action (e.g., "Schedule a call", "Send a case study", "Mark as uninterested").
- The panel shows a loading state during the API call and an error state if the call fails.
- The classification result and suggestion persist in component state for the session without requiring re-analysis unless the pasted text changes.

---

### EF-S03: AI Follow-Up Copy

**Summary:** In FollowUpsView, add a "Generate follow-up" button for stale contacts that produces a short personalized follow-up using the lead's hook and context.

**Files:**
- `FollowUpsView.jsx`

**Parallelizable:** Yes (can be developed alongside EF-S02 in the same file, coordinate on shared state)

**Depends on:** None

**Acceptance Criteria:**
- A "Generate follow-up" button appears on each stale lead row in FollowUpsView (stale defined as no status change in 7+ days).
- Clicking the button calls Claude (Haiku) with a prompt that includes the lead's name, company, title, hook, and last contacted date.
- The generated follow-up is a 2-4 sentence email in a conversational tone, displayed in a read-only textarea below the button.
- A "Copy" button copies the generated text to the clipboard with a transient "Copied!" confirmation.
- Re-clicking "Generate follow-up" regenerates fresh copy; the previous result is replaced.

---

### EF-S04: Duplicate Detection UI

**Summary:** Add a "Find duplicates" button in LeadsView that scans for leads sharing an email or name+company, and surfaces a merge modal.

**Files:**
- `LeadsView.jsx`
- `components/leads/DuplicateModal.jsx` (new)

**Parallelizable:** No

**Depends on:** None

**Acceptance Criteria:**
- A "Find duplicates" button appears in the LeadsView toolbar and triggers a synchronous scan of all leads in AppContext.
- Duplicate groups are identified by: exact email match, or exact (case-insensitive) name + company match.
- `DuplicateModal` displays each duplicate group as a card showing both leads' fields side by side.
- The user can select which lead to keep; confirming the merge removes the other lead via the existing delete callback and merges any non-empty fields from the discarded lead onto the kept lead.
- If no duplicates are found, a toast message "No duplicates found" is shown and the modal does not open.
