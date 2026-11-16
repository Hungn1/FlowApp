import { z } from "zod";
import { handle, ok, readBody } from "@/lib/api-server";
import { getMatch, runMatch } from "@/lib/materials/service";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ mode: z.enum(["auto", "basic"]).default("auto") });

export const GET = handle(async (_req: Request, { params }: Ctx) => ok(await getMatch((await params).id)));

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { mode } = await readBody(req, Body);
  return ok(await runMatch((await params).id, mode));
});
