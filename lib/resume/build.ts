import type { ProfileDTO } from "@/lib/profile/service";
import type { ItemType, ResumeDoc, ResumeSkillGroup } from "@/lib/resume/types";
import { SECTION_ORDER, type Emphasis } from "@/lib/tracks/defaults";

// Pure function (safe in the browser): builds a resume from the profile and a track's item settings.
export type ItemRow = { itemType: ItemType; itemId: string; order: number; featured: boolean; hidden: boolean };

export const dates = (a: string, b: string) => [a, b].filter(Boolean).join(" – ");

export const SKILL_GROUP_LABEL: Record<string, string> = { tool: "Tools", technical: "Technical", design: "Design", soft: "Professional" };

/** Build the resume for a track from the profile, honoring order / featured / hidden. */
export function buildResume(profile: ProfileDTO, emphasis: Emphasis, summary: string, items: ItemRow[]): ResumeDoc {
  const byType = (t: ItemType) => items.filter((i) => i.itemType === t && !i.hidden).sort((a, b) => a.order - b.order);
  const find = <T extends { id?: string }>(list: T[], id: string) => list.find((x) => x.id === id);

  const experience = byType("experience").flatMap((i) => {
    const e = find(profile.experiences, i.itemId);
    return e ? [{ ref: { type: "experience" as const, id: e.id! }, title: e.title, company: e.company, location: e.location, dates: dates(e.start, e.end), bullets: e.bullets }] : [];
  });

  const projRows = byType("project");
  const featured = projRows.filter((r) => r.featured);
  const projects = (featured.length ? featured : projRows.slice(0, 3)).flatMap((i) => {
    const p = find(profile.projects, i.itemId);
    return p ? [{ ref: { type: "project" as const, id: p.id! }, name: p.name, kind: p.type, description: p.description, bullets: p.bullets, tools: p.tools, url: p.url }] : [];
  });

  const groups: ResumeSkillGroup[] = [];
  for (const i of byType("skill")) {
    const s = find(profile.skills, i.itemId);
    if (!s) continue;
    const label = SKILL_GROUP_LABEL[s.category] ?? "Skills";
    let g = groups.find((x) => x.label === label);
    if (!g) groups.push((g = { label, skills: [] }));
    g.skills.push({ ref: { type: "skill", id: s.id! }, name: s.name });
  }

  const certifications = byType("cert").flatMap((i) => {
    const c = find(profile.certifications, i.itemId);
    return c ? [{ ref: { type: "cert" as const, id: c.id! }, name: c.name, issuer: c.issuer, date: c.issued, inProgress: c.inProgress }] : [];
  });

  const education = byType("education").flatMap((i) => {
    const e = find(profile.educations, i.itemId);
    return e
      ? [{ ref: { type: "education" as const, id: e.id! }, school: e.school, degree: [e.degree, e.field].filter(Boolean).join(", "), dates: dates(e.start, e.end), coursework: e.coursework }]
      : [];
  });

  const c = profile.contact;
  return {
    header: {
      name: c.name, email: c.email, phone: c.phone, location: c.location,
      links: [c.linkedin, c.github, c.portfolio, ...c.otherLinks].filter(Boolean),
    },
    summary,
    sectionOrder: SECTION_ORDER[emphasis].filter((s) => s !== "summary" || summary),
    experience, projects, skills: groups, certifications, education,
  };
}

