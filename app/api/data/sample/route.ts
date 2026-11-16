import { handle, ok } from "@/lib/api-server";
import { seedSample } from "@/lib/seed";

export const POST = handle(async () => ok({ added: await seedSample() }));
