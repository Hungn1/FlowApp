import { randomUUID } from "node:crypto";
import { z } from "zod";
import { aiConfigured, AiError, generateStructured } from "@/lib/ai";
import { jobForPrompt, profileForPrompt, wordCount } from "@/lib/ai-context";
import { db } from "@/lib/db";
import { toJson } from "@/lib/json";
import { getJob, type JobDTO } from "@/lib/jobs/service";
import { analyzeMatchAI } from "@/lib/match/ai";
import { normalize, profileText, keywords, hasWord } from "@/lib/match/corpus";
import { analyzeMatchRules } from "@/lib/match/rules";
import type { MatchResult, Source } from "@/lib/match/types";
import { getProfile, type ProfileDTO } from "@/lib/profile/service";
import { buildResume } from "@/lib/resume/build";
import { applyChanges, type Change, type ChangeStatus, type TailoredContent } from "@/lib/resume/tailor";
import type { ResumeDoc } from "@/lib/resume/types";
import { defaultItemsFor, getTrackDetail, listTracks } from "@/lib/tracks/service";

export type Mode = "auto" | "basic";

// Shown to you as a normal 404 error message.
class NotFound extends AiError {
  constructor(message: string) {
    super(message, 404);
  }
}

// Materials remember which version of the profile and job they were made from, so we can say when they're out of date.
const basisOf = (p: ProfileDTO, j: JobDTO) => `${p.updatedAt ?? ""}|${j.updatedAt}`;

async function load(jobId: string) {
  const [job, profile] = await Promise.all([getJob(jobId), getProfile()]);
  if (!job) throw new NotFound("Job not found");
  return { job, profile };
}

function needProfile(p: ProfileDTO) {
  if (!p.exists) throw new AiError("Add your master resume on the Profile page first. Everything here is built from it.", 409);
}

const wantsAI = (mode: Mode) => mode === "auto" && aiConfigured();

async function getMaterial(jobId: string, kind: string) {
  return db.material.findUnique({ where: { jobId_kind: { jobId, kind } } });
}
async function putMaterial(jobId: string, kind: string, data: { content: string; changes?: string; matchScore?: number | null; missingKeywords?: string }) {
  return db.material.upsert({ where: { jobId_kind: { jobId, kind } }, create: { jobId, kind, ...data }, update: data });
}

/* ---------------------------------- Match --------------------------------- */

type StoredMatch = Omit<MatchResult, "stale"> & { basis: string };
function withoutBasis<T extends { basis?: string }>(x: T): Omit<T, "basis"> {
  const copy = { ...x };
  delete copy.basis;
  return copy;
}

export async function getMatch(jobId: string): Promise<MatchResult | null> {
  const { job, profile } = await load(jobId);
  const m = await getMaterial(jobId, "match");
  if (!m) return null;
  const stored = JSON.parse(m.content) as StoredMatch;
  return { ...withoutBasis(stored), stale: stored.basis !== basisOf(profile, job) };
}

export async function runMatch(jobId: string, mode: Mode): Promise<MatchResult> {
  const { job, profile } = await load(jobId);
  needProfile(profile);
  const source: Source = wantsAI(mode) ? "ai" : "basic";
  const r = source === "ai" ? await analyzeMatchAI(job, profile) : analyzeMatchRules(job, profile);
  const stored: StoredMatch = { ...r, source, generatedAt: new Date().toISOString(), basis: basisOf(profile, job) };

  await db.$transaction([
    ...r.requirements.map((q) =>
      db.requirement.update({ where: { id: q.requirementId }, data: { matched: q.met === "yes", coveredBy: toJson(q.coveredBy) } })
    ),
    db.material.upsert({
      where: { jobId_kind: { jobId, kind: "match" } },
      create: { jobId, kind: "match", content: toJson(stored), matchScore: r.score, missingKeywords: toJson(r.missingKeywords) },
      update: { content: toJson(stored), matchScore: r.score, missingKeywords: toJson(r.missingKeywords) },
    }),
  ]);
  return { ...withoutBasis(stored), stale: false };
}

async function matchFor(jobId: string, mode: Mode) {
  const existing = await getMatch(jobId);
  return existing && !existing.stale ? existing : runMatch(jobId, mode === "auto" && existing?.source === "basic" ? "basic" : mode);
}

/* ----------------------------- Tailored resume ---------------------------- */

export type TailoredDTO = TailoredContent & { changes: Change[]; stale: boolean; tailored: ResumeDoc };

