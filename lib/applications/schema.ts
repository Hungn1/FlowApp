import { z } from "zod";
import { STATUSES } from "@/lib/jobs/schema";

const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")]);

export const ApplicationPatch = z.object({
  status: z.enum(STATUSES).optional(),
  boardOrder: z.number().finite().optional(),
  appliedAt: date.optional(),
  followUpDate: date.optional(),
  lastResponseAt: date.optional(),
  nextAction: z.string().trim().max(200, "Keep it under 200 characters").optional(),
  notes: z.string().max(20000, "Notes are too long").optional(),
});

export const ContactInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  role: z.string().trim().max(120),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  linkedin: z.string().trim().max(300),
  notes: z.string().max(2000),
});
