"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, Loader2, RotateCcw, Save, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, ListSkeleton, PageHeader } from "@/components/states";
import { ColorPicker } from "@/components/tracks/color-picker";
import { ResumePreview } from "@/components/resume/resume-preview";
import { ExportButtons } from "@/components/export-buttons";
import { SkillGapsCard } from "@/components/tracks/skill-gaps";
import { api, ApiError } from "@/lib/api-client";
import { buildResume } from "@/lib/resume/build";
import type { ItemType } from "@/lib/resume/types";
import { EMPHASIS_OPTIONS, type Emphasis } from "@/lib/tracks/defaults";
import type { TrackDetail, TrackItemView } from "@/lib/tracks/service";
import { cn } from "@/lib/utils";

const TYPE_TABS: { type: ItemType; label: string; hint: string }[] = [
  { type: "skill", label: "Skills", hint: "Top of the list appears first in the Skills section. Hide skills that don't fit this track." },
  { type: "project", label: "Projects", hint: "Star up to 3 to feature them. If none are starred, the top 3 are used." },
  { type: "experience", label: "Experience", hint: "Order of roles on the resume. Usually most recent first." },
  { type: "cert", label: "Certifications", hint: "Put the most relevant certification first." },
  { type: "education", label: "Education", hint: "" },
];

