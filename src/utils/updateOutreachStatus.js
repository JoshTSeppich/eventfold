// Pure function — no React state dependency. Testable standalone.
export function updateOutreachStatus(lead, newStatus, reason) {
  const isReContact =
    newStatus === "contacted" &&
    lead.outreachStatus !== "new" &&
    lead.outreachStatus !== "contacted";

  const noteBody = reason
    ? `Marked dead: '${reason}'`
    : isReContact
    ? `Re-contacted (follow-up #${(lead.followUpCount || 0) + 1})`
    : `Status: ${lead.outreachStatus} → ${newStatus}`;

  return {
    ...lead,
    outreachStatus: newStatus,
    // contactedAt is set on FIRST contact only and never reset
    contactedAt:
      newStatus === "contacted" && !lead.contactedAt
        ? new Date().toISOString()
        : lead.contactedAt,
    outreachNote: reason !== undefined ? reason : lead.outreachNote,
    followUpCount: isReContact
      ? (lead.followUpCount || 0) + 1
      : lead.followUpCount || 0,
    notes: [
      ...(lead.notes || []),
      {
        id: crypto.randomUUID(),
        body: noteBody,
        source: "system",
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