async function baseResume(job: JobDTO, profile: ProfileDTO): Promise<{ doc: ResumeDoc; trackName: string }> {
  const trackId = job.trackId ?? (await listTracks())[0]?.id;
  const detail = trackId ? await getTrackDetail(trackId) : null;
  if (detail) return { doc: detail.resume, trackName: detail.name };
  return { doc: buildResume(profile, "general", "", defaultItemsFor("general", profile)), trackName: "Default" };
}

function toTailoredDTO(content: string, changes: string, basis: string | null): TailoredDTO {
  const c = JSON.parse(content) as TailoredContent & { basis?: string };
  const list = JSON.parse(changes) as Change[];
  return { ...withoutBasis(c), changes: list, stale: basis != null && c.basis !== basis, tailored: applyChanges(c.base, list) };
}

export async function getTailored(jobId: string): Promise<TailoredDTO | null> {
  const { job, profile } = await load(jobId);
  const m = await getMaterial(jobId, "resume");
  return m ? toTailoredDTO(m.content, m.changes, basisOf(profile, job)) : null;
}

export async function generateTailored(jobId: string, mode: Mode): Promise<TailoredDTO> {
  const { job, profile } = await load(jobId);
  needProfile(profile);
  const { doc, trackName } = await baseResume(job, profile);
  const source: Source = wantsAI(mode) ? "ai" : "basic";
  const changes = source === "ai" ? await tailorAI(job, profile, doc, await matchFor(jobId, mode)) : tailorBasic(job, doc);
  const content: TailoredContent & { basis: string } = {
    base: doc,
    trackName,
    source,
    generatedAt: new Date().toISOString(),
    note:
      source === "basic"
        ? "Basic tailoring only moves the skills this job asks for to the front. Add an API key to also get a rewritten summary and bullets."
        : undefined,
    basis: basisOf(profile, job),
  };
  const m = await putMaterial(jobId, "resume", { content: toJson(content), changes: toJson(changes) });
  return toTailoredDTO(m.content, m.changes, content.basis);
}

export async function setChangeStatuses(jobId: string, updates: { id: string; status: ChangeStatus; after?: string }[]): Promise<TailoredDTO> {
  const m = await getMaterial(jobId, "resume");
  if (!m) throw new NotFound("Generate a tailored resume first");
  const list = JSON.parse(m.changes) as Change[];
  for (const u of updates) {
    const c = list.find((x) => x.id === u.id);
    if (!c) continue;
    c.status = u.status;
    if (u.after != null && c.kind !== "skills") c.after = u.after;
  }
  const saved = await putMaterial(jobId, "resume", { content: m.content, changes: toJson(list) });
  const { job, profile } = await load(jobId);
  return toTailoredDTO(saved.content, saved.changes, basisOf(profile, job));
}

function skillChange(doc: ResumeDoc, ids: string[], reason: string): Change | null {
  const flat = doc.skills.flatMap((g) => g.skills);
  const known = new Set(flat.map((s) => s.ref.id));
  const order = [...new Set(ids.filter((id) => known.has(id))), ...flat.map((s) => s.ref.id).filter((id) => !ids.includes(id))];
  const before = flat.map((s) => s.ref.id);
  // Order shown on the resume is per group, so compare the rendered result.
  const after = applyChanges(doc, [{ id: "x", kind: "skills", skillIds: order, label: "", before: "", after: "", reason: "", status: "accepted" }]);
  const afterFlat = after.skills.flatMap((g) => g.skills.map((s) => s.ref.id));
  if (afterFlat.join() === before.join()) return null;
  const name = (id: string) => flat.find((s) => s.ref.id === id)!.name;
  return {
    id: randomUUID(),
    kind: "skills",
    label: "Skills order",
    before: before.map(name).join(", "),
    after: afterFlat.map(name).join(", "),
    skillIds: order,
    reason,
    status: "pending",
  };
}

function tailorBasic(job: JobDTO, doc: ResumeDoc): Change[] {
  const jobText = normalize([job.title, ...job.requirements.map((r) => r.text), job.rawDescription].join(" "));
  const flat = doc.skills.flatMap((g) => g.skills);
  const scored = flat.map((s, i) => {
    const words = keywords(s.name);
    const hits = words.filter((w) => hasWord(jobText, w)).length;
    return { id: s.ref.id, score: words.length ? hits / words.length : 0, i };
  });
  const ids = scored.sort((a, b) => b.score - a.score || a.i - b.i).map((s) => s.id);
  const c = skillChange(doc, ids, "Puts the skills this posting mentions first.");
  return c ? [c] : [];
}

