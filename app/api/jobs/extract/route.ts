import { z } from "zod";
import { aiConfigured, generateStructured } from "@/lib/ai";
import { fail, handle, ok, readBody } from "@/lib/api-server";
import { suggestTrack } from "@/lib/jobs/assign";
import { checkEntryLevel } from "@/lib/jobs/entry-level";
import { extractJobWithRules } from "@/lib/jobs/extract-rules";
import { fetchJobPage } from "@/lib/jobs/fetch-url";
import { JobExtractionSchema, type JobExtraction, type JobInputT } from "@/lib/jobs/schema";
import { listTracks } from "@/lib/tracks/service";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  text: z.string().max(60000).default(""),
  url: z.union([z.literal(""), z.string().trim().url("Enter a full URL starting with http")]).default(""),
  mode: z.enum(["auto", "rules"]).default("auto"),
});

// Extracts a draft from a pasted posting or ONE page you link. Nothing is saved here.
export const POST = handle(async (req: Request) => {
  const body = await readBody(req, Body);
  let text = body.text.trim();
  let hints: Record<string, string> = {};
  if (!text && body.url) {
    try {
      ({ text, hints } = await fetchJobPage(body.url));
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Couldn't read that page.", 422, { url: ["Couldn't read this page. Paste the description instead."] });
    }
  }
  if (text.length < 80) return fail("Paste the full job description (at least a few lines), or a job page URL.", 422, { text: ["Description is too short"] });

  let source: "ai" | "rules" = "rules";
  let ex: JobExtraction;
  if (body.mode === "rules" || !aiConfigured()) {
    ex = extractJobWithRules(text);
  } else {
    ex = await generateStructured({
      schema: JobExtractionSchema,
      system:
        "Extract structured fields from a job posting. Copy values from the text; use empty strings / null when the posting doesn't say. " +
        "Split requirements into short separate items (skills, tools, certifications, degree, years of experience, other). " +
        "Mark each requirement 'hard' if it is required/minimum/must-have, or 'nice' if preferred/bonus/plus/nice-to-have. " +
        "Include the years-of-experience requirement as its own item with category 'years'. " +
        "If the pay is hourly use payPeriod 'hour', yearly use 'year'.",
      prompt: `<posting>\n${text}\n</posting>`,
    });
    source = "ai";
  }

  // JSON-LD hints from the page win for basic fields
  const draft: JobInputT = {
    title: hints.title || ex.title,
    company: hints.company || ex.company,
    location: hints.location || ex.location,
    workMode: (hints.workMode as JobInputT["workMode"]) || ex.workMode,
    payMin: ex.payMin,
    payMax: ex.payMax,
    payPeriod: ex.payPeriod,
    sourceUrl: body.url,
    rawDescription: text,
    minYears: ex.minYears,
    maxYears: ex.maxYears,
    requiredDegree: ex.requiredDegree,
    requiredCerts: ex.requiredCerts,
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(hints.deadline ?? "") ? hints.deadline : /^\d{4}-\d{2}-\d{2}$/.test(ex.deadline) ? ex.deadline : "",
    labeledEntryLevel: ex.labeledEntryLevel,
    trackId: null,
    requirements: ex.requirements.filter((r) => r.text.trim()),
  };
  // If the posting only "prefers" the years, make sure that shows up as nice-to-have.
  if (ex.yearsArePreferred && ex.minYears != null && !draft.requirements.some((r) => r.category === "years")) {
    draft.requirements.push({ text: `${ex.minYears}+ years of experience (preferred)`, kind: "nice", category: "years" });
  }
  const tracks = await listTracks();
  const suggestion = suggestTrack(tracks, draft.title, text);
  draft.trackId = suggestion.trackId;

  return ok({ source, aiAvailable: aiConfigured(), draft, suggestion, check: checkEntryLevel(draft) });
});
