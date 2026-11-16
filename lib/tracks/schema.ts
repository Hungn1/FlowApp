import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color");
const emphasis = z.enum(["portfolio", "certs", "customer", "general"]);

export const TrackCreate = z.object({
  name: z.string().trim().min(1, "Name is required").max(60, "Keep it under 60 characters"),
  color: hex,
  emphasis,
});

export const TrackUpdate = z.object({
  name: z.string().trim().min(1, "Name is required").max(60, "Keep it under 60 characters").optional(),
  color: hex.optional(),
  emphasis: emphasis.optional(),
  summary: z.string().trim().max(400, "Keep the summary under 400 characters").optional(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
});

export const TrackItemsUpdate = z.object({
  items: z
    .array(
      z.object({
        itemType: z.enum(["experience", "skill", "education", "cert", "project"]),
        itemId: z.string().min(1),
        order: z.number().int().min(0),
        featured: z.boolean(),
        hidden: z.boolean(),
      })
    )
    .max(500),
});
