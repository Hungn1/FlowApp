import type { ResumeDoc, SectionKey } from "@/lib/resume/types";
import { SECTION_LABELS } from "@/lib/resume/types";
import { cn } from "@/lib/utils";

// On-screen preview that mirrors the exported one-page, single-column layout.
export function ResumePreview({ doc, className, highlight }: { doc: ResumeDoc; className?: string; highlight?: (text: string) => React.ReactNode }) {
  const h = highlight ?? ((t: string) => t);
  const section = (key: SectionKey, body: React.ReactNode) => (
    <section key={key} className="mt-3">
      <h3 className="border-b border-neutral-300 pb-0.5 text-[11px] font-bold uppercase tracking-wider">{SECTION_LABELS[key]}</h3>
      <div className="mt-1.5">{body}</div>
    </section>
  );

  const render: Record<SectionKey, () => React.ReactNode> = {
    summary: () => (doc.summary ? section("summary", <p>{h(doc.summary)}</p>) : null),
    experience: () =>
      doc.experience.length
        ? section(
            "experience",
            doc.experience.map((e) => (
              <div key={e.ref.id} className="mb-2">
                <div className="flex justify-between gap-2">
                  <p><strong>{e.title}</strong>, {e.company}{e.location ? `, ${e.location}` : ""}</p>
                  <p className="shrink-0">{e.dates}</p>
                </div>
                <ul className="ml-4 list-disc">{e.bullets.map((b, i) => <li key={i}>{h(b)}</li>)}</ul>
              </div>
            ))
          )
        : null,
    projects: () =>
      doc.projects.length
        ? section(
            "projects",
            doc.projects.map((p) => (
              <div key={p.ref.id} className="mb-2">
                <p>
                  <strong>{p.name}</strong>
                  {p.tools.length ? ` | ${p.tools.join(", ")}` : ""}
                  {p.url ? ` | ${p.url}` : ""}
                </p>
                {p.description && !p.bullets.length && <p>{h(p.description)}</p>}
                <ul className="ml-4 list-disc">{p.bullets.map((b, i) => <li key={i}>{h(b)}</li>)}</ul>
              </div>
            ))
          )
        : null,
    skills: () =>
      doc.skills.length
        ? section(
            "skills",
            doc.skills.map((g) => (
              <p key={g.label}>
                <strong>{g.label}:</strong> {g.skills.map((s) => s.name).join(", ")}
              </p>
            ))
          )
        : null,
    certifications: () =>
      doc.certifications.length
        ? section(
            "certifications",
            <ul className="ml-4 list-disc">
              {doc.certifications.map((c) => (
                <li key={c.ref.id}>
                  {c.name}
                  {c.issuer ? `, ${c.issuer}` : ""}
                  {c.inProgress ? " (in progress)" : c.date ? ` (${c.date})` : ""}
                </li>
              ))}
            </ul>
          )
        : null,
    education: () =>
      doc.education.length
        ? section(
            "education",
            doc.education.map((e) => (
              <div key={e.ref.id} className="mb-1">
                <div className="flex justify-between gap-2">
                  <p><strong>{e.school}</strong>{e.degree ? `, ${e.degree}` : ""}</p>
                  <p className="shrink-0">{e.dates}</p>
                </div>
                {e.coursework.length > 0 && <p>Relevant coursework: {e.coursework.join(", ")}</p>}
              </div>
            ))
          )
        : null,
  };

  return (
    <div className={cn("rounded-md border bg-white p-6 font-serif text-[12px] leading-snug text-neutral-900 shadow-xs", className)}>
      <h2 className="text-center text-xl font-bold">{doc.header.name || "Your name"}</h2>
      <p className="text-center text-[11px]">
        {[doc.header.location, doc.header.phone, doc.header.email, ...doc.header.links].filter(Boolean).join(" | ")}
      </p>
      {doc.sectionOrder.map((k) => <div key={k}>{render[k]()}</div>)}
    </div>
  );
}