export default function TrackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [track, setTrack] = useState<TrackDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // editable copies
  const [settings, setSettings] = useState({ name: "", color: "", emphasis: "general" as Emphasis, summary: "", keywords: "" });
  const [items, setItems] = useState<TrackItemView[]>([]);
  const [dirtySettings, setDirtySettings] = useState(false);
  const [dirtyItems, setDirtyItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const apply = useCallback((t: TrackDetail) => {
    setTrack(t);
    setSettings({ name: t.name, color: t.color, emphasis: t.emphasis, summary: t.summary, keywords: t.keywords.join(", ") });
    setItems(t.items);
    setDirtySettings(false);
    setDirtyItems(false);
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      apply(await api<TrackDetail>(`/api/tracks/${id}`));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setLoadError(e instanceof Error ? e.message : "Couldn't load this track.");
    }
  }, [id, apply]);
  useEffect(() => {
    load();
  }, [load]);

  const preview = useMemo(
    () => (track ? buildResume(track.profile, settings.emphasis, settings.summary, items) : null),
    [track, settings.emphasis, settings.summary, items]
  );

  function updateItems(type: ItemType, fn: (list: TrackItemView[]) => TrackItemView[]) {
    setItems((all) => {
      const list = all.filter((i) => i.itemType === type).sort((a, b) => a.order - b.order);
      const next = fn(list).map((i, order) => ({ ...i, order }));
      return [...all.filter((i) => i.itemType !== type), ...next];
    });
    setDirtyItems(true);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    setErrors({});
    try {
      let t: TrackDetail | null = null;
      if (dirtySettings) {
        const keywords = settings.keywords.split(",").map((k) => k.trim()).filter(Boolean);
        t = await api<TrackDetail>(`/api/tracks/${id}`, {
          method: "PATCH",
          json: { name: settings.name, color: settings.color, emphasis: settings.emphasis, summary: settings.summary, keywords },
        });
      }
      if (dirtyItems) {
        t = await api<TrackDetail>(`/api/tracks/${id}/items`, {
          method: "PUT",
          json: { items: items.map(({ itemType, itemId, order, featured, hidden }) => ({ itemType, itemId, order, featured, hidden })) },
        });
      }
      if (t) apply(t);
      toast.success("Track saved");
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        setErrors(e.fieldErrors);
        setSaveError("Some fields need fixing.");
      } else setSaveError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    try {
      apply(await api<TrackDetail>(`/api/tracks/${id}/reset`, { method: "POST" }));
      toast.success("Order reset to the default for this emphasis");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed.");
    }
  }

  async function remove() {
    try {
      await api(`/api/tracks/${id}`, { method: "DELETE" });
      toast.success("Track deleted");
      router.push("/tracks");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  if (notFound) {
    return (
      <>
        <PageHeader title="Track not found" />
        <Button asChild variant="outline"><Link href="/tracks"><ArrowLeft /> Back to tracks</Link></Button>
      </>
    );
  }
  if (loadError) return <><PageHeader title="Track" /><ErrorState message={loadError} onRetry={load} /></>;
  if (!track || !preview) return <><PageHeader title="Track" /><ListSkeleton rows={4} /></>;

  const dirty = dirtySettings || dirtyItems;
  const set = (patch: Partial<typeof settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setDirtySettings(true);
  };

  return (
    <>
      <Link href="/tracks" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Tracks
      </Link>
      <PageHeader
        title={track.name}
        description={`${track.jobCount} ${track.jobCount === 1 ? "job" : "jobs"} in this track`}
        actions={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</Button>
            <Button onClick={save} disabled={!dirty || saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} {dirty ? "Save" : "Saved"}
            </Button>
          </>
        }
      />
      {!track.profile.exists && (
        <div className="mb-4"><ErrorState message="Your profile is empty, so this track has nothing to show. Add your resume on the Profile page first." /></div>
      )}
      {saveError && <div className="mb-4"><ErrorState message={saveError} onRetry={save} /></div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={settings.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!!errors.name} />
                {errors.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Color</Label>
                <ColorPicker value={settings.color} onChange={(color) => set({ color })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="emphasis">Highlight</Label>
                <NativeSelect id="emphasis" value={settings.emphasis} onChange={(e) => set({ emphasis: e.target.value as Emphasis })}>
                  {EMPHASIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">{EMPHASIS_OPTIONS.find((o) => o.value === settings.emphasis)?.hint}. Changes the section order.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="summary">Summary line</Label>
                <Textarea id="summary" rows={3} value={settings.summary} onChange={(e) => set({ summary: e.target.value })} aria-invalid={!!errors.summary} />
                <p className={cn("text-xs", settings.summary.length > 400 ? "text-destructive" : "text-muted-foreground")}>
                  {settings.summary.length}/400. Keep it to facts that are in your profile.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="keywords">Auto-assign keywords</Label>
                <Input id="keywords" value={settings.keywords} onChange={(e) => set({ keywords: e.target.value })} />
                <p className="text-xs text-muted-foreground">New jobs whose title or description mention these words go into this track.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>What goes on this resume</CardTitle>
                <CardDescription className="mt-1">Reorder, hide, or feature items. The preview updates as you go.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}><RotateCcw /> Reset</Button>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="skill">
                <TabsList>
                  {TYPE_TABS.map((t) => (
                    <TabsTrigger key={t.type} value={t.type}>{t.label}</TabsTrigger>
                  ))}
                </TabsList>
                {TYPE_TABS.map((t) => {
                  const list = items.filter((i) => i.itemType === t.type).sort((a, b) => a.order - b.order);
                  return (
                    <TabsContent key={t.type} value={t.type} className="flex flex-col gap-2">
                      {t.hint && <p className="text-xs text-muted-foreground">{t.hint}</p>}
                      {list.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nothing in your profile yet.</p>}
                      {list.map((it, idx) => (
                        <div key={it.itemId} className={cn("flex items-center gap-2 rounded-md border px-3 py-2", it.hidden && "opacity-50")}>
                          <div className="min-w-0 flex-1">
                            <p className={cn("truncate text-sm font-medium", it.hidden && "line-through")}>{it.label}</p>
                            {it.sublabel && <p className="truncate text-xs text-muted-foreground">{it.sublabel}</p>}
                          </div>
                          {t.type === "project" && (
                            <Button
                              variant="ghost" size="icon"
                              aria-label={it.featured ? `Unfeature ${it.label}` : `Feature ${it.label}`}
                              aria-pressed={it.featured}
                              onClick={() => updateItems("project", (l) => l.map((x) => (x.itemId === it.itemId ? { ...x, featured: !x.featured } : x)))}
                            >
                              <Star className={cn(it.featured && "fill-amber-400 text-amber-500")} />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" aria-label={`Move ${it.label} up`} disabled={idx === 0}
                            onClick={() => updateItems(t.type, (l) => { const n = [...l]; [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]]; return n; })}>
                            <ArrowUp />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={`Move ${it.label} down`} disabled={idx === list.length - 1}
                            onClick={() => updateItems(t.type, (l) => { const n = [...l]; [n[idx + 1], n[idx]] = [n[idx], n[idx + 1]]; return n; })}>
                            <ArrowDown />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label={it.hidden ? `Show ${it.label}` : `Hide ${it.label}`}
                            onClick={() => updateItems(t.type, (l) => l.map((x) => (x.itemId === it.itemId ? { ...x, hidden: !x.hidden } : x)))}>
                            {it.hidden ? <EyeOff /> : <Eye />}
                          </Button>
                        </div>
                      ))}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>

          <SkillGapsCard trackId={track.id} />
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Base resume preview</p>
            <div className="flex gap-2">
              <ExportButtons url={`/api/tracks/${track.id}/export`} disabled={dirty || !track.profile.exists} disabledReason={dirty ? "Save your changes first" : "Add your profile first"} />
            </div>
          </div>
          <ResumePreview doc={preview} className="max-h-[80vh] overflow-auto" />
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {track.name}?</DialogTitle>
            <DialogDescription>
              The track and its ordering are removed. Its {track.jobCount} {track.jobCount === 1 ? "job stays" : "jobs stay"} in ApplyFlow as Unassigned. Your profile is not changed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={remove}><Trash2 /> Delete track</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
