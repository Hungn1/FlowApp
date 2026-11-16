import { db } from "@/lib/db";
import type { Status } from "@/lib/jobs/schema";

import { addDays, dateOnly, daysBetween, toDate, todayStr } from "@/lib/dates";

export type ContactDTO = { id: string; name: string; role: string; email: string; linkedin: string; notes: string };

export type ApplicationDTO = {
  jobId: string;
  title: string;
  company: string;
  location: string;
  track: { id: string; name: string; color: string } | null;
  verdict: string;
  fakeEntryLevel: boolean;
  status: Status;
  boardOrder: number;
  appliedAt: string;
  followUpDate: string;
  lastResponseAt: string;
  nextAction: string;
  notes: string;
  deadline: string;
  createdAt: string;
  contacts: ContactDTO[];
};

const include = { job: { include: { track: { select: { id: true, name: true, color: true } } } }, contacts: true };
type Row = Awaited<ReturnType<typeof db.application.findFirstOrThrow<{ include: typeof include }>>>;

export function toDTO(a: Row): ApplicationDTO {
  return {
    jobId: a.jobId,
    title: a.job.title,
    company: a.job.company,
    location: a.job.location,
    track: a.job.track,
    verdict: a.job.entryLevelVerdict,
    fakeEntryLevel: a.job.labeledEntryLevel && a.job.entryLevelVerdict === "not",
    status: a.status as Status,
    boardOrder: a.boardOrder,
    appliedAt: dateOnly(a.appliedAt),
    followUpDate: dateOnly(a.followUpDate),
    lastResponseAt: dateOnly(a.lastResponseAt),
    nextAction: a.nextAction,
    notes: a.notes,
    deadline: dateOnly(a.job.deadline),
    createdAt: a.job.createdAt.toISOString(),
    contacts: a.contacts.map(({ id, name, role, email, linkedin, notes }) => ({ id, name, role, email, linkedin, notes })),
  };
}

export async function listApplications() {
  const rows = await db.application.findMany({ include, orderBy: { boardOrder: "asc" } });
  return rows.map(toDTO);
}

export async function getApplication(jobId: string) {
  // Older jobs might not have an application row yet; create one on demand.
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) return null;
  const row =
    (await db.application.findUnique({ where: { jobId }, include })) ??
    (await db.application.create({ data: { jobId, status: "Saved", boardOrder: Date.now() }, include }));
  return toDTO(row);
}

/** Apply a patch, filling in dates that a status change implies. */
export async function patchApplication(
  jobId: string,
  patch: Partial<Record<"appliedAt" | "followUpDate" | "lastResponseAt", string>> & { status?: Status; boardOrder?: number; nextAction?: string; notes?: string }
) {
  const current = await getApplication(jobId);
  if (!current) return null;
  const data: Record<string, unknown> = {};
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.boardOrder !== undefined) data.boardOrder = patch.boardOrder;
  if (patch.nextAction !== undefined) data.nextAction = patch.nextAction;
  if (patch.notes !== undefined) data.notes = patch.notes;
  for (const k of ["appliedAt", "followUpDate", "lastResponseAt"] as const) {
    if (patch[k] !== undefined) data[k] = toDate(patch[k]!);
  }
  if (patch.status && patch.status !== current.status) {
    const today = toDate(todayStr());
    // Moving past Saved means you applied; any later stage means they responded.
    if (patch.status !== "Saved" && !current.appliedAt && patch.appliedAt === undefined) data.appliedAt = today;
    if (["Interviewing", "Offer", "Rejected"].includes(patch.status) && !current.lastResponseAt && patch.lastResponseAt === undefined) data.lastResponseAt = today;
    if (patch.status === "Applied" && !current.followUpDate && patch.followUpDate === undefined) {
      data.followUpDate = toDate(addDays(todayStr(), 7));
      if (!current.nextAction && patch.nextAction === undefined) data.nextAction = "Follow up if no response";
    }
  }
  const row = await db.application.update({ where: { jobId }, data, include });
  return toDTO(row);
}

export type Dashboard = {
  today: string;
  dueToday: ApplicationDTO[];
  overdue: ApplicationDTO[];
  noResponse: (ApplicationDTO & { daysWaiting: number })[];
  upcomingDeadlines: ApplicationDTO[];
  counts: Record<Status, number>;
  total: number;
  hasProfile: boolean;
};

export async function getDashboard(): Promise<Dashboard> {
  const [apps, profile] = await Promise.all([listApplications(), db.profile.findUnique({ where: { id: "me" }, select: { id: true } })]);
  const today = todayStr();
  const open = apps.filter((a) => a.status !== "Rejected" && a.status !== "Offer");
  const in14 = addDays(today, 14);
  const daysSince = (d: string) => daysBetween(d, today);
  const counts = { Saved: 0, Applied: 0, Interviewing: 0, Offer: 0, Rejected: 0 } as Record<Status, number>;
  apps.forEach((a) => counts[a.status]++);
  return {
    today,
    dueToday: open.filter((a) => a.followUpDate === today),
    overdue: open.filter((a) => a.followUpDate && a.followUpDate < today).sort((a, b) => a.followUpDate.localeCompare(b.followUpDate)),
    noResponse: apps
      .filter((a) => a.status === "Applied" && a.appliedAt && !a.lastResponseAt && daysSince(a.appliedAt) >= 7)
      .map((a) => ({ ...a, daysWaiting: daysSince(a.appliedAt) }))
      .sort((a, b) => b.daysWaiting - a.daysWaiting),
    upcomingDeadlines: apps
      .filter((a) => a.status === "Saved" && a.deadline && a.deadline >= today && a.deadline <= in14)
      .sort((a, b) => a.deadline.localeCompare(b.deadline)),
    counts,
    total: apps.length,
    hasProfile: Boolean(profile),
  };
}
