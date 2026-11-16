import { db } from "@/lib/db";
import { handle } from "@/lib/api-server";

// Everything in the local database as one JSON file.
export const GET = handle(async () => {
  const [profile, tracks, jobs] = await Promise.all([
    db.profile.findUnique({
      where: { id: "me" },
      include: { experiences: true, skills: true, educations: true, certifications: true, projects: true },
    }),
    db.track.findMany({ include: { items: true } }),
    db.job.findMany({
      include: { requirements: true, application: { include: { contacts: true } }, materials: true, interviewQuestions: true },
    }),
  ]);
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), app: "ApplyFlow", version: 1, profile, tracks, jobs }, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="applyflow-export-${date}.json"`,
    },
  });
});