const TailorSchema = z.object({
  summary: z
    .object({ text: z.string().describe("New summary, max 50 words"), reason: z.string() })
    .nullable()
    .describe("null to keep the current summary"),
  bullets: z
    .array(
      z.object({
        itemId: z.string().describe("Id of the experience or project"),
        index: z.number().int().describe("0-based bullet index within that item"),
        text: z.string().describe("Rewritten bullet, max 30 words"),
        reason: z.string().describe("Which job requirement this helps, in a few words"),
      })
    )
    .describe("Only bullets worth changing, at most 8"),
  skillOrder: z.array(z.string()).describe("All skill ids from the resume, most relevant to this job first"),
});

async function tailorAI(job: JobDTO, profile: ProfileDTO, doc: ResumeDoc, match: MatchResult): Promise<Change[]> {
  const resumeForPrompt = {
    summary: doc.summary,
    experience: doc.experience.map((e) => ({ id: e.ref.id, title: e.title, company: e.company, bullets: e.bullets.map((text, index) => ({ index, text })) })),
    projects: doc.projects.map((p) => ({ id: p.ref.id, name: p.name, bullets: p.bullets.map((text, index) => ({ index, text })) })),
    skills: doc.skills.flatMap((g) => g.skills.map((s) => ({ id: s.ref.id, name: s.name }))),
  };
  const out = await generateStructured({
    schema: TailorSchema,
    system:
      "You tailor a resume to one job. You may only rephrase, reorder and change emphasis. " +
      "Every claim, tool, number and result in your output must already appear in the resume or profile you are given. " +
      "Do not add tools, certifications, metrics, team sizes or responsibilities that are not stated. Use the job's wording only where the candidate's real experience matches it. " +
      "Keep bullets in plain ATS-friendly English, starting with a strong past-tense verb. Skip bullets that are already a good fit.",
    prompt:
      `FULL PROFILE (source of truth):\n${profileForPrompt(profile)}\n\n` +
      `CURRENT RESUME FOR THIS TRACK:\n${JSON.stringify(resumeForPrompt)}\n\n` +
      `JOB:\n${jobForPrompt(job)}\n\n` +
      `MATCH ANALYSIS:\n${JSON.stringify({ requirements: match.requirements.map((r) => ({ text: r.text, met: r.met })), missingKeywords: match.missingKeywords })}`,
    effort: "medium",
  });

  const facts = profileText(profile);
  const changes: Change[] = [];

  if (out.summary && out.summary.text.trim() && out.summary.text.trim() !== doc.summary.trim()) {
    const check = factCheck(out.summary.text, doc.summary, facts, profile);
    if (check !== "drop")
      changes.push({ id: randomUUID(), kind: "summary", label: "Summary", before: doc.summary, after: out.summary.text.trim(), reason: out.summary.reason, warning: check, status: "pending" });
  }

  const seen = new Set<string>();
  for (const b of out.bullets.slice(0, 10)) {
    const exp = doc.experience.find((e) => e.ref.id === b.itemId);
    const proj = doc.projects.find((p) => p.ref.id === b.itemId);
    const item = exp ?? proj;
    const key = `${b.itemId}:${b.index}`;
    if (!item || seen.has(key) || b.index < 0 || b.index >= item.bullets.length) continue;
    seen.add(key);
    const before = item.bullets[b.index];
    const after = b.text.trim();
    if (!after || after === before) continue;
    const check = factCheck(after, before, facts, profile);
    if (check === "drop") continue;
    changes.push({
      id: randomUUID(),
      kind: "bullet",
      target: { type: exp ? "experience" : "project", id: b.itemId, index: b.index },
      label: exp ? `${exp.title}, ${exp.company}` : proj!.name,
      before,
      after,
      reason: b.reason,
      warning: check,
      status: "pending",
    });
  }

  const sc = skillChange(doc, out.skillOrder, "Puts the skills this job asks for first.");
  if (sc) changes.push(sc);
  return changes;
}

/**
 * Guard against invented facts. A new number that isn't anywhere in your profile → the change is dropped.
 * A new name or tool that isn't in your profile → kept, but flagged so you can reject it.
 */
