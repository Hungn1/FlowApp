import { aiConfigured, generateStructured } from "@/lib/ai";
import { fail, handle, ok } from "@/lib/api-server";
import { extractResumeText } from "@/lib/profile/extract-text";
import { parseResumeWithRules } from "@/lib/profile/parse-rules";
import { ParsedResumeSchema } from "@/lib/profile/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 5 * 1024 * 1024;

// Parses a resume into a draft. Nothing is saved until you press Save on the profile page.
export const POST = handle(async (req: Request) => {
  const form = await req.formData();
  const file = form.get("file");
  const pasted = String(form.get("text") ?? "");
  const mode = String(form.get("mode") ?? "auto"); // auto | rules

  let text = pasted.trim();
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return fail("That file is over 5 MB. Upload a smaller file or paste the text.", 413);
    try {
      text = (await extractResumeText(file)).trim();
    } catch (err) {
      return fail(err instanceof Error ? err.message : "Couldn't read that file.", 415);
    }
    if (!text) return fail("No text found in that file (it may be a scanned image). Paste the text instead.", 422);
  }
  if (text.length < 50) return fail("Paste at least a few lines of your resume, or upload a file.", 422, { text: ["Resume text is too short"] });
  if (text.length > 60000) return fail("That resume is very long. Paste only the resume (under 60,000 characters).", 422);

  if (mode === "rules" || !aiConfigured()) {
    return ok({ source: "rules", text, draft: parseResumeWithRules(text), aiAvailable: aiConfigured() });
  }

  const draft = await generateStructured({
    schema: ParsedResumeSchema,
    system:
      "Parse the resume into structured data. Copy wording verbatim; do not rewrite, summarize, or improve bullets. " +
      "Use empty strings or empty arrays for anything missing. Put coursework under education. " +
      "Project type: 'case-study' for UX/design case studies, 'lab' for security/IT labs or home labs, 'course' for class projects, otherwise 'personal'. " +
      "Skill category: 'tool' for named software/platforms, 'design' for design methods, 'soft' for interpersonal skills, else 'technical'. " +
      "List certifications that are in progress with inProgress=true.",
    prompt: `<resume>\n${text}\n</resume>`,
  });
  return ok({ source: "ai", text, draft, aiAvailable: true });
});
