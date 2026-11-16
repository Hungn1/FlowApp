import { fail, handle, ok, readBody } from "@/lib/api-server";
import { ApplicationPatch } from "@/lib/applications/schema";
import { getApplication, patchApplication } from "@/lib/applications/service";

type Ctx = { params: Promise<{ jobId: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { jobId } = await params;
  const a = await getApplication(jobId);
  return a ? ok(a) : fail("Job not found", 404);
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { jobId } = await params;
  const patch = await readBody(req, ApplicationPatch);
  const a = await patchApplication(jobId, patch);
  return a ? ok(a) : fail("Job not found", 404);
});
