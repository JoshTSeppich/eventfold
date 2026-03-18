export function exportLeadsCSV(leads) {
  const headers = ["Name", "Title", "Company", "Email", "Email Status", "Outreach Status", "Fit Score", "Contacted At", "Note"];
  const rows = leads.map((l) => [
    l.name,
    l.title,
    l.company,
    l.email || "",
    l.emailStatus,
    l.outreachStatus,
    l.fitScore ?? "",
    l.contactedAt ? new Date(l.contactedAt).toLocaleDateString() : "",
    l.outreachNote || "",
  ]);

  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const csv = [headers, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `foldfold-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
