"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, FileText, Loader2, Pencil, RotateCw, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { ResumePreview } from "@/components/resume/resume-preview";
import { ExportButtons } from "@/components/export-buttons";
import { api } from "@/lib/api-client";
import type { TailoredDTO } from "@/lib/materials/service";
import { wordDiff, type Change, type ChangeStatus } from "@/lib/resume/tailor";
import { cn } from "@/lib/utils";
import { AiSetupNote, GenerateError, SourceBadge, StaleNote, useGenerated, when } from "./ai-shared";

function Diff({ before, after, side }: { before: string; after: string; side: "before" | "after" }) {
  const runs = wordDiff(before, after);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {runs.map((r, i) =>
        r.op === "same" ? (
          <span key={i}>{r.text}</span>
        ) : side === "before" && r.op === "del" ? (
          <del key={i} className="rounded-sm bg-red-100 text-red-900 decoration-red-400 dark:bg-red-950/60 dark:text-red-200">{r.text}</del>
        ) : side === "after" && r.op === "add" ? (
          <ins key={i} className="rounded-sm bg-emerald-100 text-emerald-900 no-underline dark:bg-emerald-950/60 dark:text-emerald-200">{r.text}</ins>
        ) : null
      )}
    </p>
  );
}

/** Skills are a reordering, so show positions instead of a word diff. Skills that moved up are highlighted. */
function SkillList({ before, after, side }: { before: string; after: string; side: "before" | "after" }) {
  const b = before.split(", ");
  const a = after.split(", ");
  const list = side === "before" ? b : a;
  return (
    <ol className="flex flex-wrap gap-1 text-sm">
      {list.map((name, i) => {
        const up = side === "after" && b.indexOf(name) > i;
        return (
          <li key={name} className={cn("rounded border px-1.5 py-0.5 text-xs", up && "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200")}>
            {name}
          </li>
        );
      })}
    </ol>
  );
}

function ChangeCard({ c, busy, onSet }: { c: Change; busy: boolean; onSet: (status: ChangeStatus, after?: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.after);
  const tone = c.status === "accepted" ? "border-emerald-400 dark:border-emerald-800" : c.status === "rejected" ? "opacity-60" : "";
  return (
    <div className={cn("min-w-0 rounded-lg border p-3", tone)} data-testid="change">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{c.kind === "summary" ? "Summary" : c.kind === "skills" ? "Skills order" : "Bullet"}</Badge>
        {c.kind === "bullet" && <span className="truncate text-xs text-muted-foreground">{c.label}</span>}
        <span className="ml-auto text-xs text-muted-foreground">{c.status === "accepted" ? "Accepted" : c.status === "rejected" ? "Rejected" : "Pending"}</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-md bg-muted/40 p-2">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current</p>
          {c.kind === "skills" ? (
            <SkillList before={c.before} after={c.after} side="before" />
          ) : c.before ? (
            <Diff before={c.before} after={c.after} side="before" />
          ) : (
            <p className="text-sm italic text-muted-foreground">(empty)</p>
          )}
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Suggested</p>
          {editing ? (
            <div className="flex flex-col gap-2">
              <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label="Edit suggested text" aria-invalid={!text.trim()} />
              {!text.trim() && <p className="text-xs text-destructive">The new text can&apos;t be empty.</p>}
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || !text.trim()} onClick={async () => (await onSet("accepted", text)) && setEditing(false)}>
                  <Check /> Save and accept
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setText(c.after); setEditing(false); }}>Cancel</Button>
              </div>
            </div>
          ) : c.kind === "skills" ? (
            <SkillList before={c.before} after={c.after} side="after" />
          ) : (
            <Diff before={c.before} after={c.after} side="after" />
          )}
        </div>
      </div>
      {c.reason && <p className="mt-2 text-xs text-muted-foreground">Why: {c.reason}</p>}
      {c.warning && (
        <p className="mt-2 flex gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {c.warning}
        </p>
      )}
      {!editing && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant={c.status === "accepted" ? "default" : "outline"} disabled={busy} onClick={() => onSet(c.status === "accepted" ? "pending" : "accepted")} aria-pressed={c.status === "accepted"}>
            <Check /> {c.status === "accepted" ? "Accepted" : "Accept"}
          </Button>
          <Button size="sm" variant={c.status === "rejected" ? "secondary" : "outline"} disabled={busy} onClick={() => onSet(c.status === "rejected" ? "pending" : "rejected")} aria-pressed={c.status === "rejected"}>
            <X /> {c.status === "rejected" ? "Rejected" : "Reject"}
          </Button>
          {c.kind !== "skills" && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(true)}><Pencil /> Edit</Button>
          )}
        </div>
      )}
    </div>
  );
}

