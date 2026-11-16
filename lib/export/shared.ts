import type { ResumeDoc } from "@/lib/resume/types";

/** Removes the "(sample)" marker from the sample profile's name. */
export const cleanName = (s: string) => s.replace(/\s*\(sample\)\s*/i, " ").trim();

export const contactLine = (r: ResumeDoc) =>
  [r.header.location, r.header.phone, r.header.email, ...r.header.links].filter(Boolean).join(" | ");

/** "Jordan Lee", "Resume", "Lumen Dental Group" → "Jordan-Lee-Resume-Lumen-Dental-Group" */
export function fileName(...parts: string[]) {
  return parts
    .map((p) => cleanName(p).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("-")
    .slice(0, 100) || "export";
}
