import { fail, handle } from "@/lib/api-server";
import { exportResponse, ExportQuery } from "@/lib/export/respond";
import { fileName } from "@/lib/export/shared";
import { getTrackDetail } from "@/lib/tracks/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const q = ExportQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const t = await getTrackDetail(id);
  if (!t) return fail("Track not found", 404);
  if (!t.profile.exists) return fail("Add your master resume on the Profile page first.", 409);
  return exportResponse({ format: q.format, resume: t.resume, name: fileName(t.resume.header.name, "Resume", t.name) });
});
