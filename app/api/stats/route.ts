import { handle, ok } from "@/lib/api-server";
import { getStats } from "@/lib/stats/service";

export const dynamic = "force-dynamic";
export const GET = handle(async () => ok(await getStats()));
