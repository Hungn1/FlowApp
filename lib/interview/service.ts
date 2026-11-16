import { z } from "zod";
import { aiConfigured, generateStructured } from "@/lib/ai";
import { jobForPrompt, profileForPrompt } from "@/lib/ai-context";
import { db } from "@/lib/db";
import { getJob, type JobDTO } from "@/lib/jobs/service";
import { analyzeMatchRules } from "@/lib/match/rules";
import { getProfile, type ProfileDTO } from "@/lib/profile/service";
import { AiError } from "@/lib/ai";
import { BEHAVIORAL, TRACK_QUESTIONS } from "./bank";

export const CATEGORIES = ["job", "track", "behavioral", "custom"] as const;
export type Category = (typeof CATEGORIES)[number];
export type QuestionDTO = { id: string; category: Category; question: string; answer: string; order: number };

const notFound = () => new AiError("Job not found", 404);

const toDTO = (q: { id: string; category: string; question: string; answer: string; order: number }): QuestionDTO => ({
  id: q.id,
  category: (CATEGORIES as readonly string[]).includes(q.category) ? (q.category as Category) : "custom",
  question: q.question,
  answer: q.answer,
  order: q.order,
});

export async function listQuestions(jobId: string): Promise<QuestionDTO[]> {
  if (!(await db.job.findUnique({ where: { id: jobId }, select: { id: true } }))) throw notFound();
  const qs = await db.interviewQuestion.findMany({ where: { jobId }, orderBy: { order: "asc" } });
  return qs.map(toDTO);
}

/**
 * (Re)generate questions. Questions you've already answered, and ones you added yourself, are kept.
 * Returns the full list and whether AI was used.
 */
export async function generateQuestions(jobId: string, mode: "auto" | "basic"): Promise<{ questions: QuestionDTO[]; source: "ai" | "basic" }> {
  const [job, profile] = await Promise.all([getJob(jobId), getProfile()]);
  if (!job) throw notFound();
  const useAi = mode === "auto" && aiConfigured();
  const fresh = useAi ? await aiQuestions(job, profile) : basicQuestions(job, profile);

  const existing = await db.interviewQuestion.findMany({ where: { jobId }, orderBy: { order: "asc" } });
  const keep = existing.filter((q) => q.answer.trim() || q.category === "custom");
  const seen = new Set(keep.map((q) => q.question.trim().toLowerCase()));
  const add = fresh.filter((q) => !seen.has(q.question.trim().toLowerCase()));

  await db.$transaction([
    db.interviewQuestion.deleteMany({ where: { jobId, id: { notIn: keep.map((q) => q.id) } } }),
    ...keep.map((q, i) => db.interviewQuestion.update({ where: { id: q.id }, data: { order: rank(q.category) * 1000 + i } })),
    ...add.map((q, i) => db.interviewQuestion.create({ data: { jobId, category: q.category, question: q.question, order: rank(q.category) * 1000 + keep.length + i } })),
  ]);
  return { questions: await listQuestions(jobId), source: useAi ? "ai" : "basic" };
}

const rank = (c: string) => Math.max(0, CATEGORIES.indexOf(c as Category));

export async function addQuestion(jobId: string, question: string): Promise<QuestionDTO> {
  if (!(await db.job.findUnique({ where: { id: jobId }, select: { id: true } }))) throw notFound();
  const count = await db.interviewQuestion.count({ where: { jobId } });
  return toDTO(await db.interviewQuestion.create({ data: { jobId, category: "custom", question, order: rank("custom") * 1000 + count } }));
}

export async function updateQuestion(id: string, data: { answer?: string; question?: string }): Promise<QuestionDTO> {
  if (!(await db.interviewQuestion.findUnique({ where: { id } }))) throw new AiError("Question not found", 404);
  return toDTO(await db.interviewQuestion.update({ where: { id }, data }));
}

export async function deleteQuestion(id: string) {
  await db.interviewQuestion.deleteMany({ where: { id } });
}

type NewQ = { category: Exclude<Category, "custom">; question: string };

function trackKey(job: JobDTO) {
  const name = job.track?.name.toLowerCase() ?? "";
  if (/ux|ui|design/.test(name)) return "ux-ui";
  if (/secur|cyber|soc/.test(name)) return "cybersecurity";
  if (/support|help|desk|it\b/.test(name)) return "tech-support";
  return "general";
}

function basicQuestions(job: JobDTO, profile: ProfileDTO): NewQ[] {
  const out: NewQ[] = [];
  const reqs = job.requirements.filter((r) => !["years", "degree"].includes(r.category));
  const match = profile.exists ? analyzeMatchRules(job, profile) : null;
  const met = (id: string) => match?.requirements.find((r) => r.requirementId === id)?.met;
  for (const r of reqs.filter((r) => r.kind === "hard" && met(r.id) !== "no" && met(r.id) !== "unknown").slice(0, 4)) {
    const text = r.text.replace(/[.\s]+$/, "");
    out.push({
      category: "job",
      question: r.category === "cert" ? `The posting lists "${text}". What did you learn preparing for it, and how have you used it?` : `This role asks for "${text}". Tell me about a time you showed that.`,
    });
  }
  for (const r of reqs.filter((r) => met(r.id) === "no").slice(0, 2)) {
    out.push({ category: "job", question: `You don't list "${r.text.replace(/[.\s]+$/, "")}" yet. How would you get up to speed on it in your first month?` });
  }
  out.push({ category: "job", question: `What do you know about ${job.company}, and why do you want this ${job.title} role?` });
  for (const q of TRACK_QUESTIONS[trackKey(job)]) out.push({ category: "track", question: q });
  for (const q of BEHAVIORAL) out.push({ category: "behavioral", question: q });
  return out;
}

const QSchema = z.object({
  questions: z.array(
    z.object({
      category: z.enum(["job", "track", "behavioral"]).describe("job = about this posting's specific requirements; track = technical questions for this kind of role; behavioral = STAR-style"),
      question: z.string(),
    })
  ),
});

async function aiQuestions(job: JobDTO, profile: ProfileDTO): Promise<NewQ[]> {
  const out = await generateStructured({
    schema: QSchema,
    system:
      "You prepare an entry-level candidate for a job interview. Write the questions this employer is likely to ask: " +
      "6 'job' questions tied to this posting's requirements and the candidate's gaps, 8 'track' technical questions for this kind of role at entry level, " +
      "and 6 'behavioral' questions that fit the candidate's actual background. Questions only, no answers. Plain, natural wording.",
    prompt: `JOB:\n${jobForPrompt(job)}\n\nTRACK: ${job.track?.name ?? "none"}\nEXAMPLE TRACK QUESTIONS:\n${TRACK_QUESTIONS[trackKey(job)].join("\n")}\n\nCANDIDATE PROFILE:\n${profile.exists ? profileForPrompt(profile) : "(empty)"}`,
    effort: "low",
    maxTokens: 6000,
  });
  return out.questions.filter((q) => q.question.trim()).slice(0, 30).map((q) => ({ category: q.category, question: q.question.trim() }));
}
