import { z } from "zod";
import { generateStructured } from "@/lib/ai";
import { jobForPrompt, profileForPrompt } from "@/lib/ai-context";
import type { JobDTO } from "@/lib/jobs/service";
import type { ProfileDTO } from "@/lib/profile/service";
import { profileCorpus } from "./corpus";
import { computeScore, type RequirementResult } from "./types";

const MatchSchema = z.object({
  requirements: z.array(
    z.object({
      id: z.string().describe("Requirement id from the job"),
      met: z.enum(["yes", "partial", "no", "unknown"]).describe("unknown = a resume can't show it (shifts, driver's license, work authorization)"),
      evidence: z.string().describe("One sentence quoting or naming the profile facts that support the verdict, or what is missing"),
      profileItemIds: z.array(z.string()).describe("Ids of profile items that support this requirement, max 3"),
    })
  ),
  missingKeywords: z.array(z.string()).describe("Up to 12 tools, skills or terms from the posting that the profile never mentions"),
  transferable: z
    .array(z.object({ requirementId: z.string(), suggestion: z.string().describe("How a real profile fact can be framed to address this requirement, honestly") }))
    .describe("For partial or missing requirements only, where an existing profile fact is genuinely relevant"),
  summary: z.string().describe("Two sentences: overall fit and the single most important gap"),
});

export async function analyzeMatchAI(job: JobDTO, profile: ProfileDTO) {
  const out = await generateStructured({
    schema: MatchSchema,
    system:
      "You compare one candidate's profile to one job posting's requirements. Judge each requirement strictly against the profile. " +
      "'yes' only when the profile clearly shows it; 'partial' when related but weaker (coursework, labs, in-progress certs, fewer years); 'no' when absent. " +
      "Internships, labs and projects count toward experience only when the posting says so. Transferable suggestions must rely only on facts in the profile; never suggest claiming something not in it.",
    prompt: `PROFILE:\n${profileForPrompt(profile)}\n\nJOB:\n${jobForPrompt(job)}\n\nAnalyze every requirement id in the job.`,
    effort: "low",
  });

  const items = new Map(profileCorpus(profile).map((i) => [i.id, i]));
  const reqIds = new Set(job.requirements.map((r) => r.id));
  const byId = new Map(out.requirements.filter((r) => reqIds.has(r.id)).map((r) => [r.id, r]));

  const requirements: RequirementResult[] = job.requirements.map((r) => {
    const a = byId.get(r.id);
    return {
      requirementId: r.id,
      text: r.text,
      kind: r.kind,
      met: a?.met ?? "unknown",
      evidence: a?.evidence ?? "Not analyzed.",
      // Keep only ids that really exist in the profile.
      coveredBy: (a?.profileItemIds ?? []).flatMap((id) => {
        const it = items.get(id);
        return it ? [{ type: it.type, id: it.id, label: it.label, why: "" }] : [];
      }).slice(0, 3),
    };
  });

  return {
    score: computeScore(requirements),
    summary: out.summary,
    requirements,
    missingKeywords: [...new Set(out.missingKeywords.map((k) => k.trim()).filter(Boolean))].slice(0, 12),
    transferable: out.transferable.filter((t) => reqIds.has(t.requirementId) && t.suggestion.trim()),
  };
}
