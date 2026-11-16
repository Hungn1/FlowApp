"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KanbanSquare, Plus, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";
import { Board } from "@/components/tracker/board";
import { TrackerTable } from "@/components/tracker/table";
import { api } from "@/lib/api-client";
import type { ApplicationDTO } from "@/lib/applications/service";
import type { Status } from "@/lib/jobs/schema";
import { cn } from "@/lib/utils";

const VIEW_KEY = "applyflow.tracker.view";

export default function TrackerPage() {
  const [apps, setApps] = useState<ApplicationDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "table">("board");
  const [track, setTrack] = useState("all");

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "table" || v === "board") setView(v);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const changeView = (v: "board" | "table") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      setApps(await api<ApplicationDTO[]>("/api/applications"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your applications.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const tracks = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    apps?.forEach((a) => a.track && m.set(a.track.id, a.track));
    return [...m.values()];
  }, [apps]);
  const shown = useMemo(
    () => (apps ?? []).filter((a) => track === "all" || (track === "none" ? !a.track : a.track?.id === track)),
    [apps, track]
  );

  async function persist(jobId: string, patch: { status?: Status; boardOrder?: number }, previous: ApplicationDTO[]) {
    try {
      const updated = await api<ApplicationDTO>(`/api/applications/${jobId}`, { method: "PATCH", json: patch });
      setApps((list) => list?.map((a) => (a.jobId === jobId ? updated : a)) ?? null);
      if (patch.status && patch.status !== previous.find((a) => a.jobId === jobId)?.status) {
        toast.success(`Moved to ${patch.status}`);
      }
    } catch (e) {
      setApps(previous);
      toast.error(e instanceof Error ? e.message : "Couldn't save that move.", {
        action: { label: "Retry", onClick: () => { setApps((l) => l?.map((a) => (a.jobId === jobId ? { ...a, ...patch } : a)) ?? null); persist(jobId, patch, previous); } },
      });
    }
  }

  function onMove(jobId: string, status: Status, orderedIds: string[]) {
    if (!apps) return;
    const previous = apps;
    const idx = orderedIds.indexOf(jobId);
    const orderOf = (id: string | undefined) => apps.find((a) => a.jobId === id)?.boardOrder;
    const before = orderOf(orderedIds[idx - 1]);
    const after = orderOf(orderedIds[idx + 1]);
    const boardOrder =
      before != null && after != null ? (before + after) / 2 : before != null ? before + 1000 : after != null ? after - 1000 : Date.now();
    setApps(apps.map((a) => (a.jobId === jobId ? { ...a, status, boardOrder } : a)).sort((a, b) => a.boardOrder - b.boardOrder));
    persist(jobId, { status, boardOrder }, previous);
  }

  function onStatus(jobId: string, status: Status) {
    if (!apps) return;
    const previous = apps;
    setApps(apps.map((a) => (a.jobId === jobId ? { ...a, status } : a)));
    persist(jobId, { status }, previous);
  }

  return (
    <>
      <PageHeader
        title="Tracker"
        description="Drag cards as your applications move forward. Moving a card to Applied sets the applied date and a follow-up in 7 days."
        actions={<Button asChild><Link href="/jobs/new"><Plus /> Add job</Link></Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="View">
          <Button size="sm" variant={view === "board" ? "secondary" : "ghost"} aria-pressed={view === "board"} onClick={() => changeView("board")}>
            <KanbanSquare /> Board
          </Button>
          <Button size="sm" variant={view === "table" ? "secondary" : "ghost"} aria-pressed={view === "table"} onClick={() => changeView("table")}>
            <Table2 /> Table
          </Button>
        </div>
        <NativeSelect aria-label="Filter by track" value={track} onChange={(e) => setTrack(e.target.value)} className="w-48">
          <option value="all">All tracks</option>
          {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          <option value="none">Unassigned</option>
        </NativeSelect>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !apps ? (
        <div className={cn("flex gap-3 overflow-hidden")}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-64 w-64 shrink-0 md:flex-1" />)}
        </div>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={<KanbanSquare className="h-8 w-8" />}
          title="No applications yet"
          description="Every job you save shows up here in Saved. Add one to get started."
          action={<Button asChild><Link href="/jobs/new"><Plus /> Add job</Link></Button>}
        />
      ) : view === "board" ? (
        <Board apps={shown} onMove={onMove} />
      ) : (
        <TrackerTable apps={shown} onStatus={onStatus} />
      )}
    </>
  );
}
