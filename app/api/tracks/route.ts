import { handle, ok, readBody } from "@/lib/api-server";
import { TrackCreate } from "@/lib/tracks/schema";
import { createTrack, listTracks } from "@/lib/tracks/service";

export const GET = handle(async () => ok(await listTracks()));

export const POST = handle(async (req: Request) => {
  const input = await readBody(req, TrackCreate);
  const track = await createTrack(input);
  return ok(track, 201);
});
