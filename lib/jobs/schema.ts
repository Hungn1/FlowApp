import { z } from "zod";

export const WORK_MODES = ["remote", "hybrid", "onsite", "unknown"] as const;
export const REQ_KINDS = ["hard", "nice"] as const;
export const REQ_CATEGORIES = ["skill", "tool", "cert", "degree", "years", "other"] as const;
export const STATUSES = ["Saved", "Applied", "Interviewing", "Offer", "Rejected"] as const;
export type Status = (typeof STATUSES)[number];

export const RequirementInput = z.object({
  id: z.string().optional(),
  text: z.string().trim().min(1, "Requirement can't be empty").max(500),
  kind: z.enum(REQ_KINDS),
  category: z.enum(REQ_CATEGORIES),
});

const optNum = z.number({ message: "Enter a number" }).finite().min(0, "Enter a positive number").nullable();

export const JobInput = z
  .object({
    title: z.string().trim().min(1, "Job title is required").max(200),
    company: z.string().trim().min(1, "Company is required").max(200),
    location: z.string().trim().max(200),
    workMode: z.enum(WORK_MODES),
    payMin: optNum,
    payMax: optNum,
    payPeriod: z.enum(["year", "hour", ""]),
    sourceUrl: z.union([z.literal(""), z.string().trim().url("Enter a full URL starting with http")]),
    rawDescription: z.string().max(60000),
    minYears: z.number({ message: "Enter a number" }).min(0, "Enter 0 or more").max(30, "That seems too high").nullable(),
    maxYears: z.number({ message: "Enter a number" }).min(0, "Enter 0 or more").max(30, "That seems too high").nullable(),
    requiredDegree: z.string().trim().max(200),
    requiredCerts: z.array(z.string().trim().min(1).max(100)).max(20),
    deadline: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")]),
    labeledEntryLevel: z.boolean(),
    trackId: z.string().nullable(),
    requirements: z.array(RequirementInput).max(60),
  })
  .superRefine((v, ctx) => {
    if (v.payMin != null && v.payMax != null && v.payMax < v.payMin)
      ctx.addIssue({ code: "custom", path: ["payMax"], message: "Max pay is lower than min pay" });
    if (v.minYears != null && v.maxYears != null && v.maxYears < v.minYears)
      ctx.addIssue({ code: "custom", path: ["maxYears"], message: "Max years is lower than min years" });
  });

export type JobInputT = z.infer<typeof JobInput>;

// What the AI returns when extracting a posting.
export const JobExtractionSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  workMode: z.enum(WORK_MODES),
  payMin: z.number().nullable().describe("Lower bound in dollars; null if not stated"),
  payMax: z.number().nullable(),
  payPeriod: z.enum(["year", "hour", ""]),
  minYears: z.number().nullable().describe("Minimum years of experience required, null if not stated"),
  maxYears: z.number().nullable(),
  yearsArePreferred: z.boolean().describe("True if the years of experience are listed as preferred / nice-to-have"),
  requiredDegree: z.string().describe("Degree that is REQUIRED, e.g. \"Bachelor's in Computer Science or equivalent experience\"; empty if none or only preferred"),
  requiredCerts: z.array(z.string()).describe("Certifications that are required (not just preferred)"),
  deadline: z.string().describe("Application deadline as YYYY-MM-DD, empty if none"),
  labeledEntryLevel: z.boolean().describe("True if the posting calls itself entry-level, junior, associate, new grad, Level I or Tier 1"),
  requirements: z.array(
    z.object({
      text: z.string().describe("One requirement, short, close to the posting's wording"),
      kind: z.enum(REQ_KINDS).describe("hard = required / must have; nice = preferred / bonus / plus"),
      category: z.enum(REQ_CATEGORIES),
    })
  ),
});
export type JobExtraction = z.infer<typeof JobExtractionSchema>;
