# PRD-EF-V3-01: API Intelligence & Caching

## Overview

Reduce redundant API calls and credit consumption by introducing persistent caching layers across the pipeline. These tickets improve reliability, cost efficiency, and user experience during multi-run workflows.

---

## Tickets

---

### EF-C01: Apollo Person Cache in SQLite

**Summary:** Store every enriched contact by `apollo_id` in SQLite; check cache before bulk_match to avoid re-fetching known contacts.

**Files:**
- `lib.rs`
- `IntelView.jsx`

**Parallelizable:** Yes

**Depends on:** None

**Acceptance Criteria:**
- A SQLite table `apollo_contact_cache` exists with columns: `apollo_id`, `data` (JSON blob), `cached_at`.
- Before every `bulk_match` call, the frontend queries the cache via a Tauri command and excludes already-cached IDs from the request payload.
- Newly returned contacts are written to the cache immediately after a successful API response.
- A cache hit is recorded in the query log with the count of contacts skipped.
- Cached data is used for display without re-fetching when all requested IDs are found locally.

---

### EF-C02: Intel Pack Section Hash Cache

**Summary:** Hash each of the 4 markdown sections independently and cache Haiku stage outputs in localStorage; skip stages where the section text is unchanged.

**Files:**
- `IntelView.jsx`

**Parallelizable:** Yes (sequential within IntelView alongside other IntelView tickets)

**Depends on:** None

**Acceptance Criteria:**
- Each of the 4 intel pack sections has its text content hashed (e.g., SHA-1 or djb2) before each pipeline run.
- Stage outputs are stored in localStorage keyed by `intel_stage_{stageIndex}_{hash}`.
- On pipeline start, each stage checks localStorage for a matching hash and skips the Haiku API call if found.
- Skipped stages are visually indicated in the pipeline progress UI (e.g., "Cached" badge).
- Cache entries are invalidated and overwritten whenever the source section text changes.

---

### EF-C03: ICP Learning Loop

**Summary:** Before Stage 2 (ICP targets) and Stage 5 (strategy), inject response rate history from leads into the prompt so the model can optimize targeting recommendations.

**Files:**
- `IntelView.jsx`

**Parallelizable:** Yes

**Depends on:** None

**Acceptance Criteria:**
- Before Stage 2 and Stage 5 prompt construction, the pipeline reads leads from AppContext and computes response rates grouped by title segment and company size bucket.
- The computed summary (e.g., "VP Marketing at 50-200 person companies: 3/7 replied") is injected into the prompt as a structured context block.
- If fewer than 3 leads exist with status data, the injection is skipped and the stage runs without historical context.
- The injected context block is visible in the query log under a collapsible "ICP history" section.
- Stage output quality is not affected when historical data is absent.

---

### EF-C04: Pipeline Resume from Failure

**Summary:** Persist completed stage results to sessionStorage; on run start, detect an existing session and offer to resume from the last completed stage.

**Files:**
- `IntelView.jsx`

**Parallelizable:** Yes

**Depends on:** None

**Acceptance Criteria:**
- After each stage completes successfully, its output is written to `sessionStorage` keyed by `intel_run_{stageIndex}`.
- On pipeline run initiation, the app checks sessionStorage for an existing partial run and surfaces a "Resume from Stage N?" prompt to the user.
- Accepting the resume skips all completed stages and begins execution from the next incomplete stage.
- Declining the resume clears sessionStorage and starts a fresh run.
- sessionStorage entries are cleared upon full pipeline completion.

---

### EF-C05: Rate Limit Memory

**Summary:** On 429, store the cooldown end time in localStorage; on the next run attempt, show "Rate limited until HH:MM" rather than failing mid-pipeline.

**Files:**
- `IntelView.jsx`

**Parallelizable:** Yes

**Depends on:** None

**Acceptance Criteria:**
- When any API call returns a 429, the cooldown end time (current time + retry-after or a default 60s) is written to `localStorage` as `intel_rate_limit_until`.
- On every pipeline run attempt, the app reads `intel_rate_limit_until` and, if it is in the future, blocks the run and displays "Rate limited until HH:MM" in the UI.
- The run button is disabled while rate-limited; a countdown or timestamp is visible.
- Once the cooldown time has passed, the block is lifted automatically and the user can run normally.
- The localStorage entry is cleared after a successful run or after expiry.

---

### EF-C06: Cross-Run Contact Dedup

**Summary:** Before displaying results, call `get_cached_apollo_ids` to filter contacts already seen in previous runs, and show "N already in your cache" in the query log.

**Files:**
- `IntelView.jsx`
- `lib.rs`

**Parallelizable:** Yes

**Depends on:** EF-C01 (requires the Apollo contact cache to exist)

**Acceptance Criteria:**
- A Tauri command `get_cached_apollo_ids` is implemented in `lib.rs` and returns all `apollo_id` values currently in the SQLite cache.
- After each Intel run fetches contacts, the result set is diffed against cached IDs before rendering.
- Contacts already in the cache are excluded from the "new contacts" display list.
- The query log shows a line: "N contacts already in your cache — skipped."
- If all returned contacts are duplicates, the UI shows a clear "All contacts already cached" message rather than an empty result.
