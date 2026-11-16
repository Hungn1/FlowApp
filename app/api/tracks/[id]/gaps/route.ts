import { fail, handle, ok } from "@/lib/api-server";
import { db } from "@/lib/db";
import { getSkillGaps } from "@/lib/stats/service";

type Ctx = { params: Promise<{ id: string }> };
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!(await db.track.findUnique({ where: { id }, select: { id: true } }))) return fail("Track not found", 404);
  return ok(await getSkillGaps(id));
});
