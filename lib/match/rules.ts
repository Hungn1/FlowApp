import type { JobDTO } from "@/lib/jobs/service";
import type { ProfileDTO } from "@/lib/profile/service";
import { experienceYears, hasWord, keywords, normalize, profileCorpus, type CorpusItem } from "./corpus";
import { computeScore, type CoveredBy, type Met, type RequirementResult } from "./types";

// Basic match analysis that runs without an API key: keyword overlap plus checks for years, degree and certs.

// If the profile mentions the left side, it also counts as having the right side.
const ALIASES: [RegExp, string][] = [
  [/splunk|sentinel|qradar|elastic/, "siem"],
  [/multi factor|duo|mfa/, "mfa multi factor authentication"],
  [/help desk|service desk/, "helpdesk"],
  [/servicenow|zendesk|jira|freshdesk|ticket/, "ticketing ticket"],
  [/windows|macos|linux|ubuntu/, "operating systems os"],
  [/figjam/, "miro"],
  [/miro/, "figjam whiteboard"],
  [/customer/, "customers users"],
  [/troubleshoot/, "troubleshooting"],
  [/de escalat/, "patient patience"],
  [/usability test/, "usability testing user testing"],
  [/user research/, "research interviews"],
  [/wirefram|prototyp/, "wireframes prototypes prototyping wireframing"],
  [/microsoft 365|office 365|o365/, "microsoft 365 office"],
  [/python|bash|powershell/, "scripting"],
  [/trained|team|collaborat|partnered|worked with|cross functional/, "collaboration teamwork"],
];

// Things a resume can't show (licenses, shifts, work authorization). You decide these yourself.
const LOGISTICS = /driver.?s licen|licen[cs]e to|rotating shift|shifts?\b|weekend|on.?call|travel|lift \d+|background check|drug (test|screen)|authori[sz]ed to work|citizenship|clearance|relocat|reliable transportation/i;

// Domains used to decide which jobs count toward "N years of X experience".
const DOMAINS: [RegExp, RegExp][] = [
  [/secur|soc\b|cyber|incident|threat/i, /secur|soc\b|cyber|incident|threat|siem|splunk|vulnerab/i],
  [/\bux\b|\bui\b|design/i, /design|\bux\b|\bui\b|figma|prototyp|wirefram|usability/i],
  [/help ?desk|it support|technical support|desktop support|service desk|\bit\b/i, /help ?desk|support|ticket|servicenow|active directory|password|imag/i],
  [/customer service|retail|customer.facing/i, /customer|sales|service|retail/i],
];

function expand(text: string) {
  const n = normalize(text);
  const extra = ALIASES.filter(([re]) => re.test(n)).map(([, add]) => add);
  return normalize(`${n} ${extra.join(" ")}`);
}

const BACHELOR = /bachelor|\bb\.?s\b|\bb\.?a\b|\bbs\b|\bba\b|undergraduate/i;
const MASTER = /master|\bm\.?s\b|\bmba\b/i;
const CERT_WORDS = /security\+|cysa\+|network\+|\ba\+|cissp|ccna|oscp|gsec|\bceh\b|google (ux|it)|itil|aws certified|azure fundamentals/gi;

export function analyzeMatchRules(job: JobDTO, profile: ProfileDTO) {
  const corpus = profileCorpus(profile).map((i) => ({ ...i, norm: expand(i.text) }));
  const all = normalize(corpus.map((c) => c.norm).join(" "));

  const results: RequirementResult[] = job.requirements.map((r) => {
    const base = { requirementId: r.id, text: r.text, kind: r.kind };
    const special = checkSpecial(r.text, r.category, profile, corpus);
    if (special) return { ...base, ...special };

    const words = keywords(r.text);
    if (!words.length) return { ...base, met: "partial" as Met, evidence: "Too general to check automatically.", coveredBy: [] };
    const hits = words.filter((w) => hasWord(all, w));
    const ratio = hits.length / words.length;
    const met: Met = ratio >= 0.5 ? "yes" : hits.length ? "partial" : "no";
    return {
      ...base,
      met,
      evidence: hits.length ? `Your profile mentions ${hits.slice(0, 4).join(", ")}.` : `Nothing in your profile mentions ${words.slice(0, 4).join(", ")}.`,
      coveredBy: cover(corpus, hits),
    };
  });

  return {
    score: computeScore(results),
    requirements: results,
    missingKeywords: missingKeywords(job, all),
    transferable: [],
    summary: summarize(results),
  };
}

