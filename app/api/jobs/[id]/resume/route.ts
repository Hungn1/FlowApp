import { z } from "zod";
import { handle, ok, readBody } from "@/lib/api-server";
import { generateTailored, getTailored, setChangeStatuses } from "@/lib/materials/service";

type Ctx = { params: Promise<{ id: string }> };
const Generate = z.object({ mode: z.enum(["auto", "basic"]).default("auto") });
const Patch = z.object({
  changes: z
    .array(
      z.object({
        id: z.string().min(1),
        status: z.enum(["pending", "accepted", "rejected"]),
        after: z.string().trim().min(1, "The new text can't be empty").max(600, "Keep it under 600 characters").optional(),
      })
    )
    .min(1)
    .max(100),
});

export const GET = handle(async (_req: Request, { params }: Ctx) => ok(await getTailored((await params).id)));

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { mode } = await readBody(req, Generate);
  return ok(await generateTailored((await params).id, mode));
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { changes } = await readBody(req, Patch);
  return ok(await setChangeStatuses((await params).id, changes));
});
