"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Calendar, MapPin, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/states";
import { formatPay, TrackChip, VerdictBadge, WORK_MODE_LABEL } from "@/components/jobs/badges";
import { api } from "@/lib/api-client";
import type { JobDTO } from "@/lib/jobs/service";

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [track, setTrack] = useState("all");
  const [verdict, setVerdict] = useState("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      setJobs(await api<JobDTO[]>("/api/jobs"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load jobs.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const tracks = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    jobs?.forEach((j) => j.track && m.set(j.track.id, j.track));
    return [...m.values()];
  }, [jobs]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (jobs ?? []).filter(
      (j) =>
        (track === "all" || (track === "none" ? !j.trackId : j.trackId === track)) &&
        (verdict === "all" || (verdict === "fake" ? j.fakeEntryLevel : j.entryLevelVerdict === verdict)) &&
        (!needle || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(needle))
    );
  }, [jobs, q, track, verdict]);

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Every posting you've saved, with its track and entry-level verdict."
        actions={
          <Button asChild>
            <Link href="/jobs/new"><Plus /> Add job</Link>
          </Button>
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !jobs ? (
        <ListSkeleton rows={5} />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-8 w-8" />}
          title="Paste your first job posting"
          description="Adding a job takes under a minute: paste the description, check the extracted details, save."
          action={<Button asChild><Link href="/jobs/new"><Plus /> Add job</Link></Button>}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, company, location" className="pl-8" />
            </div>
            <NativeSelect aria-label="Filter by track" value={track} onChange={(e) => setTrack(e.target.value)} className="sm:w-48">
              <option value="all">All tracks</option>
              {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              <option value="none">Unassigned</option>
            </NativeSelect>
            <NativeSelect aria-label="Filter by entry-level verdict" value={verdict} onChange={(e) => setVerdict(e.target.value)} className="sm:w-48">
              <option value="all">All verdicts</option>
              <option value="true">True entry-level</option>
              <option value="stretch">Stretch</option>
              <option value="not">Not entry-level</option>
              <option value="fake">Fake entry-level</option>
            </NativeSelect>
          </div>
          {shown.length === 0 ? (
            <EmptyState title="No jobs match these filters" action={<Button variant="outline" onClick={() => { setQ(""); setTrack("all"); setVerdict("all"); }}>Clear filters</Button>} />
          ) : (
            <div className="flex flex-col gap-2">
              {shown.map((j) => (
                <Link key={j.id} href={`/jobs/${j.id}`}>
                  <Card className="transition-colors hover:border-foreground/30">
                    <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{j.title}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {j.company}
                          {j.location && <><MapPin className="ml-2 mr-0.5 inline h-3 w-3" />{j.location}</>}
                          {j.workMode !== "unknown" && ` · ${WORK_MODE_LABEL[j.workMode]}`}
                          {formatPay(j.payMin, j.payMax, j.payPeriod) && ` · ${formatPay(j.payMin, j.payMax, j.payPeriod)}`}
                          {j.deadline && <><Calendar className="ml-2 mr-0.5 inline h-3 w-3" />Apply by {j.deadline}</>}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        <TrackChip track={j.track} />
                        <VerdictBadge verdict={j.entryLevelVerdict} fake={j.fakeEntryLevel} />
                        <Badge variant="secondary">{j.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
