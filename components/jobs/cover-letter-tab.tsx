"use client";
import { useEffect, useState } from "react";
import { Copy, Loader2, Mail, RotateCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { api, ApiError } from "@/lib/api-client";
import type { CoverLetterDTO } from "@/lib/materials/service";
import { cn } from "@/lib/utils";
import { ExportButtons } from "@/components/export-buttons";
import { AiSetupNote, GenerateError, SourceBadge, StaleNote, useGenerated, when } from "./ai-shared";

const MAX = 250;
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export function CoverLetterTab({ jobId }: { jobId: string }) {
  const { data, setData, loaded, loadError, load, generate, generating, genError } = useGenerated<CoverLetterDTO>(`/api/jobs/${jobId}/cover-letter`);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => {
    if (data) setText(data.content);
  }, [data]);

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;
  if (!loaded) return <ListSkeleton rows={3} />;
  const err = genError && <GenerateError error={genError} onRetry={() => generate(genError.mode)} onBasic={() => generate("basic")} />;

  if (!data)
    return (
      <div className="flex flex-col gap-3">
        {err}
        <EmptyState
          icon={<Mail className="h-8 w-8" />}
          title="Write a cover letter"
          description={`Under ${MAX} words, addressing 2 or 3 of this job's requirements with real examples from your profile. You can edit it after.`}
          action={
            <Button onClick={() => generate()} disabled={generating}>
              {generating ? <Loader2 className="animate-spin" /> : <Mail />} {generating ? "Writing…" : "Write cover letter"}
            </Button>
          }
        />
        <AiSetupNote what="the cover letter" />
      </div>
    );

  const n = words(text);
  const dirty = text !== data.content;
  const tooLong = n > MAX;

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      setData(await api<CoverLetterDTO>(`/api/jobs/${jobId}/cover-letter`, { method: "PUT", json: { content: text } }));
      toast.success("Cover letter saved");
    } catch (e) {
      setSaveError(e instanceof ApiError && e.fieldErrors?.content ? e.fieldErrors.content[0] : e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    setConfirmRegen(false);
    await generate(data!.source === "basic" ? "basic" : "auto");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {err}
      {data.stale && <StaleNote what="letter" onRedo={regenerate} busy={generating} />}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Cover letter</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copy}><Copy /> Copy</Button>
              <ExportButtons url={`/api/jobs/${jobId}/export?doc=cover`} disabled={dirty} disabledReason="Save your edits first" />
              <Button size="sm" onClick={save} disabled={!dirty || saving || tooLong || !text.trim()}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />} {dirty ? "Save" : "Saved"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {saveError && <ErrorState message={saveError} onRetry={save} />}
            <Textarea
              aria-label="Cover letter text"
              rows={18}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-invalid={tooLong || !text.trim()}
              className="font-serif text-[15px] leading-relaxed"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className={cn("tabular-nums", tooLong ? "font-medium text-destructive" : "text-muted-foreground")} aria-live="polite">
                {n} / {MAX} words{tooLong ? `: cut ${n - MAX} to save` : ""}
              </span>
              {dirty && <button className="text-muted-foreground underline" onClick={() => setText(data.content)}>Undo edits</button>}
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Addresses</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {data.cited.length ? data.cited.map((c) => <p key={c.id} className="rounded-md bg-muted/60 p-2">{c.text}</p>) : <p className="text-muted-foreground">No specific requirements recorded.</p>}
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <SourceBadge source={data.source} /> <span>{when(data.generatedAt)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              {confirmRegen ? (
                <>
                  <p className="text-sm">Replace this letter{dirty ? " and your unsaved edits" : ""} with a new draft?</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={regenerate}>Replace</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmRegen(false)}>Cancel</Button>
                  </div>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setConfirmRegen(true)} disabled={generating}>
                  {generating ? <Loader2 className="animate-spin" /> : <RotateCw />} {generating ? "Writing…" : "Write a new draft"}
                </Button>
              )}
              <Badge variant="outline" className="w-fit font-normal">Tip: read it out loud before sending.</Badge>
            </CardContent>
          </Card>
          <AiSetupNote what="the cover letter" />
        </div>
      </div>
    </div>
  );
}
