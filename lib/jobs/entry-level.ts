// Deterministic entry-level check. Same input always gives the same verdict, and it works offline.

export type Verdict = "true" | "stretch" | "not";

export const VERDICT_LABEL: Record<Verdict, string> = {
  true: "True entry-level",
  stretch: "Stretch",
  not: "Not entry-level",
};

const SENIOR_TITLE = /\b(senior|sr\.?|lead|principal|staff|manager|director|head of|architect|iii|iv|level 3|tier 3)\b/i;
const ADVANCED_CERTS = /\b(cissp|cism|cisa|oscp|osce|gpen|gcih|ccnp|ccie|casp\+?|pmp)\b/i;
const MASTERS = /\b(master'?s|m\.s\.|mba|phd|doctorate)\b/i;

type Input = {
  title: string;
  minYears: number | null;
  maxYears?: number | null;
  labeledEntryLevel: boolean;
  requiredDegree: string;
  requiredCerts: string[];
  requirements: { text: string; kind: "hard" | "nice"; category: string }[];
};

export type EntryLevelResult = { verdict: Verdict; reasons: string[]; fakeEntryLevel: boolean };

/** Years asked for, and whether that ask is a hard requirement. */
export function yearsAsk(job: Pick<Input, "minYears" | "requirements">): { years: number | null; hard: boolean } {
  const yearReqs = job.requirements.filter((r) => r.category === "years" || /\d+\+?\s*(?:-|to)?\s*\d*\s*years?/i.test(r.text));
  const hard = yearReqs.length === 0 ? true : yearReqs.some((r) => r.kind === "hard");
  return { years: job.minYears, hard };
}

export function checkEntryLevel(job: Input): EntryLevelResult {
  const reasons: string[] = [];
  let level = 0; // 0 true, 1 stretch, 2 not
  const bump = (to: number, why: string) => {
    level = Math.max(level, to);
    reasons.push(why);
  };

  const { years, hard } = yearsAsk(job);
  if (years != null) {
    if (years >= 3) bump(hard ? 2 : 1, `Asks for ${years}+ years of experience${hard ? "" : " (listed as preferred)"}`);
    else if (years >= 2) bump(1, `Asks for ${years} years of experience${hard ? "" : " (preferred)"}, the top of your 0-2 year range`);
    else {
      const range = job.maxYears != null && job.maxYears > years ? `${years}-${job.maxYears}` : `${years}`;
      reasons.push(years === 0 && job.maxYears == null ? "No prior experience required" : `Asks for ${range} ${range === "1" ? "year" : "years"} of experience, inside your 0-2 year range`);
    }
  } else {
    reasons.push("No years of experience stated");
  }

  if (SENIOR_TITLE.test(job.title)) bump(2, `Title suggests a senior role ("${job.title.match(SENIOR_TITLE)?.[0]}")`);

  const advanced = [...job.requiredCerts, ...job.requirements.filter((r) => r.kind === "hard" && r.category === "cert").map((r) => r.text)]
    .filter((c) => ADVANCED_CERTS.test(c));
  if (advanced.length) bump(2, `Requires an advanced certification (${[...new Set(advanced.map((c) => c.match(ADVANCED_CERTS)![0].toUpperCase()))].join(", ")}) that itself needs years of experience`);

  if (MASTERS.test(job.requiredDegree)) bump(1, "Requires a graduate degree");

  const hardCount = job.requirements.filter((r) => r.kind === "hard").length;
  if (hardCount >= 12) bump(1, `Long list of ${hardCount} hard requirements`);

  const verdict: Verdict = level === 2 ? "not" : level === 1 ? "stretch" : "true";
  const fakeEntryLevel = job.labeledEntryLevel && verdict === "not";
  if (fakeEntryLevel) reasons.unshift(`Labeled entry-level, but ${years != null && years >= 3 ? `demands ${years}+ years` : "the requirements are senior-level"}`);
  if (verdict === "true" && job.labeledEntryLevel) reasons.push("Labeled entry-level and the requirements agree");
  return { verdict, reasons, fakeEntryLevel };
}
