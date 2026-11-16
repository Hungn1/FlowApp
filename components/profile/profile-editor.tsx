"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileInputT } from "@/lib/profile/schema";
import { cn } from "@/lib/utils";

type Errors = Record<string, string[]>;
type Setter = (fn: (p: ProfileInputT) => ProfileInputT) => void;

function Field({
  label,
  path,
  errors,
  className,
  children,
}: {
  label: string;
  path: string;
  errors: Errors;
  className?: string;
  children: React.ReactNode;
}) {
  const err = errors[path]?.[0];
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={path}>{label}</Label>
      {children}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

const lines = (s: string) => s.split("\n");
const joinLines = (a: string[]) => a.join("\n");
const commas = (s: string) => s.split(",").map((x) => x.trimStart());

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function ItemControls({ onUp, onDown, onRemove, label }: { onUp: () => void; onDown: () => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex gap-1">
      <Button type="button" variant="ghost" size="icon" aria-label={`Move ${label} up`} onClick={onUp}>
        <ArrowUp />
      </Button>
      <Button type="button" variant="ghost" size="icon" aria-label={`Move ${label} down`} onClick={onDown}>
        <ArrowDown />
      </Button>
      <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${label}`} onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  );
}

function Section({ title, count, onAdd, children }: { title: string; count?: number; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>
          {title} {count !== undefined && <span className="ml-1 text-sm font-normal text-muted-foreground">({count})</span>}
        </CardTitle>
        {onAdd && (
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus /> Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

export function ProfileEditor({ value, set, errors }: { value: ProfileInputT; set: Setter; errors: Errors }) {
  const c = value.contact;
  const setContact = (patch: Partial<ProfileInputT["contact"]>) => set((p) => ({ ...p, contact: { ...p.contact, ...patch } }));

  function listOps<K extends "experiences" | "educations" | "certifications" | "projects">(key: K) {
    type Item = ProfileInputT[K][number];
    return {
      update: (i: number, patch: Partial<Item>) =>
        set((p) => ({ ...p, [key]: (p[key] as Item[]).map((it, j) => (j === i ? { ...it, ...patch } : it)) })),
      remove: (i: number) => set((p) => ({ ...p, [key]: (p[key] as Item[]).filter((_, j) => j !== i) })),
      move: (i: number, dir: -1 | 1) => set((p) => ({ ...p, [key]: move(p[key] as Item[], i, dir) })),
      add: (item: Item) => set((p) => ({ ...p, [key]: [...(p[key] as Item[]), item] })),
    };
  }
  const exp = listOps("experiences");
  const edu = listOps("educations");
  const cert = listOps("certifications");
  const proj = listOps("projects");

  return (
    <div className="flex flex-col gap-4">
      <Section title="Contact and links">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name *" path="contact.name" errors={errors}>
            <Input id="contact.name" value={c.name} onChange={(e) => setContact({ name: e.target.value })} aria-invalid={!!errors["contact.name"]} />
          </Field>
          <Field label="Email" path="contact.email" errors={errors}>
            <Input id="contact.email" type="email" value={c.email} onChange={(e) => setContact({ email: e.target.value })} aria-invalid={!!errors["contact.email"]} />
          </Field>
          <Field label="Phone" path="contact.phone" errors={errors}>
            <Input id="contact.phone" value={c.phone} onChange={(e) => setContact({ phone: e.target.value })} />
          </Field>
          <Field label="Location" path="contact.location" errors={errors}>
            <Input id="contact.location" value={c.location} placeholder="City, ST" onChange={(e) => setContact({ location: e.target.value })} />
          </Field>
          <Field label="Headline" path="contact.headline" errors={errors} className="sm:col-span-2">
            <Input id="contact.headline" value={c.headline} placeholder="e.g. Entry-level IT and security professional" onChange={(e) => setContact({ headline: e.target.value })} />
          </Field>
          <Field label="LinkedIn" path="contact.linkedin" errors={errors}>
            <Input id="contact.linkedin" value={c.linkedin} onChange={(e) => setContact({ linkedin: e.target.value })} />
          </Field>
          <Field label="GitHub" path="contact.github" errors={errors}>
            <Input id="contact.github" value={c.github} onChange={(e) => setContact({ github: e.target.value })} />
          </Field>
          <Field label="Portfolio" path="contact.portfolio" errors={errors}>
            <Input id="contact.portfolio" value={c.portfolio} placeholder="Behance, Dribbble, personal site…" onChange={(e) => setContact({ portfolio: e.target.value })} />
          </Field>
          <Field label="Other links (comma separated)" path="contact.otherLinks" errors={errors}>
            <Input
              id="contact.otherLinks"
              value={c.otherLinks.join(", ")}
              onChange={(e) => setContact({ otherLinks: commas(e.target.value).filter((x, i, a) => x || i === a.length - 1) })}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Experience"
        count={value.experiences.length}
        onAdd={() => exp.add({ company: "", title: "", location: "", start: "", end: "", isTechRole: false, bullets: [] })}
      >
        {value.experiences.length === 0 && <p className="text-sm text-muted-foreground">No experience yet. Non-tech jobs count: retail and service roles show customer skills.</p>}
        {value.experiences.map((e, i) => {
          const p = `experiences.${i}`;
          return (
            <div key={e.id ?? `new-${i}`} className="rounded-md border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{e.title || "New role"}{e.company ? ` · ${e.company}` : ""}</p>
                <ItemControls label="role" onUp={() => exp.move(i, -1)} onDown={() => exp.move(i, 1)} onRemove={() => exp.remove(i)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title *" path={`${p}.title`} errors={errors}>
                  <Input id={`${p}.title`} value={e.title} onChange={(ev) => exp.update(i, { title: ev.target.value })} aria-invalid={!!errors[`${p}.title`]} />
                </Field>
                <Field label="Company *" path={`${p}.company`} errors={errors}>
                  <Input id={`${p}.company`} value={e.company} onChange={(ev) => exp.update(i, { company: ev.target.value })} aria-invalid={!!errors[`${p}.company`]} />
                </Field>
                <Field label="Location" path={`${p}.location`} errors={errors}>
                  <Input id={`${p}.location`} value={e.location} onChange={(ev) => exp.update(i, { location: ev.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start" path={`${p}.start`} errors={errors}>
                    <Input id={`${p}.start`} value={e.start} placeholder="Jun 2023" onChange={(ev) => exp.update(i, { start: ev.target.value })} />
                  </Field>
                  <Field label="End" path={`${p}.end`} errors={errors}>
                    <Input id={`${p}.end`} value={e.end} placeholder="Present" onChange={(ev) => exp.update(i, { end: ev.target.value })} />
                  </Field>
                </div>
                <Field label="Bullets (one per line)" path={`${p}.bullets`} errors={errors} className="sm:col-span-2">
                  <Textarea id={`${p}.bullets`} rows={4} value={joinLines(e.bullets)} onChange={(ev) => exp.update(i, { bullets: lines(ev.target.value) })} />
                </Field>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={e.isTechRole} onChange={(ev) => exp.update(i, { isTechRole: ev.target.checked })} />
                  This is a tech role (IT, design, security, software)
                </label>
              </div>
            </div>
          );
        })}
      </Section>

      <SkillsSection value={value} set={set} errors={errors} />

      <Section
        title="Projects and case studies"
        count={value.projects.length}
        onAdd={() => proj.add({ name: "", type: "personal", description: "", bullets: [], tools: [], url: "" })}
      >
        {value.projects.length === 0 && <p className="text-sm text-muted-foreground">Add UX case studies, security labs, home-lab builds, and class projects. They carry an entry-level resume.</p>}
        {value.projects.map((pr, i) => {
          const p = `projects.${i}`;
          return (
            <div key={pr.id ?? `new-${i}`} className="rounded-md border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{pr.name || "New project"}</p>
                <ItemControls label="project" onUp={() => proj.move(i, -1)} onDown={() => proj.move(i, 1)} onRemove={() => proj.remove(i)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name *" path={`${p}.name`} errors={errors}>
                  <Input id={`${p}.name`} value={pr.name} onChange={(ev) => proj.update(i, { name: ev.target.value })} aria-invalid={!!errors[`${p}.name`]} />
                </Field>
                <Field label="Type" path={`${p}.type`} errors={errors}>
                  <NativeSelect id={`${p}.type`} value={pr.type} onChange={(ev) => proj.update(i, { type: ev.target.value as typeof pr.type })}>
                    <option value="case-study">UX case study</option>
                    <option value="lab">Lab / home lab</option>
                    <option value="course">Course project</option>
                    <option value="personal">Personal project</option>
                  </NativeSelect>
                </Field>
                <Field label="Short description" path={`${p}.description`} errors={errors} className="sm:col-span-2">
                  <Input id={`${p}.description`} value={pr.description} onChange={(ev) => proj.update(i, { description: ev.target.value })} />
                </Field>
                <Field label="Bullets (one per line)" path={`${p}.bullets`} errors={errors} className="sm:col-span-2">
                  <Textarea id={`${p}.bullets`} rows={3} value={joinLines(pr.bullets)} onChange={(ev) => proj.update(i, { bullets: lines(ev.target.value) })} />
                </Field>
                <Field label="Tools (comma separated)" path={`${p}.tools`} errors={errors}>
                  <Input id={`${p}.tools`} value={pr.tools.join(", ")} onChange={(ev) => proj.update(i, { tools: commas(ev.target.value) })} />
                </Field>
                <Field label="Link" path={`${p}.url`} errors={errors}>
                  <Input id={`${p}.url`} value={pr.url} onChange={(ev) => proj.update(i, { url: ev.target.value })} />
                </Field>
              </div>
            </div>
          );
        })}
      </Section>

      <Section
        title="Certifications"
        count={value.certifications.length}
        onAdd={() => cert.add({ name: "", issuer: "", issued: "", expires: "", credentialUrl: "", inProgress: false })}
      >
        {value.certifications.length === 0 && <p className="text-sm text-muted-foreground">No certifications yet. In-progress ones count too; mark them as in progress.</p>}
        {value.certifications.map((ct, i) => {
          const p = `certifications.${i}`;
          return (
            <div key={ct.id ?? `new-${i}`} className="rounded-md border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{ct.name || "New certification"}</p>
                <ItemControls label="certification" onUp={() => cert.move(i, -1)} onDown={() => cert.move(i, 1)} onRemove={() => cert.remove(i)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name *" path={`${p}.name`} errors={errors}>
                  <Input id={`${p}.name`} value={ct.name} onChange={(ev) => cert.update(i, { name: ev.target.value })} aria-invalid={!!errors[`${p}.name`]} />
                </Field>
                <Field label="Issuer" path={`${p}.issuer`} errors={errors}>
                  <Input id={`${p}.issuer`} value={ct.issuer} onChange={(ev) => cert.update(i, { issuer: ev.target.value })} />
                </Field>
                <Field label="Issued" path={`${p}.issued`} errors={errors}>
                  <Input id={`${p}.issued`} value={ct.issued} placeholder="2024" onChange={(ev) => cert.update(i, { issued: ev.target.value })} />
                </Field>
                <Field label="Credential URL" path={`${p}.credentialUrl`} errors={errors}>
                  <Input id={`${p}.credentialUrl`} value={ct.credentialUrl} onChange={(ev) => cert.update(i, { credentialUrl: ev.target.value })} />
                </Field>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={ct.inProgress} onChange={(ev) => cert.update(i, { inProgress: ev.target.checked })} />
                  In progress
                </label>
              </div>
            </div>
          );
        })}
      </Section>

      <Section
        title="Education"
        count={value.educations.length}
        onAdd={() => edu.add({ school: "", degree: "", field: "", start: "", end: "", coursework: [] })}
      >
        {value.educations.length === 0 && <p className="text-sm text-muted-foreground">No education yet. Bootcamps and certificate programs belong here too.</p>}
        {value.educations.map((e, i) => {
          const p = `educations.${i}`;
          return (
            <div key={e.id ?? `new-${i}`} className="rounded-md border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{e.school || "New school"}</p>
                <ItemControls label="school" onUp={() => edu.move(i, -1)} onDown={() => edu.move(i, 1)} onRemove={() => edu.remove(i)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="School *" path={`${p}.school`} errors={errors}>
                  <Input id={`${p}.school`} value={e.school} onChange={(ev) => edu.update(i, { school: ev.target.value })} aria-invalid={!!errors[`${p}.school`]} />
                </Field>
                <Field label="Degree" path={`${p}.degree`} errors={errors}>
                  <Input id={`${p}.degree`} value={e.degree} placeholder="B.S." onChange={(ev) => edu.update(i, { degree: ev.target.value })} />
                </Field>
                <Field label="Field of study" path={`${p}.field`} errors={errors}>
                  <Input id={`${p}.field`} value={e.field} onChange={(ev) => edu.update(i, { field: ev.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start" path={`${p}.start`} errors={errors}>
                    <Input id={`${p}.start`} value={e.start} onChange={(ev) => edu.update(i, { start: ev.target.value })} />
                  </Field>
                  <Field label="End" path={`${p}.end`} errors={errors}>
                    <Input id={`${p}.end`} value={e.end} placeholder="May 2025" onChange={(ev) => edu.update(i, { end: ev.target.value })} />
                  </Field>
                </div>
                <Field label="Relevant coursework (comma separated)" path={`${p}.coursework`} errors={errors} className="sm:col-span-2">
                  <Input id={`${p}.coursework`} value={e.coursework.join(", ")} onChange={(ev) => edu.update(i, { coursework: commas(ev.target.value) })} />
                </Field>
              </div>
            </div>
          );
        })}
      </Section>
    </div>
  );
}

const CATS = [
  { value: "tool", label: "Tools" },
  { value: "technical", label: "Technical" },
  { value: "design", label: "Design" },
  { value: "soft", label: "Soft skills" },
] as const;

function SkillsSection({ value, set, errors }: { value: ProfileInputT; set: Setter; errors: Errors }) {
  const [draft, setDraft] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]["value"]>("technical");
  const [dupe, setDupe] = useState<string | null>(null);

  function add() {
    const names = draft.split(",").map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    const have = new Set(value.skills.map((s) => s.name.toLowerCase()));
    const fresh = names.filter((n) => !have.has(n.toLowerCase()));
    setDupe(fresh.length < names.length ? "Skipped skills you already have." : null);
    set((p) => ({ ...p, skills: [...p.skills, ...fresh.map((name) => ({ name, category: cat }))] }));
    setDraft("");
  }

  return (
    <Section title="Skills" count={value.skills.length}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={draft}
          placeholder="Add skills, comma separated (e.g. Figma, Wireshark, Active Directory)"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <NativeSelect className="sm:w-40" value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>
          {CATS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </NativeSelect>
        <Button type="button" variant="outline" onClick={add}>
          <Plus /> Add
        </Button>
      </div>
      {dupe && <p className="text-xs text-muted-foreground">{dupe}</p>}
      {Object.keys(errors).some((k) => k.startsWith("skills.")) && <p className="text-xs text-destructive">Every skill needs a name.</p>}
      {value.skills.length === 0 && <p className="text-sm text-muted-foreground">No skills yet.</p>}
      {CATS.map((c) => {
        const items = value.skills.map((s, i) => ({ s, i })).filter(({ s }) => s.category === c.value);
        if (!items.length) return null;
        return (
          <div key={c.value}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <div className="flex flex-wrap gap-2">
              {items.map(({ s, i }) => (
                <span key={s.id ?? `new-${i}`} className="inline-flex items-center gap-1 rounded-md border bg-secondary px-2 py-1 text-sm">
                  {s.name}
                  <select
                    aria-label={`Category for ${s.name}`}
                    className="bg-transparent text-xs text-muted-foreground"
                    value={s.category}
                    onChange={(e) =>
                      set((p) => ({ ...p, skills: p.skills.map((x, j) => (j === i ? { ...x, category: e.target.value as typeof s.category } : x)) }))
                    }
                  >
                    {CATS.map((cc) => (
                      <option key={cc.value} value={cc.value}>{cc.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label={`Remove ${s.name}`}
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => set((p) => ({ ...p, skills: p.skills.filter((_, j) => j !== i) }))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </Section>
  );
}
