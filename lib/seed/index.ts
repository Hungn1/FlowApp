import { db } from "@/lib/db";
import { extractJobWithRules } from "@/lib/jobs/extract-rules";
import { createJob } from "@/lib/jobs/service";
import { saveProfile } from "@/lib/profile/service";
import { ensureDefaultTracks, syncTracksWithProfile } from "@/lib/tracks/service";
import { SAMPLE_JOBS } from "./sample-jobs";
import { SAMPLE_PROFILE } from "./sample-profile";

import { addDays, toDate, todayStr } from "@/lib/dates";

const daysAgo = (n: number) => toDate(addDays(todayStr(), -n))!;
const daysFromNow = (n: number) => toDate(addDays(todayStr(), n))!;

// Adds whatever sample data is missing. Never overwrites your own data.
export async function seedSample(): Promise<string[]> {
  const added: string[] = [];
  const profile = await db.profile.findUnique({ where: { id: "me" } });
  if (!profile) {
    await saveProfile(SAMPLE_PROFILE, { isSample: true });
    added.push("profile");
  }
  if ((await ensureDefaultTracks()) > 0) added.push("tracks");
  await syncTracksWithProfile();

  if ((await db.job.count()) === 0) {
    const tracks = await db.track.findMany();
    for (const s of SAMPLE_JOBS) {
      const ex = extractJobWithRules(s.description);
      const job = await createJob(
        {
          ...ex,
          sourceUrl: s.sourceUrl,
          rawDescription: s.description,
          trackId: tracks.find((t) => t.slug === s.trackSlug)?.id ?? null,
          requirements: ex.requirements,
        },
        { isSample: true }
      );
      await db.job.update({
        where: { id: job.id },
        data: { createdAt: daysAgo(s.daysAgo), ...(s.deadlineInDays != null ? { deadline: daysFromNow(s.deadlineInDays) } : {}) },
      });
      await db.application.update({
        where: { jobId: job.id },
        data: {
          status: s.status,
          appliedAt: s.appliedDaysAgo != null ? daysAgo(s.appliedDaysAgo) : null,
          nextAction:
            s.status === "Interviewing" ? "Prepare for phone screen" : s.status === "Applied" ? "Follow up with the recruiter" : "Tailor resume and apply",
          followUpDate: s.status === "Interviewing" ? daysFromNow(2) : s.status === "Applied" ? daysAgo(0) : null,
          lastResponseAt: s.status === "Interviewing" ? daysAgo(6) : null,
        },
      });
    }
    added.push("jobs");
  }
  return added;
}
