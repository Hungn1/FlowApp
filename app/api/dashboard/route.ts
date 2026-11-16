import { handle, ok } from "@/lib/api-server";
import { getDashboard } from "@/lib/applications/service";

export const GET = handle(async () => ok(await getDashboard()));
