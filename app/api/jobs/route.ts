import { handle, ok, readBody } from "@/lib/api-server";
import { JobInput } from "@/lib/jobs/schema";
import { createJob, listJobs } from "@/lib/jobs/service";

export const GET = handle(async () => ok(await listJobs()));

export const POST = handle(async (req: Request) => {
  const input = await readBody(req, JobInput);
  return ok(await createJob(input), 201);
});
