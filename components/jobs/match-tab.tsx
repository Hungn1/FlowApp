"use client";
import { Check, CircleHelp, Loader2, Minus, RotateCw, Sparkles, Target, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import type { MatchResult, Met, RequirementResult } from "@/lib/match/types";
import { cn } from "@/lib/utils";
import { AiSetupNote, GenerateError, SourceBadge, StaleNote, useGenerated, when } from "./ai-shared";

const MET: Record<Met, { icon: React.ReactNode; label: string; cls: string }> = {
  yes: { icon: <Check className="h-3.5 w-3.5" />, label: "Met", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  partial: { icon: <Minus className="h-3.5 w-3.5" />, label: "Partly", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  no: { icon: <X className="h-3.5 w-3.5" />, label: "Missing", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  unknown: { icon: <CircleHelp className="h-3.5 w-3.5" />, label: "Check yourself", cls: "bg-muted text-muted-foreground" },
};

export function scoreTone(score: number) {
  return score >= 75 ? "text-emerald-600 dark:text-emerald-400" : score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
}

function ReqRow({ r, suggestion }: { r: RequirementResult; suggestion?: string }) {
  const m = MET[r.met];
  return (
    <li className="flex gap-3 border-b py-2.5 last:border-0">
      <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", m.cls)} title={m.label} aria-label={m.label}>{m.icon}</span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{r.text}</p>
        <p className="text-muted-foreground">{r.evidence}</p>
        {r.coveredBy.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {r.coveredBy.map((c) => <Badge key={c.id} variant="outline" className="font-normal">{c.label}</Badge>)}
          </div>
        )}
        {suggestion && (
          <p className="mt-1.5 flex gap-1.5 rounded-md bg-muted/60 p-2 text-xs"><Sparkles className="mt-0.5 h-3 w-3 shrink-0" /> {suggestion}</p>
        )}
      </div>
    </li>
  );
}

export function MatchTab({ jobId, hasRequirements }: { jobId: string; hasRequirements: boolean }) {
  const { data, loaded, loadError, load, generate, generating, genError } = useGenerated<MatchResult>(`/api/jobs/${jobId}/match`);

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;
  if (!loaded) return <ListSkeleton rows={3} />;

  const err = genError && <GenerateError error={genError} onRetry={() => generate(genError.mode)} onBasic={() => generate("basic")} />;

  if (!data)
    return (
      <div className="flex flex-col gap-3">
        {err}
        <EmptyState
          icon={<Target className="h-8 w-8" />}
          title="How well do you match?"
          description={hasRequirements ? "Compare this job's requirements with your profile: a score, what you meet, what's missing, and keywords to add." : "This job has no requirements yet. Click Edit above to add some, then analyze."}
          action={
            <Button onClick={() => generate()} disabled={generating || !hasRequirements}>
              {generating ? <Loader2 className="animate-spin" /> : <Target />} {generating ? "Analyzing…" : "Analyze match"}
            </Button>
          }
        />
        <AiSetupNote what="the match analysis" />
      </div>
    );

  const tips = new Map(data.transferable.map((t) => [t.requirementId, t.suggestion]));
  const hard = data.requirements.filter((r) => r.kind === "hard");
  const nice = data.requirements.filter((r) => r.kind === "nice");
  const count = (met: Met) => data.requirements.filter((r) => r.met === met).length;

  return (
    <div className="flex flex-col gap-4">
      {err}
      {data.stale && <StaleNote what="analysis" onRedo={() => generate(data.source === "ai" ? "auto" : "basic")} busy={generating} />}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className={cn("text-5xl font-semibold tabular-nums", scoreTone(data.score))} aria-label={`Match score ${data.score} out of 100`}>
              {data.score}
              <span className="text-lg text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="flex-1 text-sm">
            <p>{data.summary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <SourceBadge source={data.source} />
              <span>{count("yes")} met · {count("partial")} partly · {count("no")} missing{count("unknown") ? ` · ${count("unknown")} to check` : ""}</span>
              <span>· {when(data.generatedAt)}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => generate()} disabled={generating}>
            {generating ? <Loader2 className="animate-spin" /> : <RotateCw />} Re-run
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="flex flex-col gap-4">
          {[["Hard requirements", hard], ["Nice-to-haves", nice]].map(([title, list]) =>
            (list as RequirementResult[]).length ? (
              <Card key={title as string}>
                <CardHeader><CardTitle>{title as string}</CardTitle></CardHeader>
                <CardContent><ul>{(list as RequirementResult[]).map((r) => <ReqRow key={r.requirementId} r={r} suggestion={tips.get(r.requirementId)} />)}</ul></CardContent>
              </Card>
            ) : null
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Missing keywords</CardTitle>
              <CardDescription className="mt-1">Named in the posting, not in your profile. Add them to your profile only if they&apos;re true for you.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.missingKeywords.length ? (
                <div className="flex flex-wrap gap-1.5">{data.missingKeywords.map((k) => <Badge key={k} variant="danger">{k}</Badge>)}</div>
              ) : (
                <p className="text-sm text-muted-foreground">None. Your profile covers the posting&apos;s keywords.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Transferable skills</CardTitle>
              <CardDescription className="mt-1">Ways to frame what you already have for the gaps.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              {data.transferable.length ? (
                <ul className="flex flex-col gap-2">
                  {data.transferable.map((t) => (
                    <li key={t.requirementId}>
                      <p className="text-xs text-muted-foreground">{data.requirements.find((r) => r.requirementId === t.requirementId)?.text}</p>
                      <p>{t.suggestion}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">{data.source === "basic" ? "Suggestions need AI. The basic analysis only checks keywords." : "No suggestions for this job."}</p>
              )}
            </CardContent>
          </Card>
          <AiSetupNote what="the match analysis" />
        </div>
      </div>
    </div>
  );
}
