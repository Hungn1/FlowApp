import { handle, ok, readBody } from "@/lib/api-server";
import { ProfileInput } from "@/lib/profile/schema";
import { getProfile, saveProfile } from "@/lib/profile/service";
import { syncTracksWithProfile } from "@/lib/tracks/service";

export const GET = handle(async () => ok(await getProfile()));

export const PUT = handle(async (req: Request) => {
  const input = await readBody(req, ProfileInput);
  const profile = await saveProfile(input);
  await syncTracksWithProfile();
  return ok(profile);
});
