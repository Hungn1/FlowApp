"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlarmClock, CalendarCheck, CalendarClock, Check, Clock, Hourglass, Plus, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";
import { api } from "@/lib/api-client";
import type { ApplicationDTO, Dashboard } from "@/lib/applications/service";
import { addDays } from "@/lib/dates";
import { STATUSES } from "@/lib/jobs/schema";
import { cn } from "@/lib/utils";

function Row({
  app,
  detail,
  tone,
  actions,
}: {
  app: ApplicationDTO;
  detail: string;
  tone?: "danger" | "warning";
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center">
      <span className="hidden h-8 w-1 shrink-0 rounded-full sm:block" style={{ background: app.track?.color ?? "var(--border)" }} />
      <Link href={`/jobs/${app.jobId}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium hover:underline">{app.company} · {app.title}</p>
        <p className={cn("truncate text-xs", tone === "danger" ? "text-destructive" : tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
          {detail}
        </p>
      </Link>
      {actions && <div className="flex shrink-0 gap-1">{actions}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<Dashboard>("/api/dashboard"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the dashboard.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function patch(jobId: string, body: Record<string, string>, msg: string) {
    try {
      await api(`/api/applications/${jobId}`, { method: "PATCH", json: body });
      toast.success(msg);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update.", { action: { label: "Retry", onClick: () => patch(jobId, body, msg) } });
    }
  }

  const followUpActions = (a: ApplicationDTO) => (
    <>
      <Button size="sm" variant="outline" onClick={() => patch(a.jobId, { followUpDate: "", nextAction: "" }, "Marked done")}>
        <Check /> Done
      </Button>
      <Button size="sm" variant="ghost" onClick={() => patch(a.jobId, { followUpDate: addDays(data!.today, 3) }, "Snoozed 3 days")}>
        +3 days
      </Button>
    </>
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={data ? `What needs your attention today, ${new Date(`${data.today}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}.` : "What needs your attention today."}
        actions={<Button asChild><Link href="/jobs/new"><Plus /> Add job</Link></Button>}
      />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {!data.hasProfile && (
            <Card className="border-amber-300 dark:border-amber-800">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2 text-sm"><User className="h-4 w-4" /> Add your master resume first. Tailored resumes are built from it.</p>
                <Button asChild size="sm"><Link href="/profile">Go to Profile</Link></Button>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {STATUSES.map((s) => (
              <Link key={s} href="/tracker" className="rounded-lg border p-3 transition-colors hover:border-foreground/30">
                <p className="text-2xl font-semibold tabular-nums">{data.counts[s]}</p>
                <p className="text-xs text-muted-foreground">{s}</p>
              </Link>
            ))}
          </div>

          {data.total === 0 ? (
            <EmptyState
              icon={<CalendarCheck className="h-8 w-8" />}
              title="Nothing due today"
              description="Save a job posting and ApplyFlow will remind you when to follow up."
              action={<Button asChild><Link href="/jobs/new"><Plus /> Add your first job</Link></Button>}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AlarmClock className="h-4 w-4" /> Due today</CardTitle>
                  <CardDescription>Follow-ups scheduled for today, plus any you missed.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {data.overdue.length === 0 && data.dueToday.length === 0 && <p className="text-sm text-muted-foreground">Nothing due today.</p>}
                  {data.overdue.map((a) => (
                    <Row key={a.jobId} app={a} tone="danger" detail={`Overdue since ${a.followUpDate}: ${a.nextAction || "Follow up"}`} actions={followUpActions(a)} />
                  ))}
                  {data.dueToday.map((a) => (
                    <Row key={a.jobId} app={a} tone="warning" detail={`Today: ${a.nextAction || "Follow up"}`} actions={followUpActions(a)} />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Hourglass className="h-4 w-4" /> No response after 7 days</CardTitle>
                  <CardDescription>Applied, with no reply yet. A short follow-up email often helps.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {data.noResponse.length === 0 && <p className="text-sm text-muted-foreground">No applications waiting more than a week.</p>}
                  {data.noResponse.map((a) => (
                    <Row
                      key={a.jobId}
                      app={a}
                      tone={a.daysWaiting >= 14 ? "danger" : "warning"}
                      detail={`Applied ${a.appliedAt}, ${a.daysWaiting} days ago`}
                      actions={
                        <>
                          <Button size="sm" variant="outline" onClick={() => patch(a.jobId, { lastResponseAt: data.today }, "Marked as heard back")}>
                            They replied
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => patch(a.jobId, { status: "Rejected" }, "Moved to Rejected")}>
                            Rejected
                          </Button>
                        </>
                      }
                    />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Deadlines in the next 2 weeks</CardTitle>
                  <CardDescription>Saved jobs you haven&apos;t applied to yet.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {data.upcomingDeadlines.length === 0 && <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>}
                  {data.upcomingDeadlines.map((a) => (
                    <Row key={a.jobId} app={a} detail={`Apply by ${a.deadline}`} />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Quick links</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm"><Link href="/tracker">Open tracker</Link></Button>
                  <Button asChild variant="outline" size="sm"><Link href="/jobs">All jobs</Link></Button>
                  <Button asChild variant="outline" size="sm"><Link href="/tracks">Tracks</Link></Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </>
  );
}