function cover(corpus: (CorpusItem & { norm: string })[], hits: string[]): CoveredBy[] {
  return corpus
    .map((c) => ({ c, found: hits.filter((w) => hasWord(c.norm, w)) }))
    .filter((x) => x.found.length)
    .sort((a, b) => b.found.length - a.found.length || rank(a.c.type) - rank(b.c.type))
    .slice(0, 3)
    .map(({ c, found }) => ({ type: c.type, id: c.id, label: c.label, why: found.join(", ") }));
}
const rank = (t: string) => ["experience", "project", "cert", "skill", "education"].indexOf(t);

function checkSpecial(
  text: string,
  category: string,
  profile: ProfileDTO,
  corpus: (CorpusItem & { norm: string })[]
): { met: Met; evidence: string; coveredBy: CoveredBy[] } | null {
  const lower = text.toLowerCase();

  if (LOGISTICS.test(text)) return { met: "unknown", evidence: "A resume can't show this. Check it yourself.", coveredBy: [] };

  if (/portfolio/.test(lower) && profile.contact.portfolio) {
    const designProjects = corpus.filter((c) => c.type === "project");
    return {
      met: "yes",
      evidence: `Your portfolio link (${profile.contact.portfolio}) and ${designProjects.length} project${designProjects.length === 1 ? "" : "s"} in your profile.`,
      coveredBy: designProjects.slice(0, 2).map((c) => ({ type: c.type, id: c.id, label: c.label, why: "portfolio piece" })),
    };
  }

  // Years of experience
  const y = lower.match(/(\d+)\s*(?:\+|-\s*\d+|–\s*\d+|to\s*\d+)?\s*(?:\+\s*)?years?/);
  if (category === "years" || (y && /experience/.test(lower))) {
    const need = y ? Number(y[1]) : 0;
    const counts = /intern|lab|project|bootcamp|count/.test(lower);
    const domain = DOMAINS.find(([re]) => re.test(text));
    const relevant = profile.experiences.filter((e) =>
      domain ? domain[1].test([e.title, e.company, ...e.bullets].join(" ")) : e.isTechRole
    );
    const years = experienceYears({ ...profile, experiences: relevant });
    const cov = relevant.slice(0, 2).map((e) => ({ type: "experience", id: e.id!, label: `${e.title}, ${e.company}`, why: `${e.start} – ${e.end || "present"}` }));
    const what = domain ? "relevant" : "tech";
    if (need === 0) return { met: "yes", evidence: "No minimum experience required.", coveredBy: cov };
    if (years >= need) return { met: "yes", evidence: `About ${years} years of ${what} experience in your profile; ${need} needed.`, coveredBy: cov };
    if (years >= need - 1 || (counts && profile.projects.length > 0))
      return { met: "partial", evidence: `About ${years} years of ${what} experience; they ask for ${need}.${counts ? " The posting says internships, labs or projects count." : ""}`, coveredBy: cov };
    return { met: "no", evidence: `About ${years} years of ${what} experience; they ask for ${need}.`, coveredBy: cov };
  }

  // Degree
  if (category === "degree" || /degree|diploma|ged|bachelor/.test(lower)) {
    const edu = profile.educations;
    const cov = edu.slice(0, 1).map((e) => ({ type: "education", id: e.id!, label: [e.degree, e.field, e.school].filter(Boolean).join(", "), why: "degree" }));
    if (/high school|ged|diploma/.test(lower) && !/bachelor|master/.test(lower)) return { met: "yes", evidence: "A high school diploma or more is covered by your education.", coveredBy: cov };
    const wantsMaster = MASTER.test(text) && !/bachelor/i.test(text);
    const has = edu.some((e) => (wantsMaster ? MASTER : BACHELOR).test(`${e.degree} ${e.field}`) || (!wantsMaster && MASTER.test(e.degree)));
    if (has) return { met: "yes", evidence: `You have ${cov[0]?.label ?? "a matching degree"}.`, coveredBy: cov };
    if (edu.some((e) => /present|expected|current/i.test(e.end))) return { met: "partial", evidence: "Your degree is still in progress.", coveredBy: cov };
    if (/equivalent|or related experience/.test(lower)) return { met: "partial", evidence: "No matching degree, but the posting accepts equivalent experience.", coveredBy: cov };
    return { met: "no", evidence: "No matching degree in your profile.", coveredBy: cov };
  }

  // Certifications
  const certs = [...new Set((text.match(CERT_WORDS) ?? []).map((c) => c.toLowerCase()))];
  if (category === "cert" || certs.length) {
    const certItems = corpus.filter((c) => c.type === "cert");
    const names = certs.length ? certs : keywords(text);
    const found = certItems.filter((c) => names.some((n) => c.text.toLowerCase().includes(n.replace(/^comptia$/, "comptia"))));
    const cov = found.map((c) => ({ type: c.type, id: c.id, label: c.label, why: c.inProgress ? "in progress" : "certified" }));
    const anyDone = found.some((c) => !c.inProgress);
    const canObtain = /ability to obtain|within \d+ (days|months)|willing/.test(lower);
    if (anyDone) return { met: "yes", evidence: `You hold ${found.filter((c) => !c.inProgress).map((c) => c.label).join(", ")}.`, coveredBy: cov };
    if (found.length) return { met: "partial", evidence: `You're working toward ${found.map((c) => c.label).join(", ")}.`, coveredBy: cov };
    if (canObtain) return { met: "partial", evidence: "You don't hold it yet, but they let you earn it after hiring.", coveredBy: [] };
    return { met: "no", evidence: `No ${certs.join(" or ") || "matching certification"} in your profile.`, coveredBy: [] };
  }
  return null;
}

