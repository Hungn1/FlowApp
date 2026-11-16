import { db } from "@/lib/db";
import { fail, handle, ok, readBody } from "@/lib/api-server";
import { toJson } from "@/lib/json";
import { TrackUpdate } from "@/lib/tracks/schema";
import { getTrackDetail } from "@/lib/tracks/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const t = await getTrackDetail(id);
  return t ? ok(t) : fail("Track not found", 404);
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const input = await readBody(req, TrackUpdate);
  const exists = await db.track.findUnique({ where: { id } });
  if (!exists) return fail("Track not found", 404);
  if (input.name) {
    const clash = await db.track.findFirst({ where: { name: input.name, NOT: { id } } });
    if (clash) return fail("Please fix the highlighted fields.", 422, { name: ["You already have a track with that name"] });
  }
  await db.track.update({
    where: { id },
    data: { ...input, keywords: input.keywords ? toJson(input.keywords) : undefined },
  });
  return ok(await getTrackDetail(id));
});

// Jobs in a deleted track are kept and become "Unassigned".
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const exists = await db.track.findUnique({ where: { id } });
  if (!exists) return fail("Track not found", 404);
  await db.track.delete({ where: { id } });
  return ok({ deleted: true });
});
