import { db } from "@/lib/db";
import { fail, handle, ok, readBody } from "@/lib/api-server";
import { TrackItemsUpdate } from "@/lib/tracks/schema";
import { getTrackDetail } from "@/lib/tracks/service";

type Ctx = { params: Promise<{ id: string }> };

// Save the order / featured / hidden flags for every item in the track.
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { items } = await readBody(req, TrackItemsUpdate);
  if (!(await db.track.findUnique({ where: { id } }))) return fail("Track not found", 404);
  await db.$transaction(
    items.map((i) =>
      db.trackItem.upsert({
        where: { trackId_itemType_itemId: { trackId: id, itemType: i.itemType, itemId: i.itemId } },
        create: { trackId: id, ...i },
        update: { order: i.order, featured: i.featured, hidden: i.hidden },
      })
    )
  );
  return ok(await getTrackDetail(id));
});
