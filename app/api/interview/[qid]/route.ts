import { z } from "zod";
import { handle, ok, readBody } from "@/lib/api-server";
import { deleteQuestion, updateQuestion } from "@/lib/interview/service";

type Ctx = { params: Promise<{ qid: string }> };
const Patch = z
  .object({
    answer: z.string().max(10000, "Keep your answer under 10,000 characters").optional(),
    question: z.string().trim().min(5, "Write the question (at least 5 characters)").max(500).optional(),
  })
  .refine((v) => v.answer != null || v.question != null, { message: "Nothing to update" });

export const PATCH = handle(async (req: Request, { params }: Ctx) => ok(await updateQuestion((await params).qid, await readBody(req, Patch))));

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await deleteQuestion((await params).qid);
  return ok({ deleted: true });
});
