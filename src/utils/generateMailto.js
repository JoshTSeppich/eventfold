import { fillTemplate } from "../data/defaultTemplates.js";

export function generateMailtoUrl(lead, template, senderName = "") {
  if (!lead.email) return null;
  const { subject, body } = fillTemplate(template, lead);
  const sign = senderName ? `\n\n—\n${senderName}` : "";
  const fullBody = body + sign;

  return (
    `mailto:${encodeURIComponent(lead.email)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(fullBody)}`
  );
}
