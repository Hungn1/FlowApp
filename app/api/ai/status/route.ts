import { handle, ok } from "@/lib/api-server";
import { AI_MODEL, aiConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";

export const GET = handle(async () => ok({ configured: aiConfigured(), model: AI_MODEL }));
