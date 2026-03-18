/**
 * parseCSV — lightweight CSV parser
 * Returns { headers: string[], rows: string[][] }
 */
export function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length < 2) return { headers: [], rows: [] };

  function parseLine(line) {
    const fields = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ",") { fields.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  }

  const headers = parseLine(nonEmpty[0]).map((h) => h.trim());
  const rows = nonEmpty.slice(1).map(parseLine);
  return { headers, rows };
}

// Map common CSV column header variations to lead fields
export const FIELD_MAP = {
  name:          ["name", "full name", "fullname", "contact", "person"],
  email:         ["email", "email address", "e-mail", "work email"],
  title:         ["title", "job title", "position", "role", "job role"],
  company:       ["company", "organization", "org", "employer", "company name"],
  linkedinUrl:   ["linkedin", "linkedin url", "linkedin_url", "profile url"],
  location:      ["location", "city", "country", "region", "geography"],
  companySize:   ["company size", "employees", "headcount", "team size", "num employees"],
  industry:      ["industry", "sector", "vertical", "market"],
};

export function autoDetectColumns(headers) {
  const mapping = {};
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const [field, variants] of Object.entries(FIELD_MAP)) {
    const idx = lower.findIndex((h) => variants.some((v) => h === v || h.includes(v)));
    if (idx !== -1) mapping[field] = idx;
  }
  return mapping;
}
