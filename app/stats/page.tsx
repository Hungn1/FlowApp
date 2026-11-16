"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";
import { SkillGapsList } from "@/components/tracks/skill-gaps";
import { api } from "@/lib/api-client";
import type { Stats, TrackStats } from "@/lib/stats/service";
import { cn } from "@/lib/utils";

const rate = (v: number | null) => (v == null ? "–" : `${v}%`);
const weekLabel = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function WeeklyChart({ weeks, tracks }: { weeks: Stats["weeks"]; tracks: TrackStats[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const name = (id: string) => tracks.find((t) => (t.id ?? "none") === id)?.name ?? "No track";
  const detail = (w: Stats["weeks"][number]) =>
    `Week of ${weekLabel(w.start)}: ${w.count} application${w.count === 1 ? "" : "s"}${w.count ? ` (${Object.entries(w.byTrack).map(([k, n]) => `${name(k)} ${n}`).join(", ")})` : ""}`;
  return (
    <div>
      <p className="mb-2 h-4 text-xs text-muted-foreground" aria-live="polite">{hover != null ? detail(weeks[hover]) : "Hover or focus a bar for details."}</p>
      <div className="relative ml-6 flex h-40 items-end gap-[2px] border-b border-border">
        {[0.5, 1].map((f) => (
          <div key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/60" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -left-6 -top-2 w-5 text-right text-[10px] tabular-nums text-muted-foreground">{Math.round(max * f * 10) / 10}</span>
          </div>
        ))}
        {weeks.map((w, i) => (
          <button
            key={w.start}
            type="button"
            className="group relative flex h-full flex-1 items-end justify-center focus:outline-none"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={detail(w)}
          >
            <span
              className={cn("w-full max-w-10 rounded-t-[4px] bg-foreground/70 transition-colors", hover === i && "bg-foreground", w.count === 0 && "bg-transparent")}
              style={{ height: `${(w.count / max) * 100}%` }}
            />
          </button>
        ))}
      </div>
      <div className="ml-6 mt-1 flex gap-[2px]">
        {weeks.map((w, i) => (
          <span key={w.start} className={cn("flex-1 text-center text-[10px] tabular-nums text-muted-foreground", i % 2 === 1 && "max-sm:invisible")}>{weekLabel(w.start)}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Applications per week</caption>
        <thead><tr><th>Week of</th><th>Applications</th></tr></thead>
        <tbody>{weeks.map((w) => <tr key={w.start}><td>{w.start}</td><td>{w.count}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export default function StatsPage() {
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<Stats>("/api/stats"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load stats.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader title="Stats" description="How your search is going in each track. Response rate counts any reply, including rejections." />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          <Skeleton className="h-56" />
        </div>
      ) : data.total.jobs === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" />}
          title="No stats yet"
          description="Save and apply to a few jobs, and your response and interview rates show up here by track."
          action={<Button asChild><Link href="/jobs/new"><Plus /> Add a job</Link></Button>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Applied" value={String(data.total.applied)} sub={`of ${data.total.jobs} saved jobs`} />
            <Tile label="Response rate" value={rate(data.total.responseRate)} sub={`${data.total.responses} replied`} />
            <Tile label="Interview rate" value={rate(data.total.interviewRate)} sub={`${data.total.interviews} interviewing or offer`} />
            <Tile label="Offers" value={String(data.total.offers)} sub={data.total.avgMatch != null ? `Avg match ${data.total.avgMatch}/100` : undefined} />
          </div>

          <Card>
            <CardHeader><CardTitle>By track</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    {["Track", "Jobs", "Applied", "Response rate", "Interview rate", "Offers", "Avg match", "Fake entry-level"].map((h, i) => (
                      <th key={h} className={cn("py-2 font-medium", i > 0 && "text-right")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.tracks.map((t) => (
                    <tr key={t.id ?? "none"} className="border-b last:border-0">
                      <td className="py-2">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} aria-hidden />
                          {t.id ? <Link href={`/tracks/${t.id}`} className="hover:underline">{t.name}</Link> : t.name}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{t.jobs}</td>
                      <td className="text-right tabular-nums">{t.applied}</td>
                      <td className="text-right tabular-nums">{rate(t.responseRate)} <span className="text-xs text-muted-foreground">({t.responses})</span></td>
                      <td className="text-right tabular-nums">{rate(t.interviewRate)} <span className="text-xs text-muted-foreground">({t.interviews})</span></td>
                      <td className="text-right tabular-nums">{t.offers}</td>
                      <td className="text-right tabular-nums">{t.avgMatch ?? "–"}</td>
                      <td className="text-right tabular-nums">{t.fakeEntryLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">Rates are out of jobs you&apos;ve applied to. Avg match only counts jobs where you ran the match analysis.</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Applications per week</CardTitle>
                <CardDescription className="mt-1">Last 8 weeks, by date applied.</CardDescription>
              </CardHeader>
              <CardContent><WeeklyChart weeks={data.weeks} tracks={data.tracks} /></CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Skill gaps</CardTitle>
                <CardDescription className="mt-1">What jobs in each track ask for most that your profile lacks. Hover a row to see which jobs.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.tracks.filter((t) => t.id).length ? (
                  <Tabs defaultValue={data.tracks.find((t) => t.id)!.id!}>
                    <TabsList className="mb-3">
                      {data.tracks.filter((t) => t.id).map((t) => <TabsTrigger key={t.id} value={t.id!}>{t.name}</TabsTrigger>)}
                    </TabsList>
                    {data.tracks.filter((t) => t.id).map((t) => (
                      <TabsContent key={t.id} value={t.id!}><SkillGapsList trackId={t.id!} limit={8} /></TabsContent>
                    ))}
                  </Tabs>
                ) : (
                  <p className="text-sm text-muted-foreground">Create a track to see skill gaps.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
