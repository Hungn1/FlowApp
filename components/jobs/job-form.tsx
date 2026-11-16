"use client";
import { useMemo, useState } from "react";
import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { VerdictBadge } from "@/components/jobs/badges";
import { checkEntryLevel } from "@/lib/jobs/entry-level";
import { REQ_CATEGORIES, type JobInputT } from "@/lib/jobs/schema";
import { cn } from "@/lib/utils";

type Errors = Record<string, string[]>;
type Track = { id: string; name: string; color: string };

const CATEGORY_LABEL: Record<string, string> = { skill: "Skill", tool: "Tool", cert: "Certification", degree: "Degree", years: "Years", other: "Other" };

function F({ label, path, errors, className, children }: { label: string; path: string; errors: Errors; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={path}>{label}</Label>
      {children}
      {errors[path] && <p className="text-xs text-destructive">{errors[path][0]}</p>}
    </div>
  );
}

const num = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

export function JobForm({
  value,
  onChange,
  errors,
  tracks,
  trackReason,
}: {
  value: JobInputT;
  onChange: (v: JobInputT) => void;
  errors: Errors;
  tracks: Track[];
  trackReason?: string;
}) {
  const set = (patch: Partial<JobInputT>) => onChange({ ...value, ...patch });
  // Number fields keep their raw text so typing "1." or "" works.
  const [raw, setRaw] = useState(() => ({
    payMin: value.payMin?.toString() ?? "",
    payMax: value.payMax?.toString() ?? "",
    minYears: value.minYears?.toString() ?? "",
    maxYears: value.maxYears?.toString() ?? "",
  }));
  const setNum = (k: keyof typeof raw, s: string) => {
    setRaw((r) => ({ ...r, [k]: s }));
    const n = num(s);
    set({ [k]: n } as Partial<JobInputT>);
  };

  const check = useMemo(() => checkEntryLevel(value), [value]);
  const reqs = value.requirements;
  const updateReq = (i: number, patch: Partial<JobInputT["requirements"][number]>) =>
    set({ requirements: reqs.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  const reqList = (kind: "hard" | "nice") => {
    const list = reqs.map((r, i) => ({ r, i })).filter(({ r }) => r.kind === kind);
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {kind === "hard" ? "Hard requirements" : "Nice-to-haves"} <span className="text-muted-foreground">({list.length})</span>
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => set({ requirements: [...reqs, { text: "", kind, category: "skill" }] })}>
            <Plus /> Add
          </Button>
        </div>
        {list.length === 0 && <p className="text-xs text-muted-foreground">None listed.</p>}
        {list.map(({ r, i }) => (
          <div key={r.id ?? `n${i}`} className="flex flex-col gap-1">
            <div className="flex gap-1">
              <Input
                aria-label="Requirement"
                value={r.text}
                onChange={(e) => updateReq(i, { text: e.target.value })}
                aria-invalid={!!errors[`requirements.${i}.text`]}
                className="h-8 text-xs"
              />
              <NativeSelect aria-label="Category" value={r.category} onChange={(e) => updateReq(i, { category: e.target.value as typeof r.category })} className="h-8 w-28 shrink-0 text-xs">
                {REQ_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </NativeSelect>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                aria-label={kind === "hard" ? "Move to nice-to-haves" : "Move to hard requirements"}
                title={kind === "hard" ? "Move to nice-to-haves" : "Move to hard requirements"}
                onClick={() => updateReq(i, { kind: kind === "hard" ? "nice" : "hard" })}>
                <ArrowLeftRight />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Remove requirement"
                onClick={() => set({ requirements: reqs.filter((_, j) => j !== i) })}>
                <Trash2 />
              </Button>
            </div>
            {errors[`requirements.${i}.text`] && <p className="text-xs text-destructive">{errors[`requirements.${i}.text`][0]}</p>}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className={cn(check.fakeEntryLevel ? "border-red-300 dark:border-red-900" : check.verdict === "stretch" ? "border-amber-300 dark:border-amber-900" : "")}>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>Entry-level check</CardTitle>
          <VerdictBadge verdict={check.verdict} fake={check.fakeEntryLevel} />
        </CardHeader>
        <CardContent>
          <ul className="ml-4 list-disc text-sm text-muted-foreground">
            {check.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Updates as you edit the years, title, certifications and requirements below.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
          <CardDescription>Fix anything that was extracted wrong.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <F label="Job title *" path="title" errors={errors}>
            <Input id="title" value={value.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={!!errors.title} />
          </F>
          <F label="Company *" path="company" errors={errors}>
            <Input id="company" value={value.company} onChange={(e) => set({ company: e.target.value })} aria-invalid={!!errors.company} />
          </F>
          <F label="Track" path="trackId" errors={errors}>
            <NativeSelect id="trackId" value={value.trackId ?? ""} onChange={(e) => set({ trackId: e.target.value || null })}>
              <option value="">Unassigned</option>
              {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </NativeSelect>
            {trackReason && <p className="text-xs text-muted-foreground">{trackReason}</p>}
          </F>
          <F label="Location" path="location" errors={errors}>
            <Input id="location" value={value.location} onChange={(e) => set({ location: e.target.value })} />
          </F>
          <F label="Work mode" path="workMode" errors={errors}>
            <NativeSelect id="workMode" value={value.workMode} onChange={(e) => set({ workMode: e.target.value as JobInputT["workMode"] })}>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
              <option value="unknown">Not stated</option>
            </NativeSelect>
          </F>
          <F label="Application deadline" path="deadline" errors={errors}>
            <Input id="deadline" type="date" value={value.deadline} onChange={(e) => set({ deadline: e.target.value })} aria-invalid={!!errors.deadline} />
          </F>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <F label="Pay min" path="payMin" errors={errors}>
              <Input id="payMin" inputMode="decimal" value={raw.payMin} onChange={(e) => setNum("payMin", e.target.value)} aria-invalid={!!errors.payMin} />
            </F>
            <F label="Pay max" path="payMax" errors={errors}>
              <Input id="payMax" inputMode="decimal" value={raw.payMax} onChange={(e) => setNum("payMax", e.target.value)} aria-invalid={!!errors.payMax} />
            </F>
            <F label="Per" path="payPeriod" errors={errors}>
              <NativeSelect id="payPeriod" value={value.payPeriod} onChange={(e) => set({ payPeriod: e.target.value as JobInputT["payPeriod"] })}>
                <option value="">Not stated</option>
                <option value="year">Year</option>
                <option value="hour">Hour</option>
              </NativeSelect>
            </F>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <F label="Min years required" path="minYears" errors={errors}>
              <Input id="minYears" inputMode="decimal" value={raw.minYears} onChange={(e) => setNum("minYears", e.target.value)} aria-invalid={!!errors.minYears} />
            </F>
            <F label="Max years" path="maxYears" errors={errors}>
              <Input id="maxYears" inputMode="decimal" value={raw.maxYears} onChange={(e) => setNum("maxYears", e.target.value)} aria-invalid={!!errors.maxYears} />
            </F>
          </div>
          <F label="Required degree" path="requiredDegree" errors={errors}>
            <Input id="requiredDegree" value={value.requiredDegree} placeholder="None" onChange={(e) => set({ requiredDegree: e.target.value })} />
          </F>
          <F label="Required certifications (comma separated)" path="requiredCerts" errors={errors}>
            <Input
              id="requiredCerts"
              value={value.requiredCerts.join(", ")}
              placeholder="None"
              onChange={(e) => set({ requiredCerts: e.target.value.split(",").map((s) => s.trimStart()).filter((s, i, a) => s || i === a.length - 1) })}
            />
          </F>
          <F label="Posting URL" path="sourceUrl" errors={errors}>
            <Input id="sourceUrl" value={value.sourceUrl} placeholder="https://…" onChange={(e) => set({ sourceUrl: e.target.value })} aria-invalid={!!errors.sourceUrl} />
          </F>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={value.labeledEntryLevel} onChange={(e) => set({ labeledEntryLevel: e.target.checked })} />
            The posting calls itself entry-level (entry-level, junior, associate, Level I, Tier 1)
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
          <CardDescription>Hard requirements are must-haves. Use the arrows icon to move an item between the lists.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          {reqList("hard")}
          {reqList("nice")}
        </CardContent>
      </Card>
    </div>
  );
}

/** Clean a form value before sending: trim lists, turn NaN into null so the server can flag it. */
export function cleanJob(v: JobInputT): JobInputT {
  const n = (x: number | null) => (x == null || Number.isNaN(x) ? (Number.isNaN(x as number) ? -1 : null) : x);
  return {
    ...v,
    payMin: n(v.payMin),
    payMax: n(v.payMax),
    minYears: n(v.minYears),
    maxYears: n(v.maxYears),
    requiredCerts: v.requiredCerts.map((c) => c.trim()).filter(Boolean),
    requirements: v.requirements.map((r) => ({ ...r, text: r.text.trim() })),
  };
}
