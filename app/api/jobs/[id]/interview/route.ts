import { z } from "zod";
import { handle, ok, readBody } from "@/lib/api-server";
import { addQuestion, generateQuestions, listQuestions } from "@/lib/interview/service";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), mode: z.enum(["auto", "basic"]).default("auto") }),
  z.object({ action: z.literal("add"), question: z.string().trim().min(5, "Write the question (at least 5 characters)").max(500, "Keep it under 500 characters") }),
]);

export const GET = handle(async (_req: Request, { params }: Ctx) => ok(await listQuestions((await params).id)));

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await readBody(req, Body);
  if (body.action === "generate") return ok(await generateQuestions(id, body.mode));
  return ok(await addQuestion(id, body.question));
});