function factCheck(after: string, before: string, facts: string, profile: ProfileDTO): string | undefined | "drop" {
  const nums = (after.match(/\d+(?:[.,]\d+)?/g) ?? []);
  const known = `${before} ${facts} ${profile.experiences.map((e) => `${e.start} ${e.end}`).join(" ")}`;
  const has = (n: string) => new RegExp(`(^|[^0-9.,])${n.replace(/[.,]/g, "[.,]")}([^0-9]|$)`).test(known);
  if (nums.some((n) => !has(n))) return "drop";
  const beforeN = normalize(before);
  const names = (after.match(/(?<=\s)[A-Z][A-Za-z0-9+#.]*(?:\s[A-Z][A-Za-z0-9+#.]*)*/g) ?? []).map((s) => s.replace(/[.,]+$/, ""));
  const unknown = names.filter((n) => keywords(n).some((w) => !hasWord(facts, w) && !hasWord(beforeN, w)));
  return unknown.length ? `Mentions ${[...new Set(unknown)].slice(0, 3).join(", ")}, which isn't in your profile. Only accept if it's true.` : undefined;
}

/* ------------------------------- Cover letter ------------------------------ */

export type CoverLetterDTO = {
  content: string;
  cited: { id: string; text: string }[];
  source: Source | "edited";
  generatedAt: string;
  updatedAt: string;
  stale: boolean;
};

type CoverMeta = { cited: { id: string; text: string }[]; source: Source | "edited"; generatedAt: string; basis: string };

function toCoverDTO(m: { content: string; changes: string; updatedAt: Date }, basis: string): CoverLetterDTO {
  const meta = JSON.parse(m.changes || "{}") as Partial<CoverMeta>;
  return {
    content: m.content,
    cited: meta.cited ?? [],
    source: meta.source ?? "edited",
    generatedAt: meta.generatedAt ?? m.updatedAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    stale: meta.basis != null && meta.basis !== basis,
  };
}

export async function getCoverLetter(jobId: string): Promise<CoverLetterDTO | null> {
  const { job, profile } = await load(jobId);
  const m = await getMaterial(jobId, "coverLetter");
  return m ? toCoverDTO(m, basisOf(profile, job)) : null;
}

export async function saveCoverLetter(jobId: string, content: string): Promise<CoverLetterDTO> {
  const { job, profile } = await load(jobId);
  const m = await getMaterial(jobId, "coverLetter");
  const meta = m ? (JSON.parse(m.changes || "{}") as CoverMeta) : { cited: [], source: "edited" as const, generatedAt: new Date().toISOString(), basis: basisOf(profile, job) };
  const saved = await putMaterial(jobId, "coverLetter", { content, changes: toJson(meta) });
  return toCoverDTO(saved, basisOf(profile, job));
}

export const MAX_COVER_WORDS = 250;

const CoverSchema = z.object({
  letter: z.string().describe("The full cover letter with greeting and sign-off, plain text, paragraphs separated by blank lines"),
  citedRequirementIds: z.array(z.string()).describe("The 2 or 3 requirement ids the letter addresses"),
});

export async function generateCoverLetter(jobId: string, mode: Mode): Promise<CoverLetterDTO> {
  const { job, profile } = await load(jobId);
  needProfile(profile);
  const match = await matchFor(jobId, mode);
  const source: Source = wantsAI(mode) ? "ai" : "basic";
  const { letter, cited } = source === "ai" ? await coverAI(job, profile, match) : coverBasic(job, profile, match);
  const meta: CoverMeta = {
    cited: cited.flatMap((id) => {
      const r = job.requirements.find((x) => x.id === id);
      return r ? [{ id, text: r.text }] : [];
    }),
    source,
    generatedAt: new Date().toISOString(),
    basis: basisOf(profile, job),
  };
  const saved = await putMaterial(jobId, "coverLetter", { content: letter, changes: toJson(meta) });
  return toCoverDTO(saved, meta.basis);
}

async function coverAI(job: JobDTO, profile: ProfileDTO, match: MatchResult) {
  const system =
    `You write short, specific cover letters for entry-level tech roles. Hard limit: ${MAX_COVER_WORDS} words including greeting and sign-off; aim for 180-220. ` +
    "Address 2 or 3 of the job's requirements by name, each backed by a concrete fact from the profile. " +
    "Only use facts in the profile: no invented numbers, tools, employers or achievements. No cliches like 'I am writing to express my interest'. " +
    `Greeting: "Dear Hiring Manager," unless a name is given. Sign off with "Sincerely," and the candidate's name: ${profile.contact.name.replace(/\s*\(sample\)/i, "")}.`;
  const prompt =
    `PROFILE:\n${profileForPrompt(profile)}\n\nJOB:\n${jobForPrompt(job)}\n\n` +
    `STRONGEST MATCHES (prefer citing these):\n${JSON.stringify(match.requirements.filter((r) => r.met === "yes" || r.met === "partial").map((r) => ({ id: r.requirementId, text: r.text, kind: r.kind, evidence: r.evidence })))}`;
  let out = await generateStructured({ schema: CoverSchema, system, prompt, effort: "medium", maxTokens: 4000 });
  if (wordCount(out.letter) > MAX_COVER_WORDS) {
    out = await generateStructured({
      schema: CoverSchema,
      system,
      prompt: `${prompt}\n\nYour previous draft was ${wordCount(out.letter)} words, over the ${MAX_COVER_WORDS}-word limit. Rewrite it under 220 words, keeping the same facts:\n\n${out.letter}`,
      effort: "medium",
      maxTokens: 4000,
    });
  }
  if (wordCount(out.letter) > MAX_COVER_WORDS) throw new AiError("The AI's letter came out too long twice. Please retry.", 502);
  const ids = new Set(job.requirements.map((r) => r.id));
  return { letter: out.letter.trim(), cited: out.citedRequirementIds.filter((id) => ids.has(id)).slice(0, 3) };
}

/** No-AI fallback: a plain template filled only with facts from your profile. */
function coverBasic(job: JobDTO, profile: ProfileDTO, match: MatchResult) {
  const name = profile.contact.name.replace(/\s*\(sample\)/i, "");
  const picks = match.requirements
    .filter((r) => r.met === "yes" && r.coveredBy.some((c) => c.type === "experience" || c.type === "project"))
    .filter((r) => !["years", "degree", "cert"].includes(job.requirements.find((x) => x.id === r.requirementId)?.category ?? "") && !/\d+\s*(\+|-|–)?\s*\d*\s*years?/i.test(r.text))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "hard" ? -1 : 1))
    .slice(0, 3);
  const usedBullets = new Set<string>();
  let lastItem = "";
  const lines = picks.flatMap((r) => {
    const cov = r.coveredBy.find((c) => c.type === "experience" || c.type === "project")!;
    const words = keywords(r.text);
    const source = cov.type === "experience" ? profile.experiences.find((x) => x.id === cov.id) : profile.projects.find((x) => x.id === cov.id);
    if (!source) return [];
    const fresh = source.bullets.filter((b) => !usedBullets.has(b));
    const bullet = fresh.find((b) => words.some((w) => hasWord(normalize(b), w))) ?? fresh[0];
    if (!bullet) return [];
    usedBullets.add(bullet);
    const again = lastItem === cov.id;
    lastItem = cov.id;
    const intro =
      "company" in source
        ? again ? "In that role, I" : `As ${article(source.title)} ${source.title} at ${source.company}, I`
        : again ? "In that project, I" : `In my ${source.name} project, I`;
    return [{ id: r.requirementId, text: `You're looking for ${lowerFirst(r.text)}. ${intro} ${lowerFirst(bullet)}.` }];
  });
  const headline = profile.contact.headline.replace(/^(i'?m|i am)\s+/i, "").replace(/^an?\s+/i, "");
  const chosen: typeof lines = [];
  for (const l of lines) if (wordCount([...chosen, l].map((x) => x.text).join(" ")) < 150) chosen.push(l);

  const letter = [
    "Dear Hiring Manager,",
    `I'm applying for the ${job.title} role at ${job.company}.${headline ? ` I'm ${article(headline)} ${lowerFirst(headline)}.` : ""}`,
    chosen.map((l) => l.text.replace(/\.\.$/, ".")).join(" "),
    `Thank you for your time. I'd welcome the chance to talk about how I can help ${job.company}.`,
    `Sincerely,\n${name}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { letter, cited: chosen.map((l) => l.id) };
}

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s).replace(/[.\s]+$/, "");
const article = (s: string) => (/^[aeiou]/i.test(s) ? "an" : "a");

/* --------------------------------- Export --------------------------------- */

/** The resume to export for a job: the tailored one (accepted changes only) if it exists, else the track resume. */
export async function resumeForExport(jobId: string): Promise<{ doc: ResumeDoc; job: JobDTO; tailored: boolean }> {
  const { job, profile } = await load(jobId);
  needProfile(profile);
  const m = await getMaterial(jobId, "resume");
  if (m) return { doc: toTailoredDTO(m.content, m.changes, null).tailored, job, tailored: true };
  return { doc: (await baseResume(job, profile)).doc, job, tailored: false };
}

export async function letterForExport(jobId: string): Promise<{ doc: ResumeDoc; job: JobDTO; letter: string }> {
  const { doc, job } = await resumeForExport(jobId);
  const m = await getMaterial(jobId, "coverLetter");
  if (!m?.content.trim()) throw new NotFound("Write a cover letter first.");
  return { doc, job, letter: m.content };
}
