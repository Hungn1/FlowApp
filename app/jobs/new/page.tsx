"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Info, Link2, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, PageHeader } from "@/components/states";
import { cleanJob, JobForm } from "@/components/jobs/job-form";
import { api, ApiError } from "@/lib/api-client";
import type { JobInputT } from "@/lib/jobs/schema";
import type { JobDTO } from "@/lib/jobs/service";
import type { TrackListItem } from "@/lib/tracks/service";

type ExtractResult = { source: "ai" | "rules"; aiAvailable: boolean; draft: JobInputT; suggestion: { trackId: string | null; reason: string } };

export default function NewJobPage() {
  const router = useRouter();
  const [tab, setTab] = useState("paste");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [form, setForm] = useState<JobInputT | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackListItem[]>([]);

  useEffect(() => {
    api<TrackListItem[]>("/api/tracks").then(setTracks).catch(() => setTracks([]));
  }, []);

  async function extract(mode: "auto" | "rules" = "auto") {
    setError(null);
    setInputError(null);
    if (tab === "paste" && text.trim().length < 80) return setInputError("Paste the full job description (at least a few lines).");
    if (tab === "url" && !/^https?:\/\/\S+\.\S+/.test(url.trim())) return setInputError("Enter a full URL starting with http:// or https://");
    setBusy(true);
    try {
      const r = await api<ExtractResult>("/api/jobs/extract", {
        method: "POST",
        json: tab === "paste" ? { text, url: "", mode } : { text: "", url: url.trim(), mode },
      });
      setResult(r);
      setForm(r.draft);
      setErrors({});
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors?.url) setInputError(e.fieldErrors.url[0]);
      setError(e instanceof Error ? e.message : "Extraction failed.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    setErrors({});
    try {
      const job = await api<JobDTO>("/api/jobs", { method: "POST", json: cleanJob(form) });
      toast.success(`Saved ${job.title} at ${job.company}`);
      router.push(`/jobs/${job.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        setErrors(e.fieldErrors);
        setSaveError("Some fields need fixing. They're marked in red.");
      } else setSaveError(e instanceof Error ? e.message : "Save failed.");
      setSaving(false);
    }
  }

  return (
    <>
      <Link href="/jobs" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Jobs
      </Link>
      <PageHeader
        title="Add a job"
        description="Paste the posting or its link. ApplyFlow pulls out the details and checks if it's really entry-level."
        actions={
          form ? (
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Save job
            </Button>
          ) : null
        }
      />

      {!form ? (
        <Card>
          <CardHeader>
            <CardTitle>Job posting</CardTitle>
            <CardDescription>You still apply on the employer&apos;s site. ApplyFlow only reads the one page you give it.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Tabs value={tab} onValueChange={(v) => { setTab(v); setInputError(null); setError(null); }}>
              <TabsList>
                <TabsTrigger value="paste">Paste description</TabsTrigger>
                <TabsTrigger value="url">Job URL</TabsTrigger>
              </TabsList>
              <TabsContent value="paste">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste the whole job posting: title, company, location, requirements…"
                  className="min-h-72 text-sm"
                  aria-invalid={!!inputError}
                  autoFocus
                />
              </TabsContent>
              <TabsContent value="url" className="flex flex-col gap-2">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://company.com/careers/job-123" aria-invalid={!!inputError} />
                <p className="text-xs text-muted-foreground">
                  Works best with company career pages (Greenhouse, Lever, Workday). LinkedIn and Indeed usually block it; paste the text instead.
                </p>
              </TabsContent>
            </Tabs>
            {inputError && <p className="text-sm text-destructive">{inputError}</p>}
            {error && !inputError && <ErrorState message={error} onRetry={() => extract()} />}
            {error && (
              <p className="text-xs text-muted-foreground">
                AI not working?{" "}
                <button className="underline" onClick={() => extract("rules")}>Extract without AI</button> instead.
              </p>
            )}
            <div>
              <Button onClick={() => extract()} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : tab === "url" ? <Link2 /> : <Sparkles />}
                {busy ? "Reading the posting…" : "Extract details"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
            <span className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {result?.source === "ai"
                ? "Extracted with AI. Check the fields and requirements, then save."
                : result?.aiAvailable
                  ? "Extracted with basic rules. Check every field, then save."
                  : "Extracted with basic rules (no ANTHROPIC_API_KEY set). Check every field, then save."}
            </span>
            <Button variant="ghost" size="sm" onClick={() => { setForm(null); setResult(null); }}>Start over</Button>
          </div>
          {saveError && <ErrorState message={saveError} onRetry={save} />}
          <JobForm value={form} onChange={setForm} errors={errors} tracks={tracks} trackReason={result?.suggestion.reason} />
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} Save job
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
