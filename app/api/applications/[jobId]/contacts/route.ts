import { db } from "@/lib/db";
import { fail, handle, ok, readBody } from "@/lib/api-server";
import { ContactInput } from "@/lib/applications/schema";
import { getApplication } from "@/lib/applications/service";

type Ctx = { params: Promise<{ jobId: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { jobId } = await params;
  const input = await readBody(req, ContactInput);
  const app = await getApplication(jobId);
  if (!app) return fail("Job not found", 404);
  const row = await db.application.findUniqueOrThrow({ where: { jobId } });
  const c = await db.contact.create({ data: { ...input, applicationId: row.id } });
  return ok(c, 201);
});
