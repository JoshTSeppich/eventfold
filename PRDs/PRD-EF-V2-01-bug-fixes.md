# PRD-EF-V2-01: Critical Bug Fixes

**Epic:** Critical Bug Fixes
**Version:** v2.0
**Status:** Ready for development
**All tickets are independent — no cross-dependencies. Can be parallelized across engineers.**

---

## Overview

Five bugs in the current v1 codebase cause silent failures, security risks, and incorrect UX behavior. All are surgical fixes with no design changes required.

---

## EF-B01: Fix `github.rs` IssueResult status value

### Problem

In `src-tauri/src/github.rs` line 69, a successfully created GitHub issue returns `status: "success"`. However, `FeaturesView.jsx` (line 356) filters with `r.status === "created"` to count successes and render the success state. This means **every issue creation always shows 0 successes** in the confirmation view — the success branch `${success.length} Issues Created` is never reached, and the green border on result items never renders.

**Root cause:** String mismatch between Rust emitter and JS consumer.

```rust
// github.rs line 69 — current (wrong)
status: "success".into(),

// FeaturesView.jsx line 356 — consumer expects
const success = issueResults.filter(r => r.status === "created");
```

### Acceptance Criteria

- [ ] In `src-tauri/src/github.rs`, change the success branch `status: "success".into()` to `status: "created".into()`
- [ ] Rebuild the Tauri binary and confirm the confirmation sub-view in `FeaturesView` shows correct success count
- [ ] Verify the green border (`T.green + "40"`) appears on successfully created issues in the confirmation list
- [ ] Verify the `${success.length} Issues Created` heading renders when all issues succeed
- [ ] Verify the error path still sets `status: "error"` (no change required there)
- [ ] No changes to `FeaturesView.jsx` are required; fix is Rust-only

### Dependencies

None.

### Estimated Effort

S (< 30 minutes — single string change + rebuild)

---

## EF-B02: Remove hardcoded Apollo API key fallback from `IntelView`

### Problem

`IntelView.jsx` line 338 contains:

```js
const apolloKey = settings.apolloKey || "TlHGetzVDxtVJTl_OZNGCQ";
```

This hardcodes a real Apollo API key as a fallback. Consequences:
1. **Security**: The key is embedded in the shipped binary and visible in source.
2. **Behavior**: Users who have not configured their own Apollo key silently use a shared key, masking a missing-settings error.
3. **Billing**: The key owner is charged for every user's API calls.

The Anthropic key path (line 337) correctly has no fallback and shows a warning banner — Apollo must follow the same pattern.

### Acceptance Criteria

- [ ] Remove the hardcoded `"TlHGetzVDxtVJTl_OZNGCQ"` string entirely from `IntelView.jsx`
- [ ] `apolloKey` must resolve only from `settings.apolloKey` with no fallback: `const apolloKey = settings.apolloKey || ""`
- [ ] Add a warning banner below the Anthropic key warning for when `apolloKey` is falsy — same visual style as the existing `!anthropicKey` banner (lines 531–535 in `IntelView.jsx`): "Apollo API key not set — go to Settings"
- [ ] Disable the "Run Intel Pipeline" button when `apolloKey` is empty (currently disabled only when `!markdown.trim()` — add `|| !apolloKey` to the disabled condition)
- [ ] Confirm `SettingsModal.jsx` already has an `apolloKey` input field (verify — no changes needed there if present)
- [ ] No Apollo key appears anywhere in committed source after the fix (run `grep -r "TlHGetz" src/` returns empty)

### Dependencies

None.

### Estimated Effort

S (< 1 hour)

---

## EF-B03: Fix Intel → Leads bridge — `sendToLeads()` must call `addLeads()`

### Problem

In `App.jsx` lines 106–109, `handleSendToLeads` receives the contacts array from `IntelView` but does nothing with it:

```js
const handleSendToLeads = (contacts) => {
  // addLeads is called inside IntelView via useApp(); this just switches the tab
  setActiveTab("leads");
};
```

The comment is incorrect. `IntelView.sendToLeads()` (line 476–479) calls `onSendToLeads(toSend)` but does not call `addLeads()` — it relies entirely on the prop callback:

```js
function sendToLeads() {
  const toSend = contacts.filter((c) => selectedIds.has(c.id));
  onSendToLeads(toSend.length ? toSend : contacts);
}
```

The result: clicking "Send N to Leads" switches the tab but **adds zero leads**. The contacts never reach `AppContext`.

### Acceptance Criteria

