import { handle, ok } from "@/lib/api-server";
import { listApplications } from "@/lib/applications/service";

export const GET = handle(async () => ok(await listApplications()));
