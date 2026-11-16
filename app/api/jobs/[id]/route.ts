import { db } from "@/lib/db";
import { fail, handle, ok, readBody } from "@/lib/api-server";
import { JobInput } from "@/lib/jobs/schema";
import { getJob, updateJob } from "@/lib/jobs/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const job = await getJob(id);
  return job ? ok(job) : fail("Job not found", 404);
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const input = await readBody(req, JobInput);
  if (!(await db.job.findUnique({ where: { id } }))) return fail("Job not found", 404);
  return ok(await updateJob(id, input));
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!(await db.job.findUnique({ where: { id } }))) return fail("Job not found", 404);
  await db.job.delete({ where: { id } });
  return ok({ deleted: true });
});
