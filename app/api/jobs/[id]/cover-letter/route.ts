import { z } from "zod";
import { handle, ok, readBody } from "@/lib/api-server";
import { wordCount } from "@/lib/ai-context";
import { generateCoverLetter, getCoverLetter, MAX_COVER_WORDS, saveCoverLetter } from "@/lib/materials/service";

type Ctx = { params: Promise<{ id: string }> };
const Generate = z.object({ mode: z.enum(["auto", "basic"]).default("auto") });
const Save = z.object({
  content: z
    .string()
    .trim()
    .min(1, "The letter can't be empty")
    .superRefine((s, ctx) => {
      const n = wordCount(s);
      if (n > MAX_COVER_WORDS) ctx.addIssue({ code: "custom", message: `Keep it to ${MAX_COVER_WORDS} words or fewer (now ${n}).` });
    }),
});

export const GET = handle(async (_req: Request, { params }: Ctx) => ok(await getCoverLetter((await params).id)));

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { mode } = await readBody(req, Generate);
  return ok(await generateCoverLetter((await params).id, mode));
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { content } = await readBody(req, Save);
  return ok(await saveCoverLetter((await params).id, content));
});
