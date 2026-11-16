import type { JobDTO } from "@/lib/jobs/service";
import type { ProfileDTO } from "@/lib/profile/service";

// Compact, id-tagged views of your data for AI prompts. Ids let the AI point back to real profile items.

export function profileForPrompt(p: ProfileDTO) {
  return JSON.stringify({
    headline: p.contact.headline,
    portfolio: p.contact.portfolio,
    experiences: p.experiences.map((e) => ({ id: e.id, title: e.title, company: e.company, dates: `${e.start} – ${e.end}`, isTechRole: e.isTechRole, bullets: e.bullets })),
    projects: p.projects.map((x) => ({ id: x.id, name: x.name, type: x.type, description: x.description, bullets: x.bullets, tools: x.tools })),
    skills: p.skills.map((s) => ({ id: s.id, name: s.name, category: s.category })),
    certifications: p.certifications.map((c) => ({ id: c.id, name: c.name, issuer: c.issuer, inProgress: c.inProgress })),
    education: p.educations.map((e) => ({ id: e.id, school: e.school, degree: e.degree, field: e.field, dates: `${e.start} – ${e.end}`, coursework: e.coursework })),
  });
}

export function jobForPrompt(j: JobDTO, opts: { withDescription?: boolean } = {}) {
  return JSON.stringify({
    title: j.title,
    company: j.company,
    location: j.location,
    requirements: j.requirements.map((r) => ({ id: r.id, text: r.text, kind: r.kind, category: r.category })),
    ...(opts.withDescription !== false && j.rawDescription ? { description: j.rawDescription.slice(0, 8000) } : {}),
  });
}

export function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}