- [ ] In `App.jsx`, destructure `addLeads` from `useApp()` within the `Shell` component
- [ ] Update `handleSendToLeads` to call `addLeads(contacts)` before switching tabs:
  ```js
  const handleSendToLeads = (contacts) => {
    addLeads(contacts);
    setActiveTab("leads");
  };
  ```
- [ ] Verify end-to-end: run the Intel pipeline, select contacts, click "Send to Leads", switch to Leads tab, confirm the leads appear with `source: "intel"` and `outreachStatus: "new"`
- [ ] Verify deduplication still applies — sending the same contacts twice does not create duplicates (covered by `addLeads`'s email-set dedup logic in `AppContext.jsx` lines 69–70)
- [ ] `IntelView.jsx` requires no changes

### Dependencies

None.

### Estimated Effort

S (< 30 minutes)

---

## EF-B04: Fix `FollowUpsView` stale detection — compute `now` inside `useMemo`

### Problem

In `FollowUpsView.jsx` lines 14 and 17–33:

```js
const now = Date.now();   // ← computed once at render time, outside useMemo

const followUps = useMemo(() => {
  return leads
    .map(l => {
      const age = l.contactedAt ? now - new Date(l.contactedAt).getTime() : 0;
      // ...
    })
}, [leads, now]);         // ← now is in deps but never changes after mount
```

`now` is declared outside the `useMemo` callback. Since `now` is a primitive captured at render time, and `useMemo` only re-runs when `leads` changes, `now` never updates independently. More critically, `now` is not in the React state or ref system — it's a stale closure value. If the view remains mounted across midnight (or for a long session), stale detection silently becomes incorrect because the `now` snapshot ages without re-triggering the memo.

The `now` value must be computed inside the `useMemo` callback so it is always fresh when `leads` changes.

### Acceptance Criteria

- [ ] Remove `const now = Date.now()` from the component body (line 14)
- [ ] Move `const now = Date.now()` to be the first line inside the `useMemo` callback
- [ ] Remove `now` from the `useMemo` dependency array — it is no longer an external dependency:
  ```js
  const followUps = useMemo(() => {
    const now = Date.now();
    return leads.filter(...).map(...).sort(...);
  }, [leads]);
  ```
- [ ] Verify `staleCount` still calculates correctly from the updated `followUps` array
- [ ] No behavioral change is expected in normal usage; the fix is a correctness guard for long-running sessions

### Dependencies

None.

### Estimated Effort

S (< 15 minutes)

---

## EF-B05: Fix follow-up onClick — preserve `outreachStatus: "contacted"` and only increment `followUpCount`

### Problem

In `FollowUpsView.jsx` lines 135–136, the "Follow up" anchor's `onClick` handler unconditionally resets `outreachStatus` to `"contacted"`:

```js
onClick={() => updateLead(lead.id, l => ({
  ...l,
  followUpCount: (l.followUpCount || 0) + 1,
  outreachStatus: "contacted",          // ← overwrites "responded" or "qualified"
  contactedAt: l.contactedAt || new Date().toISOString()
}))}
```

If a lead has progressed to `"responded"` or `"qualified"`, clicking "Follow up" silently regresses their status back to `"contacted"`. This is destructive: a replied lead who received a follow-up should stay `"responded"`, not be demoted.

The correct behavior: only set `outreachStatus: "contacted"` if the current status is `"new"` (as a safety net). If already `"contacted"`, `"responded"`, or `"qualified"`, leave the status unchanged and only increment `followUpCount`.

### Acceptance Criteria

- [ ] Update the `onClick` handler to conditionally set `outreachStatus`:
  ```js
  onClick={() => updateLead(lead.id, l => ({
    ...l,
    followUpCount: (l.followUpCount || 0) + 1,
    outreachStatus: l.outreachStatus === "new" ? "contacted" : l.outreachStatus,
    contactedAt: l.contactedAt || new Date().toISOString(),
  }))}
  ```
- [ ] Verify: a lead with `outreachStatus: "responded"` who receives a follow-up stays `"responded"`
- [ ] Verify: a lead with `outreachStatus: "qualified"` who receives a follow-up stays `"qualified"`
- [ ] Verify: a lead with `outreachStatus: "contacted"` who receives a follow-up stays `"contacted"` and `followUpCount` increments
- [ ] Verify: `contactedAt` is only set if not already present (existing logic — no change needed)
- [ ] `followUpCount` always increments regardless of prior status

### Dependencies

None.

### Estimated Effort

S (< 20 minutes)
