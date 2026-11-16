import { handle } from "@/lib/api-server";
import { exportResponse, ExportQuery } from "@/lib/export/respond";
import { fileName } from "@/lib/export/shared";
import { letterForExport, resumeForExport } from "@/lib/materials/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const q = ExportQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  if (q.doc === "cover") {
    const { doc, job, letter } = await letterForExport(id);
    return exportResponse({ format: q.format, resume: doc, letter, name: fileName(doc.header.name, "Cover-Letter", job.company) });
  }
  const { doc, job } = await resumeForExport(id);
  return exportResponse({ format: q.format, resume: doc, name: fileName(doc.header.name, "Resume", job.company) });
});
