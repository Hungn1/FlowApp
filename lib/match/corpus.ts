import type { ProfileDTO } from "@/lib/profile/service";

// Turns the profile into searchable pieces, each pointing back to the item it came from.
export type CorpusItem = { type: "experience" | "project" | "skill" | "cert" | "education"; id: string; label: string; text: string; inProgress?: boolean };

export function normalize(s: string) {
  return ` ${s.toLowerCase().replace(/[^a-z0-9+#.\s/-]/g, " ").replace(/[/-]/g, " ").replace(/\.(\s|$)/g, " ").replace(/\s+/g, " ").trim()} `;
}

export function profileCorpus(p: ProfileDTO): CorpusItem[] {
  const items: CorpusItem[] = [];
  for (const e of p.experiences) items.push({ type: "experience", id: e.id!, label: `${e.title}, ${e.company}`, text: [e.title, e.company, ...e.bullets].join(" ") });
  for (const pr of p.projects) items.push({ type: "project", id: pr.id!, label: pr.name, text: [pr.name, pr.description, ...pr.bullets, ...pr.tools].join(" ") });
  for (const s of p.skills) items.push({ type: "skill", id: s.id!, label: s.name, text: s.name });
  for (const c of p.certifications) items.push({ type: "cert", id: c.id!, label: c.inProgress ? `${c.name} (in progress)` : c.name, text: [c.name, c.issuer].join(" "), inProgress: c.inProgress });
  for (const e of p.educations) items.push({ type: "education", id: e.id!, label: [e.degree, e.field, e.school].filter(Boolean).join(", "), text: [e.degree, e.field, e.school, ...e.coursework].join(" ") });
  return items;
}

/** Every fact in the profile as one lowercase string. Used to check AI output for invented details. */
export function profileText(p: ProfileDTO) {
  const c = p.contact;
  return normalize([c.name, c.location, c.headline, ...profileCorpus(p).map((i) => i.text)].join(" "));
}

const STOP = new Set(
  `a an and or the of to in on for with without at by from as is are be been being this that these those you your our we us it its
  will would can could should may might must able ability strong excellent good great solid basic working knowledge understanding familiarity
  familiar proficiency proficient experience experienced years year yrs plus including include includes such related similar equivalent
  skills skill etc using use used other others within across about into through via per new well least one two three four five
  preferred required requirement requirements nice have has having demonstrated proven hands-on hands on level entry junior senior
  professional work works environment team teams clear clearly written verbal across both any all more most
  obtain another tools tool methods method practices practice concepts concept common e.g. i.e.`.split(/\s+/)
);

/** Meaningful words of a requirement, e.g. "Working knowledge of Figma, including auto layout" → [figma, auto, layout]. */
export function keywords(text: string): string[] {
  const words = normalize(text).trim().split(" ");
  return [...new Set(words.filter((w) => w.length > 1 && !STOP.has(w) && !/^[\d.]+$/.test(w)))];
}

export function hasWord(haystackNormalized: string, word: string) {
  return haystackNormalized.includes(` ${word} `) || (word.length > 4 && haystackNormalized.includes(` ${word}`));
}

/** Rough years of experience from "Sep 2023" / "Present" style dates. Internships and part-time count. */
export function experienceYears(p: ProfileDTO, techOnly = false): number {
  const now = new Date();
  let months = 0;
  for (const e of p.experiences) {
    if (techOnly && !e.isTechRole) continue;
    const start = parseMonth(e.start);
    const end = /present|current|now/i.test(e.end) || !e.end ? { y: now.getFullYear(), m: now.getMonth() } : parseMonth(e.end);
    if (!start || !end) continue;
    months += Math.max(0, (end.y - start.y) * 12 + (end.m - start.m));
  }
  return Math.round((months / 12) * 10) / 10;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function parseMonth(s: string): { y: number; m: number } | null {
  const y = s.match(/(19|20)\d{2}/);
  if (!y) return null;
  const m = MONTHS.findIndex((x) => s.toLowerCase().includes(x));
  return { y: Number(y[0]), m: m >= 0 ? m : 0 };
}
