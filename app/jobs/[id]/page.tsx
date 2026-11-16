"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, Pencil, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ErrorState, ListSkeleton, PageHeader } from "@/components/states";
import { formatPay, TrackChip, VerdictBadge, WORK_MODE_LABEL } from "@/components/jobs/badges";
import { cleanJob, JobForm } from "@/components/jobs/job-form";
import { InterviewTab } from "@/components/jobs/interview-tab";
import { ApplicationTab } from "@/components/jobs/application-tab";
import { MatchTab } from "@/components/jobs/match-tab";
import { ResumeTab } from "@/components/jobs/resume-tab";
import { CoverLetterTab } from "@/components/jobs/cover-letter-tab";
import { api, ApiError } from "@/lib/api-client";
import type { JobInputT } from "@/lib/jobs/schema";
import type { JobDTO } from "@/lib/jobs/service";
import type { TrackListItem } from "@/lib/tracks/service";

function toInput(j: JobDTO): JobInputT {
  return {
    title: j.title, company: j.company, location: j.location, workMode: j.workMode, payMin: j.payMin, payMax: j.payMax,
    payPeriod: j.payPeriod, sourceUrl: j.sourceUrl, rawDescription: j.rawDescription, minYears: j.minYears, maxYears: j.maxYears,
    requiredDegree: j.requiredDegree, requiredCerts: j.requiredCerts, deadline: j.deadline, labeledEntryLevel: j.labeledEntryLevel,
    trackId: j.trackId, requirements: j.requirements.map(({ id, text, kind, category }) => ({ id, text, kind, category })),
  };
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobDTO | null>(null);
  const [tracks, setTracks] = useState<TrackListItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<JobInputT | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState("overview");

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [j, t] = await Promise.all([api<JobDTO>(`/api/jobs/${id}`), api<TrackListItem[]>("/api/tracks")]);
      setJob(j);
      setTracks(t);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setLoadError(e instanceof Error ? e.message : "Couldn't load this job.");
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    setErrors({});
    try {
      const j = await api<JobDTO>(`/api/jobs/${id}`, { method: "PUT", json: cleanJob(form) });
      setJob(j);
      setEditing(false);
      toast.success("Job updated");
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        setErrors(e.fieldErrors);
        setSaveError("Some fields need fixing. They're marked in red.");
      } else setSaveError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api(`/api/jobs/${id}`, { method: "DELETE" });
      toast.success("Job deleted");
      router.push("/jobs");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  if (notFound)
    return (
      <>
        <PageHeader title="Job not found" description="It may have been deleted." />
        <Button asChild variant="outline"><Link href="/jobs"><ArrowLeft /> Back to jobs</Link></Button>
      </>
    );
  if (loadError) return <><PageHeader title="Job" /><ErrorState message={loadError} onRetry={load} /></>;
  if (!job) return <><PageHeader title="Job" /><ListSkeleton rows={4} /></>;

  const pay = formatPay(job.payMin, job.payMax, job.payPeriod);
  const hard = job.requirements.filter((r) => r.kind === "hard");
  const nice = job.requirements.filter((r) => r.kind === "nice");

  return (
    <>
      <Link href="/jobs" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Jobs
      </Link>
      <PageHeader
        title={job.title}
        description={[job.company, job.location, job.workMode !== "unknown" ? WORK_MODE_LABEL[job.workMode] : "", pay].filter(Boolean).join(" · ")}
        actions={
          editing ? (
            <>
              <Button variant="ghost" onClick={() => { setEditing(false); setErrors({}); setSaveError(null); }}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Save</Button>
            </>
          ) : (
            <>
              {job.sourceUrl && (
                <Button variant="outline" asChild>
                  <a href={job.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink /> Posting</a>
                </Button>
              )}
              <Button variant="outline" onClick={() => { setForm(toInput(job)); setEditing(true); setTab("overview"); }}><Pencil /> Edit</Button>
              <Button variant="outline" size="icon" aria-label="Delete job" onClick={() => setConfirmDelete(true)}><Trash2 /></Button>
            </>
          )
        }
      />
      <div className="-mt-3 mb-4 flex flex-wrap gap-1.5">
        <TrackChip track={job.track} />
        <VerdictBadge verdict={job.entryLevelVerdict} fake={job.fakeEntryLevel} />
        <Badge variant="secondary">{job.status}</Badge>
        {job.deadline && <Badge variant="outline">Apply by {job.deadline}</Badge>}
      </div>

      {editing && form ? (
        <div className="flex flex-col gap-4">
          {saveError && <ErrorState message={saveError} onRetry={save} />}
          <JobForm value={form} onChange={setForm} errors={errors} tracks={tracks} />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="match">Match</TabsTrigger>
            <TabsTrigger value="resume">Resume</TabsTrigger>
            <TabsTrigger value="cover">Cover letter</TabsTrigger>
            <TabsTrigger value="application">Application</TabsTrigger>
            <TabsTrigger value="interview">Interview prep</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex flex-col gap-4">
            <Card className={job.fakeEntryLevel ? "border-red-300 dark:border-red-900" : job.entryLevelVerdict === "stretch" ? "border-amber-300 dark:border-amber-900" : ""}>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle>Entry-level check</CardTitle>
                <VerdictBadge verdict={job.entryLevelVerdict} fake={job.fakeEntryLevel} />
              </CardHeader>
              <CardContent>
                <ul className="ml-4 list-disc text-sm text-muted-foreground">
                  {job.entryLevelReasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Hard requirements <span className="font-normal text-muted-foreground">({hard.length})</span></CardTitle></CardHeader>
                <CardContent>
                  {hard.length === 0 ? <p className="text-sm text-muted-foreground">None listed.</p> : (
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {hard.map((r) => <li key={r.id} className="flex gap-2"><Badge variant="outline" className="shrink-0">{r.category}</Badge>{r.text}</li>)}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Nice-to-haves <span className="font-normal text-muted-foreground">({nice.length})</span></CardTitle></CardHeader>
                <CardContent>
                  {nice.length === 0 ? <p className="text-sm text-muted-foreground">None listed.</p> : (
                    <ul className="flex flex-col gap-1.5 text-sm">
                      {nice.map((r) => <li key={r.id} className="flex gap-2"><Badge variant="outline" className="shrink-0">{r.category}</Badge>{r.text}</li>)}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Details</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {[
                    ["Years required", job.minYears != null ? `${job.minYears}${job.maxYears != null && job.maxYears !== job.minYears ? `–${job.maxYears}` : "+"}` : "Not stated"],
                    ["Required degree", job.requiredDegree || "None"],
                    ["Required certifications", job.requiredCerts.join(", ") || "None"],
                    ["Pay", pay || "Not stated"],
                    ["Deadline", job.deadline || "None"],
                    ["Added", job.createdAt.slice(0, 10)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b py-1.5 sm:block sm:border-0 sm:py-0">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            {job.rawDescription && (
              <Card>
                <CardHeader><CardTitle>Original posting</CardTitle></CardHeader>
                <CardContent>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-sans text-sm text-muted-foreground">{job.rawDescription}</pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="match"><MatchTab key={job.updatedAt} jobId={job.id} hasRequirements={job.requirements.length > 0} /></TabsContent>
          <TabsContent value="resume"><ResumeTab key={job.updatedAt} jobId={job.id} trackId={job.trackId} /></TabsContent>
          <TabsContent value="cover"><CoverLetterTab key={job.updatedAt} jobId={job.id} /></TabsContent>
          <TabsContent value="application"><ApplicationTab jobId={job.id} onStatusChange={(status) => setJob({ ...job, status })} /></TabsContent>
          <TabsContent value="interview"><InterviewTab jobId={job.id} trackName={job.track?.name ?? null} /></TabsContent>
        </Tabs>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this job?</DialogTitle>
            <DialogDescription>
              {job.title} at {job.company}, plus its application notes, contacts, tailored resume and cover letter, are deleted permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={remove}><Trash2 /> Delete job</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
