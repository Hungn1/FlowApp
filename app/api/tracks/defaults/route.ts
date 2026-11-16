import { handle, ok } from "@/lib/api-server";
import { ensureDefaultTracks } from "@/lib/tracks/service";

// Re-creates any of the three default tracks (UX/UI, Cybersecurity, Tech Support) that are missing.
export const POST = handle(async () => ok({ created: await ensureDefaultTracks() }));