export function ResumeTab({ jobId, trackId }: { jobId: string; trackId: string | null }) {
  const { data, setData, loaded, loadError, load, generate, generating, genError } = useGenerated<TailoredDTO>(`/api/jobs/${jobId}/resume`);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"tailored" | "base">("tailored");

  async function patch(changes: { id: string; status: ChangeStatus; after?: string }[]): Promise<boolean> {
    setBusy(true);
    try {
      setData(await api<TailoredDTO>(`/api/jobs/${jobId}/resume`, { method: "PATCH", json: { changes } }));
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save.", { action: { label: "Retry", onClick: () => patch(changes) } });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(() => {
    const c = { accepted: 0, rejected: 0, pending: 0 };
    data?.changes.forEach((x) => c[x.status]++);
    return c;
  }, [data]);

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;
  if (!loaded) return <ListSkeleton rows={3} />;
  const err = genError && <GenerateError error={genError} onRetry={() => generate(genError.mode)} onBasic={() => generate("basic")} />;

  if (!data)
    return (
      <div className="flex flex-col gap-3">
        {err}
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="Tailor your resume for this job"
          description="Starts from this job's track resume. You'll see every suggested change side by side and accept or reject each one. Nothing new is invented: suggestions only use facts from your profile."
          action={
            <Button onClick={() => generate()} disabled={generating}>
              {generating ? <Loader2 className="animate-spin" /> : <FileText />} {generating ? "Tailoring… (up to a minute)" : "Tailor resume"}
            </Button>
          }
        />
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Or download your track resume as it is:</span>
          <ExportButtons url={`/api/jobs/${jobId}/export`} />
        </div>
        <AiSetupNote what="tailoring" />
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {err}
      {data.stale && <StaleNote what="tailored resume" onRedo={() => generate(data.source === "ai" ? "auto" : "basic")} busy={generating} />}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex-1 text-sm">
            <p>
              Based on your <strong>{data.trackName}</strong> resume.{" "}
              {trackId && <Link href={`/tracks/${trackId}`} className="underline">Edit track</Link>}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <SourceBadge source={data.source} />
              <span>{counts.accepted} accepted · {counts.rejected} rejected · {counts.pending} pending</span>
              <span>· {when(data.generatedAt)}</span>
            </div>
            {data.note && <p className="mt-1 text-xs text-muted-foreground">{data.note}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy || !data.changes.length} onClick={() => patch(data.changes.map((c) => ({ id: c.id, status: "accepted" })))}><Check /> Accept all</Button>
            <Button size="sm" variant="outline" disabled={busy || !data.changes.length} onClick={() => patch(data.changes.map((c) => ({ id: c.id, status: "rejected" })))}><X /> Reject all</Button>
            <Button size="sm" variant="ghost" disabled={busy || counts.pending === data.changes.length} onClick={() => patch(data.changes.map((c) => ({ id: c.id, status: "pending" })))}><Undo2 /> Reset</Button>
            <Button size="sm" variant="ghost" disabled={generating} onClick={() => generate()}>
              {generating ? <Loader2 className="animate-spin" /> : <RotateCw />} Regenerate
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
        <Card>
          <CardHeader><CardTitle>Suggested changes <span className="font-normal text-muted-foreground">({data.changes.length})</span></CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.changes.length === 0 && <p className="text-sm text-muted-foreground">No changes suggested. Your track resume already fits this job well.</p>}
            {data.changes.map((c) => (
              <ChangeCard key={`${c.id}:${c.after}`} c={c} busy={busy} onSet={(status, after) => patch([{ id: c.id, status, after }])} />
            ))}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-2 xl:sticky xl:top-4 xl:self-start">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Preview</p>
            <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Preview">
              <Button size="sm" className="h-7" variant={view === "tailored" ? "secondary" : "ghost"} aria-pressed={view === "tailored"} onClick={() => setView("tailored")}>Tailored</Button>
              <Button size="sm" className="h-7" variant={view === "base" ? "secondary" : "ghost"} aria-pressed={view === "base"} onClick={() => setView("base")}>Original</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{view === "tailored" ? "Your track resume with the accepted changes applied." : "Your track resume before tailoring."}</p>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButtons url={`/api/jobs/${jobId}/export`} />
            <span className="text-xs text-muted-foreground">Downloads the tailored version. Only accepted changes are included.</span>
          </div>
          <div className="overflow-x-auto">
            <ResumePreview doc={view === "tailored" ? data.tailored : data.base} className="min-w-[32rem]" />
          </div>
        </div>
      </div>
    </div>
  );
}
