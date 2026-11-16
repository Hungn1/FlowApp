import { z } from "zod";
import { db } from "@/lib/db";
import { handle, ok, readBody } from "@/lib/api-server";

const Body = z.object({ confirm: z.literal("DELETE", { message: 'Type DELETE to confirm' }) });

// Permanently deletes every row in the local database. Sample data is not re-added
// automatically; use "Load sample data" on the Profile page if you want it back.
export const DELETE = handle(async (req: Request) => {
  await readBody(req, Body);
  await db.$transaction([
    db.interviewQuestion.deleteMany(),
    db.material.deleteMany(),
    db.contact.deleteMany(),
    db.application.deleteMany(),
    db.requirement.deleteMany(),
    db.job.deleteMany(),
    db.trackItem.deleteMany(),
    db.track.deleteMany(),
    db.experience.deleteMany(),
    db.skill.deleteMany(),
    db.education.deleteMany(),
    db.certification.deleteMany(),
    db.project.deleteMany(),
    db.profile.deleteMany(),
  ]);
  return ok({ deleted: true });
});
