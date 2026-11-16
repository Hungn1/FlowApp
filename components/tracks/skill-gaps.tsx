"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState, ListSkeleton } from "@/components/states";
import { api } from "@/lib/api-client";
import type { SkillGap } from "@/lib/stats/service";

type Gaps = { jobs: number; gaps: SkillGap[]; hasProfile: boolean };

/** Ranked list of what jobs in a track ask for that your profile lacks. */
export function SkillGapsList({ trackId, limit = 10 }: { trackId: string; limit?: number }) {
  const [data, setData] = useState<Gaps | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<Gaps>(`/api/tracks/${trackId}/gaps`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load skill gaps.");
    }
  }, [trackId]);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <ListSkeleton rows={3} />;
  if (!data.hasProfile) return <p className="text-sm text-muted-foreground">Add your profile first so there&apos;s something to compare against.</p>;
  if (data.jobs === 0) return <p className="text-sm text-muted-foreground">No jobs in this track yet. Add a few and the most common gaps show up here.</p>;
  if (!data.gaps.length) return <p className="text-sm text-muted-foreground">No gaps found across {data.jobs} job{data.jobs === 1 ? "" : "s"}. Nice.</p>;

  return (
    <ol className="flex flex-col gap-2">
      {data.gaps.slice(0, limit).map((g, i) => (
        <li key={g.term} className="group text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium"><span className="mr-1.5 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>{g.term}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{g.count} of {data.jobs} jobs</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-foreground/70" style={{ width: `${(g.count / data.jobs) * 100}%` }} />
          </div>
          <p className="mt-0.5 hidden text-xs text-muted-foreground group-hover:block group-focus-within:block">
            {g.jobs.map((j, k) => (
              <span key={j.id}>{k > 0 && ", "}<Link href={`/jobs/${j.id}`} className="underline">{j.company}</Link></span>
            ))}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function SkillGapsCard({ trackId }: { trackId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Skill gaps</CardTitle>
        <CardDescription>Skills, tools and certifications that jobs in this track ask for most often and your profile doesn&apos;t have. Hover a row to see which jobs.</CardDescription>
      </CardHeader>
      <CardContent>
        <SkillGapsList trackId={trackId} />
      </CardContent>
    </Card>
  );
}
