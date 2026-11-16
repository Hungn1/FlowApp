import type { JobExtraction } from "./schema";

// Offline job-posting extractor. Copies values from the text; leaves blanks when unsure.

const CERTS = [
  "CompTIA A+", "A+", "Network+", "Security+", "CySA+", "PenTest+", "CASP+", "Linux+", "Cloud+",
  "CCNA", "CCNP", "CISSP", "CISM", "CISA", "CEH", "OSCP", "GSEC", "GCIH", "SSCP", "ISC2 CC",
  "Google IT Support", "Google Cybersecurity", "Google UX Design", "ITIL", "AWS Cloud Practitioner",
  "Azure Fundamentals", "AZ-900", "MD-102", "MS-900", "HDI",
];
const CERT_RE = new RegExp(`(?:^|[^A-Za-z])(${CERTS.map((c) => c.replace(/[+.]/g, (m) => `\\${m}`)).join("|")})(?![A-Za-z])`, "gi");

const HARD_HEAD = /^(requirements|required|qualifications|minimum qualifications|basic qualifications|what you('|’)ll need|what we('|’)re looking for|you have|must have|skills( and| &) experience|who you are|about you)\b/i;
const NICE_HEAD = /^(preferred|preferred qualifications|nice to have|nice-to-have|bonus|bonus points|pluses|it('|’)s a plus|desired|additional qualifications)\b/i;
const OTHER_HEAD = /^(responsibilities|what you('|’)ll do|duties|about (the role|us|the company)|benefits|perks|compensation|the role|overview|job description|our team|why join|how to apply|equal opportunity)\b/i;
const BULLET = /^\s*(?:[•●▪◦\-*–]|\d+[.)])\s*/;

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

function money(s: string): number {
  const n = parseFloat(s.replace(/[$,\s]/g, ""));
  return /k$/i.test(s.trim()) ? n * 1000 : n;
}

function categorize(text: string): JobExtraction["requirements"][number]["category"] {
  if (/\b\d+\+?\s*(?:-|–|to)?\s*\d*\s*(?:years?|yrs?)\b/i.test(text)) return "years";
  if (/\b(bachelor|associate'?s? degree|degree|diploma|ged|b\.s\.|b\.a\.)\b/i.test(text)) return "degree";
  if (CERT_RE.test(text)) {
    CERT_RE.lastIndex = 0;
    return "cert";
  }
  CERT_RE.lastIndex = 0;
  if (/\b(certif|certified)\b/i.test(text)) return "cert";
  if (/\b(figma|sketch|adobe|jira|servicenow|zendesk|splunk|wireshark|active directory|office 365|microsoft 365|windows|macos|linux|python|sql|aws|azure|okta|intune|sccm|crowdstrike|qradar|sentinel|nessus|burp)\b/i.test(text)) return "tool";
  if (/\b(communicat|team|customer|empathy|detail|organized|self-starter|collaborat|problem.solv)\b/i.test(text)) return "skill";
  return "skill";
}

function parseYears(text: string): { min: number | null; max: number | null; preferred: boolean } {
  // Find the first "N years" style mention near experience wording.
  const re = /(\d+(?:\.\d+)?)\s*\+?\s*(?:(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*)?(?:\+\s*)?(?:years?|yrs?)(?:'|’)?\s*(?:of\s+)?(?:[a-z/,\- ]{0,40})?(?:experience|exp\b|in\s)/gi;
  let m: RegExpExecArray | null;
  let best: { min: number; max: number | null; preferred: boolean } | null = null;
  while ((m = re.exec(text))) {
    const lineStart = text.lastIndexOf("\n", m.index) + 1;
    const lineEnd = text.indexOf("\n", m.index);
    const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    const preferred = /prefer|nice|plus|bonus|ideal/i.test(line);
    const min = parseFloat(m[1]);
    const max = m[2] ? parseFloat(m[2]) : null;
    // A hard requirement beats a preferred one; otherwise keep the highest ask.
    if (!best || (best.preferred && !preferred) || (best.preferred === preferred && min > best.min)) best = { min, max, preferred };
  }
  if (!best && /\b(no (prior )?experience (is )?(required|necessary)|0\s*(?:-|–|to)\s*1 years?)\b/i.test(text)) return { min: 0, max: 1, preferred: false };
  return best ?? { min: null, max: null, preferred: false };
}

function parseDeadline(text: string): string {
  const m = text.match(/(?:apply by|deadline|applications? (?:close|due)|closing date|posting closes)[:\s]*(?:on\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mon) return `${m[3]}-${mon}-${m[2].padStart(2, "0")}`;
  }
  const n = text.match(/(?:apply by|deadline|applications? (?:close|due)|closing date)[:\s]*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (n) return `${n[3]}-${n[1].padStart(2, "0")}-${n[2].padStart(2, "0")}`;
  return "";
}

export function extractJobWithRules(text: string): JobExtraction {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);

  const field = (re: RegExp) => text.match(re)?.[1]?.trim() ?? "";
  let title = field(/^(?:job title|title|position|role)\s*[:\-]\s*(.+)$/im);
  let company = field(/^(?:company|employer|organization)\s*[:\-]\s*(.+)$/im);
  let location = field(/^(?:location|job location|based in)\s*[:\-]\s*(.+)$/im);

  if (!title) title = nonEmpty[0]?.length < 100 ? nonEmpty[0] : "";
  if (!company) {
    const at = nonEmpty.slice(0, 4).join(" ").match(/\bat\s+([A-Z][\w&.,' -]{1,50}?)(?:\s+(?:is|in|–|-|\|)|[,.]|$)/);
    company = at?.[1]?.trim() ?? "";
    if (!company && nonEmpty[1] && nonEmpty[1].length < 60 && !/remote|hybrid|on-?site|\$/i.test(nonEmpty[1])) company = nonEmpty[1];
  }
  if (!location) {
    const loc = text.match(/\b([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)*,\s*(?:[A-Z]{2}|[A-Z][a-z]+))\b/);
    location = loc?.[1] ?? "";
  }

  const lower = text.toLowerCase();
  const workMode: JobExtraction["workMode"] = /\bhybrid\b/.test(lower)
    ? "hybrid"
    : /\b(fully remote|100% remote|remote[- ]first|remote position|remote \(|work from home|remote, us|location: remote|^remote$)/m.test(lower) || /\bremote\b/.test(nonEmpty.slice(0, 5).join(" ").toLowerCase())
      ? "remote"
      : /\b(on-?site|in[- ]office|in person)\b/.test(lower)
        ? "onsite"
        : "unknown";

  let payMin: number | null = null;
  let payMax: number | null = null;
  let payPeriod: JobExtraction["payPeriod"] = "";
  const pay = text.match(/(\$\s?\d[\d,]*(?:\.\d+)?\s?[kK]?)\s*(?:-|–|to)\s*(\$?\s?\d[\d,]*(?:\.\d+)?\s?[kK]?)(\s*(?:\/|per|an|a)\s*(?:hour|hr|year|yr|annually))?/);
  if (pay) {
    payMin = money(pay[1]);
    payMax = money(pay[2]);
    payPeriod = /hour|hr/i.test(pay[3] ?? "") || payMax < 500 ? "hour" : "year";
  } else {
    const single = text.match(/(\$\s?\d[\d,]*(?:\.\d+)?\s?[kK]?)\s*(\/|per|an|a)\s*(hour|hr|year|yr)/i);
    if (single) {
      payMin = payMax = money(single[1]);
      payPeriod = /hour|hr/i.test(single[3]) ? "hour" : "year";
    }
  }

  const years = parseYears(text);

  // Requirements by section
  const requirements: JobExtraction["requirements"] = [];
  let mode: "hard" | "nice" | null = null;
  for (const raw of lines) {
    if (!raw) continue;
    const clean = raw.replace(/[:\s]+$/, "");
    if (!BULLET.test(raw) && clean.length < 60) {
      if (NICE_HEAD.test(clean)) { mode = "nice"; continue; }
      if (HARD_HEAD.test(clean)) { mode = "hard"; continue; }
      if (OTHER_HEAD.test(clean)) { mode = null; continue; }
    }
    if (mode && (BULLET.test(raw) || raw.length < 200)) {
      const item = raw.replace(BULLET, "").trim();
      if (item.length < 3) continue;
      if (/^(apply|to apply|how to apply|deadline|applications? (close|due)|salary|pay|compensation|\$|equal opportunity|we are an equal)/i.test(item)) continue;
      const kind = /\b(preferred|nice to have|a plus|bonus|ideally)\b/i.test(item) ? "nice" : mode;
      requirements.push({ text: item.slice(0, 300), kind, category: categorize(item) });
    }
  }

  const certSet = new Map<string, { name: string; hard: boolean }>();
  for (const r of requirements) {
    for (const m of r.text.matchAll(CERT_RE)) {
      const key = m[1].toLowerCase();
      const prev = certSet.get(key);
      certSet.set(key, { name: m[1], hard: (prev?.hard ?? false) || r.kind === "hard" });
    }
  }
  const requiredCerts = [...certSet.values()].filter((c) => c.hard && !/\bor\b/i.test(c.name)).map((c) => c.name);

  const degreeReq = requirements.find((r) => r.category === "degree" && r.kind === "hard");

  return {
    title: title.slice(0, 200),
    company: company.slice(0, 200),
    location: location.slice(0, 200),
    workMode,
    payMin,
    payMax,
    payPeriod,
    minYears: years.min,
    maxYears: years.max,
    yearsArePreferred: years.preferred,
    requiredDegree: degreeReq?.text.slice(0, 200) ?? "",
    requiredCerts,
    deadline: parseDeadline(text),
    labeledEntryLevel:
      /\b(entry[- ]level|junior|jr\.?|new grad|associate|tier 1|tier i|level i)\b/i.test(title) ||
      /\sI$/.test(title) ||
      /\b(entry[- ]level|new grad)\b/i.test(text.slice(0, 1500)),
    requirements: requirements.slice(0, 40),
  };
}
