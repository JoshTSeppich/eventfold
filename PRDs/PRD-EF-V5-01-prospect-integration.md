# PRD-EF-V5-01: ProspectFold Integration

**Version:** EF v5  
**Status:** Ready to build  
**Summary:** Port ProspectFold (standalone Electron app) into EventFold as a native `ProspectView` tab. Replace the clipboard bridge with direct AppContext hooks. Share API keys via existing settings system.

---

## Tickets

---

### EF-V5-P01 · ProspectView.jsx  
**File:** `src/views/ProspectView.jsx` (new)  
**Parallelizable:** Yes — independent of P02/P03  
**Depends on:** Nothing (P02 completes for live search; stub the invoke call until then)

**What to build:**  
Port `prospect-crafter.jsx` from `/Users/joshuatseppich/Desktop/ProspectFold/prospect-crafter.jsx` into an EventFold view component. The source file is 1950 lines — use it as the reference implementation for all logic, data, and UI.

**Key changes vs. the Electron source:**

1. **Export signature:**  
   `export function ProspectView({ T }) { ... }`  
   No default export. Receives EventFold's T theme object.

2. **Remove Electron IPC:**  
   - Delete `window.electronAPI.*` calls entirely  
   - Apollo live company search → `invoke('search_apollo_companies', { apiKey: apolloKey, filters })` from `@tauri-apps/api/core`  
   - `openEventFold(url)` calls → `invoke('open_url', { url })` or just remove the button

3. **API key sourcing:**  
   - Remove inline API key input fields from the UI  
   - Import `useApp` from `../../context/AppContext.jsx`  
   - `const { settings } = useApp();`  
   - `settings.anthropicKey` replaces local `apiKey` state  
   - `settings.apolloKey` replaces local `apolloKey` state  
   - If a key is missing, show a small inline notice: `"Add your [Anthropic/Apollo] key in ⚙ Settings"` — do NOT show password inputs  
   - Remove all `localStorage.setItem("anthropic_key", ...)` / `localStorage.setItem("apollo_key", ...)` syncs

4. **"→ EventFold" clipboard bridge → "→ Leads":**  
   - Import `useApp` and destructure `addLeads`  
   - Replace `sendToEventFold` (clipboard write) with direct `addLeads(formattedLeads)`  
   - Each Apollo company result maps to a lead: `{ name: primaryContact, company: co.name, title: "Unknown", email: "", fit: 50, hook: "", outreachStatus: "new" }`  
   - After `addLeads()`, flash button: "✓ Added to Leads"  
   - Remove all `navigator.clipboard.writeText(__prospect_intel...)` calls

5. **Theme:**  
   - The source uses a hardcoded light-theme `T` object. Replace every color reference with the passed `T` prop (EventFold's dark/light-aware tokens).  
   - Mapping: source `indigo/violet` → `T.accent`, source `amber` → `T.amber`, source `green` → `T.green`, source `red` → `T.red`, source `bg` → `T.bg`, source `surface` → `T.surface`, source `border` → `T.border`, source `text` → `T.text`, source `textSub` → `T.textSub`, source `textMuted` → `T.textMuted`

6. **History localStorage key:**  
   Use `ef_prospect_history` (not `prospect_history`) to avoid collision if both apps are open.

7. **Keep intact from source:**  
   - Full `SUGGESTED_NAICS` and `ALL_NAICS` arrays (all 300+ codes)  
   - `ANTHROPIC_SYSTEM` prompt (verbatim)  
   - All streaming logic (`ReadableStream`, `TextDecoder`, phase label detection)  
   - NAICS selector with search + grouped dropdown  
   - Company size multi-select filter  
   - Additional context field  
   - Full results display: ICP banner, ICP grid, signals, angles, tabbed search queries, checklist, red flags, enrichment URLs  
   - `SearchCard` component with filter chips  
   - History panel (15 LRU entries, relative timestamps, click-to-restore)  
   - JSON export + Markdown copy buttons  

---

### EF-V5-P02 · Apollo Company Search (Rust)  
**File:** `src-tauri/src/lib.rs`  
**Parallelizable:** Yes — Rust only, no React deps  
**Depends on:** Nothing

**What to build:**  
Add a new Tauri command `search_apollo_companies` that proxies the Apollo mixed_companies/search API (same CORS-bypass pattern as the existing `apollo_people_search`).

```rust
#[tauri::command]
async fn search_apollo_companies(api_key: String, filters: serde_json::Value) 
  -> Result<serde_json::Value, String>
```

**Apollo endpoint:** `POST https://api.apollo.io/api/v1/mixed_companies/search`

**Request body construction from `filters`:**
```json
{
  "api_key": "<api_key>",
  "q_organization_keyword_tags": ["<filters.keywords split by comma>"],
  "organization_industries": ["<filters.industry split by comma>"],
  "organization_num_employees_ranges": ["<filters.employee_count e.g. '1,200'>"],
  "currently_using_any_of_technology_uids": ["<filters.technologies split by comma>"],
  "page": 1,
  "per_page": 25
}
```

**Response:** Return the raw JSON value from Apollo's response. Frontend handles parsing.

**Register:** Add `search_apollo_companies` to the `.invoke_handler(tauri::generate_handler![...])` list alongside existing commands.

Follow the exact same HTTP client pattern as `apollo_people_search` (use `reqwest` with async, same error handling).

---

### EF-V5-P03 · App.jsx + CommandPalette wiring  
**Files:** `src/App.jsx`, `src/components/common/CommandPalette.jsx`  
**Parallelizable:** Yes — small changes only  
**Depends on:** Nothing (ProspectView will exist at the path when P01 completes)

**What to build:**

1. **`src/App.jsx`:**  
   - Add import: `import { ProspectView } from "./views/ProspectView.jsx";`  
   - Add to TABS array (insert as first tab, before `intel`):  
     `{ id: "prospect", label: "Prospect", icon: "◉" },`  
   - Add view render (in the views section):  
     `{activeTab === "prospect" && <ProspectView T={T} />}`

2. **`src/components/common/CommandPalette.jsx`:**  
   - Add to ACTIONS array:  
     `{ id: "goto-prospect", label: "Go to Prospect Intel", icon: "◉", action: "tab:prospect" },`  
   - Insert before the existing `goto-intel` entry

