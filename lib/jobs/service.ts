import { db } from "@/lib/db";
import { parseList, toJson } from "@/lib/json";
import { checkEntryLevel, type Verdict } from "./entry-level";
import type { JobInputT, Status } from "./schema";

import { dateOnly, toDate } from "@/lib/dates";

export type RequirementDTO = {
  id: string; text: string; kind: "hard" | "nice"; category: JobInputT["requirements"][number]["category"];
  matched: boolean; coveredBy: { type: string; id: string; label: string; why: string }[];
};

export type JobDTO = Omit<JobInputT, "requirements"> & {
  id: string;
  requirements: RequirementDTO[];
  entryLevelVerdict: Verdict;
  entryLevelReasons: string[];
  fakeEntryLevel: boolean;
  track: { id: string; name: string; color: string } | null;
  status: Status;
  appliedAt: string;
  followUpDate: string;
  nextAction: string;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
};

const include = {
  requirements: { orderBy: { order: "asc" as const } },
  track: { select: { id: true, name: true, color: true } },
  application: true,
};

type JobRow = Awaited<ReturnType<typeof db.job.findFirstOrThrow<{ include: typeof include }>>>;

export function toDTO(j: JobRow): JobDTO {
  const reasons = parseList<string>(j.entryLevelReasons);
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    workMode: j.workMode as JobDTO["workMode"],
    payMin: j.payMin,
    payMax: j.payMax,
    payPeriod: j.payPeriod as JobDTO["payPeriod"],
    sourceUrl: j.sourceUrl,
    rawDescription: j.rawDescription,
    minYears: j.minYears,
    maxYears: j.maxYears,
    requiredDegree: j.requiredDegree,
    requiredCerts: parseList(j.requiredCerts),
    deadline: dateOnly(j.deadline),
    labeledEntryLevel: j.labeledEntryLevel,
    trackId: j.trackId,
    track: j.track,
    requirements: j.requirements.map((r) => ({
      id: r.id, text: r.text, kind: r.kind as "hard" | "nice", category: r.category as RequirementDTO["category"],
      matched: r.matched, coveredBy: parseList(r.coveredBy),
    })),
    entryLevelVerdict: j.entryLevelVerdict as Verdict,
    entryLevelReasons: reasons,
    fakeEntryLevel: j.labeledEntryLevel && j.entryLevelVerdict === "not",
    status: (j.application?.status ?? "Saved") as Status,
    appliedAt: dateOnly(j.application?.appliedAt ?? null),
    followUpDate: dateOnly(j.application?.followUpDate ?? null),
    nextAction: j.application?.nextAction ?? "",
    isSample: j.isSample,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

function fields(input: JobInputT) {
  const check = checkEntryLevel(input);
  return {
    title: input.title, company: input.company, location: input.location, workMode: input.workMode,
    payMin: input.payMin != null ? Math.round(input.payMin) : null,
    payMax: input.payMax != null ? Math.round(input.payMax) : null,
    payPeriod: input.payPeriod, sourceUrl: input.sourceUrl, rawDescription: input.rawDescription,
    minYears: input.minYears, maxYears: input.maxYears, requiredDegree: input.requiredDegree,
    requiredCerts: toJson(input.requiredCerts), deadline: toDate(input.deadline),
    labeledEntryLevel: input.labeledEntryLevel, trackId: input.trackId,
    entryLevelVerdict: check.verdict, entryLevelReasons: toJson(check.reasons),
  };
}

export async function createJob(input: JobInputT, opts: { isSample?: boolean } = {}) {
  const job = await db.job.create({
    data: {
      ...fields(input),
      isSample: opts.isSample ?? false,
      requirements: { create: input.requirements.map((r, order) => ({ text: r.text, kind: r.kind, category: r.category, order })) },
      application: { create: { status: "Saved", boardOrder: Date.now() } },
    },
    include,
  });
  return toDTO(job);
}

export async function updateJob(id: string, input: JobInputT) {
  await db.$transaction(async (tx) => {
    await tx.job.update({ where: { id }, data: fields(input) });
    const existing = await tx.requirement.findMany({ where: { jobId: id }, select: { id: true } });
    const keep = new Set(input.requirements.map((r) => r.id).filter(Boolean));
    await tx.requirement.deleteMany({ where: { id: { in: existing.map((e) => e.id).filter((x) => !keep.has(x)) } } });
    for (const [order, r] of input.requirements.entries()) {
      if (r.id && existing.some((e) => e.id === r.id)) {
        await tx.requirement.update({ where: { id: r.id }, data: { text: r.text, kind: r.kind, category: r.category, order } });
      } else {
        await tx.requirement.create({ data: { jobId: id, text: r.text, kind: r.kind, category: r.category, order } });
      }
    }
  });
  return getJob(id);
}

export async function getJob(id: string) {
  const j = await db.job.findUnique({ where: { id }, include });
  return j ? toDTO(j) : null;
}

export async function listJobs() {
  const jobs = await db.job.findMany({ include, orderBy: { createdAt: "desc" } });
  return jobs.map(toDTO);
}
