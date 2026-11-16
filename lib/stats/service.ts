import { db } from "@/lib/db";
import { addDays, todayStr } from "@/lib/dates";
import { listApplications } from "@/lib/applications/service";
import { listJobs } from "@/lib/jobs/service";
import { normalize } from "@/lib/match/corpus";
import { analyzeMatchRules } from "@/lib/match/rules";
import type { MatchResult } from "@/lib/match/types";
import { getProfile } from "@/lib/profile/service";
import { listTracks } from "@/lib/tracks/service";

// Stats by track, applications per week, and skill gaps ranked by how many jobs ask for them.

export type TrackStats = {
  id: string | null;
  name: string;
  color: string;
  jobs: number;
  applied: number;
  responses: number;
  interviews: number;
  offers: number;
  rejected: number;
  responseRate: number | null;
  interviewRate: number | null;
  avgMatch: number | null;
  fakeEntryLevel: number;
};

export type Stats = {
  tracks: TrackStats[];
  total: TrackStats;
  weeks: { start: string; count: number; byTrack: Record<string, number> }[];
};

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);

/** Monday of the week containing the date, as YYYY-MM-DD. */
function weekStart(s: string) {
  const d = new Date(`${s}T12:00:00`);
  const back = (d.getDay() + 6) % 7;
  return addDays(s, -back);
}

export async function getStats(weeksBack = 8): Promise<Stats> {
  const [apps, tracks, scores] = await Promise.all([
    listApplications(),
    listTracks(),
    db.material.findMany({ where: { kind: "match" }, select: { jobId: true, matchScore: true } }),
  ]);
  const score = new Map(scores.map((s) => [s.jobId, s.matchScore]));

  const build = (id: string | null, name: string, color: string, list: typeof apps): TrackStats => {
    const applied = list.filter((a) => a.status !== "Saved" || a.appliedAt);
    const responded = applied.filter((a) => a.lastResponseAt || ["Interviewing", "Offer", "Rejected"].includes(a.status));
    const interviews = applied.filter((a) => ["Interviewing", "Offer"].includes(a.status));
    const matched = list.map((a) => score.get(a.jobId)).filter((s): s is number => s != null);
    return {
      id, name, color,
      jobs: list.length,
      applied: applied.length,
      responses: responded.length,
      interviews: interviews.length,
      offers: list.filter((a) => a.status === "Offer").length,
      rejected: list.filter((a) => a.status === "Rejected").length,
      responseRate: pct(responded.length, applied.length),
      interviewRate: pct(interviews.length, applied.length),
      avgMatch: matched.length ? Math.round(matched.reduce((a, b) => a + b, 0) / matched.length) : null,
      fakeEntryLevel: list.filter((a) => a.fakeEntryLevel).length,
    };
  };

  const rows = tracks.map((t) => build(t.id, t.name, t.color, apps.filter((a) => a.track?.id === t.id)));
  const none = apps.filter((a) => !a.track);
  if (none.length) rows.push(build(null, "No track", "#9ca3af", none));

  const thisWeek = weekStart(todayStr());
  const weeks = Array.from({ length: weeksBack }, (_, i) => ({ start: addDays(thisWeek, -7 * (weeksBack - 1 - i)), count: 0, byTrack: {} as Record<string, number> }));
  for (const a of apps) {
    if (!a.appliedAt) continue;
    const w = weeks.find((x) => x.start === weekStart(a.appliedAt));
    if (!w) continue;
    w.count++;
    const k = a.track?.id ?? "none";
    w.byTrack[k] = (w.byTrack[k] ?? 0) + 1;
  }

  return { tracks: rows, total: build("all", "All tracks", "", apps), weeks };
}

export type SkillGap = { term: string; count: number; jobs: { id: string; title: string; company: string }[] };

/**
 * Skills, tools and certs that jobs in this track ask for and your profile lacks, most common first.
 * Uses each job's saved match analysis when it's current, otherwise the basic analysis.
 */
export async function getSkillGaps(trackId: string): Promise<{ jobs: number; gaps: SkillGap[]; hasProfile: boolean }> {
  const [jobs, profile, materials] = await Promise.all([listJobs(), getProfile(), db.material.findMany({ where: { kind: "match" } })]);
  const inTrack = jobs.filter((j) => j.trackId === trackId);
  if (!profile.exists) return { jobs: inTrack.length, gaps: [], hasProfile: false };
  const stored = new Map(materials.map((m) => [m.jobId, JSON.parse(m.content) as MatchResult & { basis?: string }]));

  const gaps = new Map<string, SkillGap>();
  for (const j of inTrack) {
    const s = stored.get(j.id);
    const fresh = s && s.basis === `${profile.updatedAt ?? ""}|${j.updatedAt}`;
    const missing = fresh ? s.missingKeywords : analyzeMatchRules(j, profile).missingKeywords;
    const seen = new Set<string>();
    for (const term of missing) {
      const key = normalize(term).trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const g = gaps.get(key) ?? { term, count: 0, jobs: [] };
      g.count++;
      g.jobs.push({ id: j.id, title: j.title, company: j.company });
      gaps.set(key, g);
    }
  }
  return {
    jobs: inTrack.length,
    hasProfile: true,
    gaps: [...gaps.values()].sort((a, b) => b.count - a.count || a.term.localeCompare(b.term)).slice(0, 15),
  };
}
