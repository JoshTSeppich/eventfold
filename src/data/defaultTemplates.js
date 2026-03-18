// Variables: {{firstName}} {{fullName}} {{title}} {{company}} {{hook}}
export const DEFAULT_TEMPLATES = [
  {
    id: "tpl-001",
    name: "Event Sponsorship Pitch",
    subject: "{{company}} + [Your Event] — sponsorship opportunity",
    body: `Hi {{firstName}},

I came across {{company}} and thought there could be a strong fit for our upcoming event.

{{hook}}

We're putting together a curated group of sponsors and I'd love to explore if it makes sense for your team. Happy to send over a one-pager or jump on a quick call — whatever's easier.

Worth a conversation?`,
  },
  {
    id: "tpl-002",
    name: "Short & Direct",
    subject: "Quick question, {{firstName}}",
    body: `Hi {{firstName}},

Reaching out because {{company}} seemed like a natural fit for [Your Event].

{{hook}}

Would a 15-min call next week work to see if it makes sense?`,
  },
  {
    id: "tpl-003",
    name: "Follow-up",
    subject: "Re: {{company}} + [Your Event]",
    body: `Hi {{firstName}},

Following up on my last note — wanted to make sure it didn't get buried.

Still think {{company}} could be a great fit. Happy to share more details or answer any questions.

Let me know either way!`,
  },
];

const TEMPLATES_KEY = "ff_templates";

export function loadTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

export function saveTemplates(templates) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export function fillTemplate(template, lead) {
  const firstName = lead.name?.split(" ")[0] || "";
  const vars = {
    "{{firstName}}": firstName,
    "{{fullName}}":  lead.name || "",
    "{{title}}":     lead.title || "",
    "{{company}}":   lead.company || "",
    "{{hook}}":      lead.hook || "",
  };
  let subject = template.subject;
  let body    = template.body;
  for (const [k, v] of Object.entries(vars)) {
    subject = subject.replaceAll(k, v);
    body    = body.replaceAll(k, v);
  }
  return { subject, body };
}