// Tools and terms the posting names that your profile never mentions.
const LEAD = /^(I|A|An|The|Tier|Level|Experience|Familiarity|Knowledge|Understanding|Strong|Ability|Basic|Excellent|Valid|Bachelor|Bachelors|Master|High|Clear|Proficiency|Proficient|Working|Hands|Hands-on|Interest|Advanced|Solid|Some|Any|Must|Preferred|Required|Degree|Certification|Certified)$/i;
function missingKeywords(job: JobDTO, all: string): string[] {
  const found = new Map<string, string>();
  for (const r of job.requirements) {
    if (LOGISTICS.test(r.text) || r.category === "degree" || /degree|diploma/i.test(r.text)) continue;
    const tokens = r.text.match(/[A-Z][A-Za-z0-9+#.]*(?:[ -][A-Z0-9][A-Za-z0-9+#.]*)*/g) ?? [];
    for (const t of tokens) {
      const atStart = r.text.trimStart().startsWith(t);
      const parts = t.replace(/[.,]+$/, "").split(" ");
      while (parts.length && LEAD.test(parts[0])) parts.shift();
      const clean = parts.join(" ");
      const acronymOrTool = /[A-Z]{2}|[+#]|[a-z][A-Z]/.test(clean);
      const properName = /^[A-Z][a-z]+(?: [A-Z][a-z]+)+$/.test(clean) || (/^[A-Z][a-z]+$/.test(clean) && !atStart);
      if (clean.length < 2 || !(acronymOrTool || properName)) continue;
      const words = keywords(clean);
      if (!words.length || words.every((w) => hasWord(all, w))) continue;
      found.set(clean.toLowerCase(), clean);
    }
  }
  return [...found.values()].slice(0, 12);
}

function summarize(results: RequirementResult[]) {
  const hard = results.filter((r) => r.kind === "hard");
  const metHard = hard.filter((r) => r.met === "yes").length;
  const gaps = hard.filter((r) => r.met === "no");
  const check = results.filter((r) => r.met === "unknown").length;
  if (!results.length) return "This job has no requirements listed yet. Add them on the Overview tab (Edit) to get a match score.";
  return `You fully meet ${metHard} of ${hard.length} hard requirements.${gaps.length ? ` Biggest gap: ${gaps[0].text}.` : " No hard gaps found."}${check ? ` ${check} item${check === 1 ? "" : "s"} (like shifts or a license) you'll need to check yourself.` : ""}`;
}
