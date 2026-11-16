"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Layers, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/states";
import { ColorPicker } from "@/components/tracks/color-picker";
import { api, ApiError } from "@/lib/api-client";
import { EMPHASIS_OPTIONS, TRACK_COLORS, type Emphasis } from "@/lib/tracks/defaults";
import type { TrackListItem } from "@/lib/tracks/service";

export default function TracksPage() {
  const [tracks, setTracks] = useState<TrackListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTracks(await api<TrackListItem[]>("/api/tracks"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load tracks.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Tracks"
        description="Each track is a base resume built from your profile, with its own summary, skill order and featured projects."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> New track
          </Button>
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !tracks ? (
        <ListSkeleton rows={3} />
      ) : tracks.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-8 w-8" />}
          title="Create a track"
          description="A track is a kind of role you apply for, like UX/UI or Cybersecurity. Jobs are sorted into tracks automatically."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                onClick={async () => {
                  try {
                    await api("/api/tracks/defaults", { method: "POST" });
                    load();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Couldn't add the default tracks.");
                  }
                }}
              >
                Add UX/UI, Cybersecurity and Tech Support
              </Button>
              <Button variant="outline" onClick={() => setOpen(true)}><Plus /> New track</Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((t) => (
            <Link key={t.id} href={`/tracks/${t.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-foreground/30">
                <CardContent className="flex h-full flex-col gap-2 p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.color }} />
                    <p className="font-semibold">{t.name}</p>
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{t.summary || "No summary yet."}</p>
                  <p className="mt-auto pt-2 text-xs text-muted-foreground">
                    {t.jobCount} {t.jobCount === 1 ? "job" : "jobs"} · {t.activeCount} active ·{" "}
                    {EMPHASIS_OPTIONS.find((o) => o.value === t.emphasis)?.label}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <NewTrackDialog open={open} onOpenChange={setOpen} usedColors={tracks?.map((t) => t.color) ?? []} onCreated={load} />
    </>
  );
}

function NewTrackDialog({
  open,
  onOpenChange,
  usedColors,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  usedColors: string[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(TRACK_COLORS[3]);
  const [emphasis, setEmphasis] = useState<Emphasis>("general");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setErrors({});
      setError(null);
      setColor(TRACK_COLORS.find((c) => !usedColors.includes(c)) ?? TRACK_COLORS[0]);
    }
  }, [open, usedColors]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErrors({ name: ["Name is required"] });
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await api("/api/tracks", { method: "POST", json: { name, color, emphasis } });
      toast.success(`Created ${name}`);
      onOpenChange(false);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      else setError(err instanceof Error ? err.message : "Couldn't create the track.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New track</DialogTitle>
            <DialogDescription>It starts with every item in your profile, ordered for the emphasis you pick. You can fine-tune it after.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="track-name">Name</Label>
            <Input id="track-name" value={name} placeholder="e.g. Data Analyst" onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} autoFocus />
            {errors.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="track-emphasis">What should this resume highlight?</Label>
            <NativeSelect id="track-emphasis" value={emphasis} onChange={(e) => setEmphasis(e.target.value as Emphasis)}>
              {EMPHASIS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </NativeSelect>
          </div>
          {error && <ErrorState message={error} />}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Create track
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
