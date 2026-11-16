import { z } from "zod";
import type { ResumeDoc } from "@/lib/resume/types";
import { letterDocx, resumeDocx } from "./docx";
import { fitSize, letterPdf, resumePdf } from "./pdf";

export const ExportQuery = z.object({
  format: z.enum(["pdf", "docx"], { message: "format must be pdf or docx" }),
  doc: z.enum(["resume", "cover"]).default("resume"),
});

const TYPES = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };

/** Build the file and send it as a download. X-One-Page tells the app whether the resume fit on one page. */
export async function exportResponse(opts: { format: "pdf" | "docx"; resume: ResumeDoc; letter?: string; name: string }) {
  let body: Buffer;
  let fits = true;
  if (opts.letter != null) {
    body = opts.format === "pdf" ? await letterPdf(opts.resume, opts.letter) : await letterDocx(opts.resume, opts.letter);
  } else if (opts.format === "pdf") {
    ({ buffer: body, fits } = await resumePdf(opts.resume));
  } else {
    const f = fitSize(opts.resume);
    fits = f.fits;
    body = await resumeDocx(opts.resume, f.size);
  }
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": TYPES[opts.format],
      "Content-Disposition": `attachment; filename="${opts.name}.${opts.format}"`,
      "X-One-Page": String(fits),
      "Cache-Control": "no-store",
    },
  });
}
