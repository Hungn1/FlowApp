import PDFDocument from "pdfkit";
import type { ResumeDoc, SectionKey } from "@/lib/resume/types";
import { SECTION_LABELS } from "@/lib/resume/types";
import { cleanName, contactLine } from "./shared";

// ATS-friendly PDF: one column, standard fonts, real text (no images or tables), plain bullets.
// The font size shrinks step by step until the resume fits on one page.

const PAGE = { w: 612, h: 792 }; // US Letter
const MARGIN = 40;
const WIDTH = PAGE.w - MARGIN * 2;
const BOTTOM = PAGE.h - MARGIN;

type Pdf = PDFKit.PDFDocument;

function newDoc(title: string, author: string) {
  return new PDFDocument({ size: "LETTER", margin: MARGIN, info: { Title: title, Author: author }, bufferPages: true });
}

function toBuffer(doc: Pdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

/** Lays the resume out at a given font size. With draw=false it only measures. Returns the final y. */
function layout(pdf: Pdf, r: ResumeDoc, size: number, draw: boolean): number {
  let y = MARGIN;
  const gap = size * 0.35;
  const text = (s: string, opts: { font?: string; size?: number; x?: number; width?: number; align?: "left" | "right" | "center"; indent?: number } = {}) => {
    const font = opts.font ?? "Helvetica";
    const sz = opts.size ?? size;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? WIDTH;
    pdf.font(font).fontSize(sz);
    const h = pdf.heightOfString(s, { width, lineGap: 0.5 });
    if (draw) pdf.text(s, x, y, { width, align: opts.align ?? "left", lineGap: 0.5 });
    return h;
  };
  const line = (s: string, opts?: Parameters<typeof text>[1]) => (y += text(s, opts));
  const leftRight = (left: string, right: string) => {
    pdf.font("Helvetica").fontSize(size);
    const rw = right ? pdf.widthOfString(right) + 8 : 0;
    const h = text(left, { font: "Helvetica-Bold", width: WIDTH - rw });
    if (right) text(right, { x: MARGIN + WIDTH - rw, width: rw, align: "right" });
    y += h;
  };
  const bullets = (items: string[]) => {
    for (const b of items) {
      pdf.font("Helvetica").fontSize(size);
      const h = pdf.heightOfString(b, { width: WIDTH - 12, lineGap: 0.5 });
      if (draw) {
        pdf.text("•", MARGIN + 2, y, { lineBreak: false });
        pdf.text(b, MARGIN + 12, y, { width: WIDTH - 12, lineGap: 0.5 });
      }
      y += h;
    }
  };
  const heading = (key: SectionKey) => {
    y += gap * 1.6;
    const h = text(SECTION_LABELS[key].toUpperCase(), { font: "Helvetica-Bold", size: size + 0.5 });
    y += h + 1.5;
    if (draw) pdf.moveTo(MARGIN, y).lineTo(MARGIN + WIDTH, y).lineWidth(0.5).strokeColor("#888888").stroke();
    y += gap;
  };

  line(cleanName(r.header.name) || "Your name", { font: "Helvetica-Bold", size: size + 7, align: "center" });
  y += 2;
  line(contactLine(r), { size: size - 0.5, align: "center" });

  const sections: Record<SectionKey, () => void> = {
    summary: () => {
      if (!r.summary) return;
      heading("summary");
      line(r.summary);
    },
    experience: () => {
      if (!r.experience.length) return;
      heading("experience");
      r.experience.forEach((e, i) => {
        if (i) y += gap;
        leftRight([e.title, e.company, e.location].filter(Boolean).join(", "), e.dates);
        bullets(e.bullets);
      });
    },
    projects: () => {
      if (!r.projects.length) return;
      heading("projects");
      r.projects.forEach((p, i) => {
        if (i) y += gap;
        leftRight([p.name, p.tools.join(", ")].filter(Boolean).join(" | "), p.url);
        if (!p.bullets.length && p.description) line(p.description);
        bullets(p.bullets);
      });
    },
    skills: () => {
      if (!r.skills.length) return;
      heading("skills");
      for (const g of r.skills) line(`${g.label}: ${g.skills.map((s) => s.name).join(", ")}`);
    },
    certifications: () => {
      if (!r.certifications.length) return;
      heading("certifications");
      bullets(r.certifications.map((c) => `${c.name}${c.issuer ? `, ${c.issuer}` : ""}${c.inProgress ? " (in progress)" : c.date ? ` (${c.date})` : ""}`));
    },
    education: () => {
      if (!r.education.length) return;
      heading("education");
      r.education.forEach((e, i) => {
        if (i) y += gap;
        leftRight([e.school, e.degree].filter(Boolean).join(", "), e.dates);
        if (e.coursework.length) line(`Relevant coursework: ${e.coursework.join(", ")}`);
      });
    },
  };
  for (const k of r.sectionOrder) sections[k]();
  return y;
}

export const SIZES = [10.5, 10, 9.5, 9, 8.5, 8];

/** Largest font size at which the resume fits on one page (also used for the DOCX). */
export function fitSize(r: ResumeDoc): { size: number; fits: boolean } {
  const pdf = newDoc("", "");
  const size = SIZES.find((s) => layout(pdf, r, s, false) <= BOTTOM);
  return size ? { size, fits: true } : { size: SIZES[SIZES.length - 1], fits: false };
}

export async function resumePdf(r: ResumeDoc): Promise<{ buffer: Buffer; fits: boolean }> {
  const pdf = newDoc(`${cleanName(r.header.name)} Resume`, cleanName(r.header.name));
  // Measuring with draw=false never adds pages, so pick the largest size that fits.
  const size = SIZES.find((s) => layout(pdf, r, s, false) <= BOTTOM) ?? SIZES[SIZES.length - 1];
  const fits = layout(pdf, r, size, false) <= BOTTOM;
  if (fits) {
    layout(pdf, r, size, true);
  } else {
    // Doesn't fit even at the smallest size: let it flow onto a second page rather than cut content.
    flowLayout(pdf, r, size);
  }
  return { buffer: await toBuffer(pdf), fits };
}

/** Fallback for very long resumes: same content, using pdfkit's normal flow so text continues onto page 2. */
function flowLayout(pdf: Pdf, r: ResumeDoc, size: number) {
  const p = (s: string, font = "Helvetica", sz = size, align: "left" | "center" = "left") => pdf.font(font).fontSize(sz).text(s, { align, lineGap: 0.5 });
  p(cleanName(r.header.name), "Helvetica-Bold", size + 7, "center");
  p(contactLine(r), "Helvetica", size - 0.5, "center");
  for (const k of r.sectionOrder) {
    pdf.moveDown(0.6);
    p(SECTION_LABELS[k].toUpperCase(), "Helvetica-Bold", size + 0.5);
    if (k === "summary") p(r.summary);
    if (k === "experience") r.experience.forEach((e) => { p(`${[e.title, e.company, e.location].filter(Boolean).join(", ")}   ${e.dates}`, "Helvetica-Bold"); e.bullets.forEach((b) => p(`•  ${b}`)); });
    if (k === "projects") r.projects.forEach((x) => { p([x.name, x.tools.join(", "), x.url].filter(Boolean).join(" | "), "Helvetica-Bold"); x.bullets.forEach((b) => p(`•  ${b}`)); });
    if (k === "skills") r.skills.forEach((g) => p(`${g.label}: ${g.skills.map((s) => s.name).join(", ")}`));
    if (k === "certifications") r.certifications.forEach((c) => p(`•  ${c.name}${c.issuer ? `, ${c.issuer}` : ""}${c.inProgress ? " (in progress)" : ""}`));
    if (k === "education") r.education.forEach((e) => { p(`${[e.school, e.degree].filter(Boolean).join(", ")}   ${e.dates}`, "Helvetica-Bold"); if (e.coursework.length) p(`Relevant coursework: ${e.coursework.join(", ")}`); });
  }
}

export async function letterPdf(r: ResumeDoc, letter: string): Promise<Buffer> {
  const name = cleanName(r.header.name);
  const pdf = newDoc(`${name} Cover Letter`, name);
  pdf.font("Helvetica-Bold").fontSize(16).text(name || "Your name", { align: "left" });
  pdf.font("Helvetica").fontSize(9.5).text(contactLine(r), { lineGap: 1 });
  pdf.moveDown(1.5);
  pdf.font("Helvetica").fontSize(11).text(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
  pdf.moveDown(1);
  for (const para of letter.trim().split(/\n\s*\n/)) {
    pdf.text(para.trim(), { lineGap: 2.5, align: "left" });
    pdf.moveDown(0.8);
  }
  return toBuffer(pdf);
}
