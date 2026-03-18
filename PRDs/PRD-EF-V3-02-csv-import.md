# PRD-EF-V3-02: CSV Import

## Overview

Allow users to import leads from a CSV file or pasted CSV text. The import flow handles column mapping, deduplication by email, and a preview step before committing changes.

---

## Tickets

---

### EF-I01: CSV Parser Utility

**Summary:** Implement a pure JS CSV parsing function that handles quoted fields, comma/semicolon delimiters, and BOM stripping.

**Files:**
- `utils/parseCSV.js` (new)

**Parallelizable:** Yes

**Depends on:** None

**Acceptance Criteria:**
- `parseCSV(text)` returns an array of row objects keyed by header names.
- Quoted fields containing commas or newlines are parsed correctly.
- Both comma (`,`) and semicolon (`;`) delimiters are auto-detected per file.
- A UTF-8 BOM (`\uFEFF`) at the start of the input is stripped before parsing.
- Empty rows and rows with only whitespace are ignored.

---

### EF-I02: CsvImportModal Component

**Summary:** Build a modal with file input and paste textarea, automatic column detection, a mapping UI, a 5-row preview, and an import action that deduplicates by email.

**Files:**
- `components/leads/CsvImportModal.jsx` (new)

**Parallelizable:** Yes

**Depends on:** EF-I01

**Acceptance Criteria:**
- The modal exposes two input methods: file picker (`.csv`) and a paste textarea; both feed the same parser.
- After parsing, detected column headers are matched to lead fields (`name`, `email`, `company`, `title`, `hook`) by case-insensitive header name; unmatched columns show a dropdown for manual assignment.
- A preview table renders the first 5 rows using the current column mapping before the user confirms.
- On import, `addLeads` is called with the mapped rows; rows whose email already exists in AppContext are silently skipped.
- After import, a summary toast shows "N leads imported, N duplicates skipped."

---

### EF-I03: Wire CSV Import into LeadsView

**Summary:** Add an "Import CSV" button to the LeadsView toolbar that opens the CsvImportModal overlay.

**Files:**
- `LeadsView.jsx`

**Parallelizable:** No (LeadsView has concurrent changes across other tickets)

**Depends on:** EF-I02

**Acceptance Criteria:**
- An "Import CSV" button appears in the LeadsView toolbar alongside existing action buttons.
- Clicking the button renders `CsvImportModal` as an overlay without navigating away from the view.
- The modal can be dismissed via an explicit close action or by clicking the backdrop, with no partial import committed.
- After a successful import, the modal closes and the leads list reflects the newly added rows immediately.
- The button is disabled while the modal is open to prevent double-triggers.
