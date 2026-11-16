import { db } from "@/lib/db";
import { fail, handle, ok } from "@/lib/api-server";
import { getTrackDetail, resetTrackItems } from "@/lib/tracks/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!(await db.track.findUnique({ where: { id } }))) return fail("Track not found", 404);
  await resetTrackItems(id);
  return ok(await getTrackDetail(id));
});
