import { AlignmentType, BorderStyle, Document, LevelFormat, Packer, Paragraph, TabStopType, TextRun } from "docx";
import type { ResumeDoc, SectionKey } from "@/lib/resume/types";
import { SECTION_LABELS } from "@/lib/resume/types";
import { cleanName, contactLine } from "./shared";

// ATS-friendly Word file: one column, no tables or text boxes, real bullet lists, dates on a right tab stop.

const MARGIN = 720; // 0.5 inch in twentieths of a point
const RIGHT_TAB = 12240 - MARGIN * 2; // page width minus margins
const FONT = "Calibri";

export async function resumeDocx(r: ResumeDoc, sizePt: number): Promise<Buffer> {
  const sz = Math.round(sizePt * 2); // docx uses half-points
  const after = Math.round(sizePt * 3);
  const run = (text: string, o: { bold?: boolean; size?: number } = {}) => new TextRun({ text, bold: o.bold, size: o.size ?? sz, font: FONT });
  const para = (children: TextRun[], o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacingAfter?: number; tab?: boolean } = {}) =>
    new Paragraph({
      children,
      alignment: o.align,
      spacing: { after: o.spacingAfter ?? 0, line: 252 },
      tabStops: o.tab ? [{ type: TabStopType.RIGHT, position: RIGHT_TAB }] : undefined,
    });
  const leftRight = (left: string, right: string) => para([run(left, { bold: true }), ...(right ? [run(`\t${right}`)] : [])], { tab: true });
  const bullet = (text: string) => new Paragraph({ children: [run(text)], numbering: { reference: "bullets", level: 0 }, spacing: { after: 0, line: 252 } });
  const heading = (key: SectionKey) =>
    new Paragraph({
      children: [run(SECTION_LABELS[key].toUpperCase(), { bold: true, size: sz + 1 })],
      spacing: { before: after * 3, after: after },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "888888", space: 1 } },
    });

  const body: Paragraph[] = [
    para([run(cleanName(r.header.name) || "Your name", { bold: true, size: sz + 14 })], { align: AlignmentType.CENTER, spacingAfter: 40 }),
    para([run(contactLine(r), { size: sz - 1 })], { align: AlignmentType.CENTER }),
  ];

  const sections: Record<SectionKey, () => Paragraph[]> = {
    summary: () => (r.summary ? [heading("summary"), para([run(r.summary)])] : []),
    experience: () =>
      r.experience.length
        ? [heading("experience"), ...r.experience.flatMap((e, i) => [
            ...(i ? [para([], { spacingAfter: after })] : []),
            leftRight([e.title, e.company, e.location].filter(Boolean).join(", "), e.dates),
            ...e.bullets.map(bullet),
          ])]
        : [],
    projects: () =>
      r.projects.length
        ? [heading("projects"), ...r.projects.flatMap((p, i) => [
            ...(i ? [para([], { spacingAfter: after })] : []),
            leftRight([p.name, p.tools.join(", ")].filter(Boolean).join(" | "), p.url),
            ...(p.bullets.length ? p.bullets.map(bullet) : p.description ? [para([run(p.description)])] : []),
          ])]
        : [],
    skills: () => (r.skills.length ? [heading("skills"), ...r.skills.map((g) => para([run(`${g.label}: `, { bold: true }), run(g.skills.map((s) => s.name).join(", "))]))] : []),
    certifications: () =>
      r.certifications.length
        ? [heading("certifications"), ...r.certifications.map((c) => bullet(`${c.name}${c.issuer ? `, ${c.issuer}` : ""}${c.inProgress ? " (in progress)" : c.date ? ` (${c.date})` : ""}`))]
        : [],
    education: () =>
      r.education.length
        ? [heading("education"), ...r.education.flatMap((e) => [
            leftRight([e.school, e.degree].filter(Boolean).join(", "), e.dates),
            ...(e.coursework.length ? [para([run(`Relevant coursework: ${e.coursework.join(", ")}`)])] : []),
          ])]
        : [],
  };
  for (const k of r.sectionOrder) body.push(...sections[k]());

  return pack(body, cleanName(r.header.name), "Resume");
}

export async function letterDocx(r: ResumeDoc, letter: string): Promise<Buffer> {
  const name = cleanName(r.header.name);
  const run = (text: string, o: { bold?: boolean; size?: number } = {}) => new TextRun({ text, bold: o.bold, size: o.size ?? 22, font: FONT });
  const p = (children: TextRun[], after = 200) => new Paragraph({ children, spacing: { after, line: 276 } });
  const body = [
    p([run(name || "Your name", { bold: true, size: 32 })], 40),
    p([run(contactLine(r), { size: 19 })], 360),
    p([run(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))], 240),
    ...letter
      .trim()
      .split(/\n\s*\n/)
      .map((para) => {
        const lines = para.trim().split("\n");
        return p(lines.map((l, i) => new TextRun({ text: l, break: i ? 1 : 0, size: 22, font: FONT })));
      }),
  ];
  return pack(body, name, "Cover Letter");
}

function pack(children: Paragraph[], author: string, title: string) {
  const doc = new Document({
    creator: author || "ApplyFlow",
    title: `${author} ${title}`.trim(),
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 260, hanging: 200 } } } }],
        },
      ],
    },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } }, children }],
  });
  return Packer.toBuffer(doc);
}
