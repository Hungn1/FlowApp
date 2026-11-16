import { z } from "zod";

// Shape used for AI parsing, the editor form, and the save API.
const str = (max = 300) => z.string().trim().max(max);
const optId = z.string().optional();

export const ExperienceInput = z.object({
  id: optId,
  company: str(150).min(1, "Company is required"),
  title: str(150).min(1, "Title is required"),
  location: str(150),
  start: str(40),
  end: str(40),
  isTechRole: z.boolean(),
  bullets: z.array(str(600)).max(20),
});

export const SkillInput = z.object({
  id: optId,
  name: str(80).min(1, "Skill name is required"),
  category: z.enum(["tool", "technical", "soft", "design"]),
});

export const EducationInput = z.object({
  id: optId,
  school: str(150).min(1, "School is required"),
  degree: str(150),
  field: str(150),
  start: str(40),
  end: str(40),
  coursework: z.array(str(150)).max(30),
});

export const CertificationInput = z.object({
  id: optId,
  name: str(150).min(1, "Certification name is required"),
  issuer: str(150),
  issued: str(40),
  expires: str(40),
  credentialUrl: str(500),
  inProgress: z.boolean(),
});

export const ProjectInput = z.object({
  id: optId,
  name: str(150).min(1, "Project name is required"),
  type: z.enum(["case-study", "lab", "personal", "course"]),
  description: str(1000),
  bullets: z.array(str(600)).max(20),
  tools: z.array(str(80)).max(30),
  url: str(500),
});

export const ContactInput = z.object({
  name: str(120).min(1, "Your name is required"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  phone: str(40),
  location: str(120),
  headline: str(200),
  linkedin: str(300),
  github: str(300),
  portfolio: str(300),
  otherLinks: z.array(str(300)).max(10),
});

export const ProfileInput = z.object({
  contact: ContactInput,
  experiences: z.array(ExperienceInput).max(30),
  skills: z.array(SkillInput).max(150),
  educations: z.array(EducationInput).max(10),
  certifications: z.array(CertificationInput).max(30),
  projects: z.array(ProjectInput).max(30),
  rawResumeText: z.string().max(60000).optional(),
});

export type ProfileInputT = z.infer<typeof ProfileInput>;

// The AI schema: same shape but lenient (no min lengths), no ids.
export const ParsedResumeSchema = z.object({
  contact: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    headline: z.string().describe("A short professional headline if the resume has one, else empty"),
    linkedin: z.string(),
    github: z.string(),
    portfolio: z.string().describe("Portfolio / Behance / Dribbble / personal site URL"),
    otherLinks: z.array(z.string()),
  }),
  experiences: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      location: z.string(),
      start: z.string().describe("As written, e.g. 'Jun 2023'"),
      end: z.string().describe("As written, or 'Present'"),
      isTechRole: z.boolean().describe("True if the role is IT, software, design, or security work"),
      bullets: z.array(z.string()).describe("Bullet points copied verbatim"),
    })
  ),
  skills: z.array(
    z.object({ name: z.string(), category: z.enum(["tool", "technical", "soft", "design"]) })
  ),
  educations: z.array(
    z.object({
      school: z.string(),
      degree: z.string(),
      field: z.string(),
      start: z.string(),
      end: z.string(),
      coursework: z.array(z.string()),
    })
  ),
  certifications: z.array(
    z.object({
      name: z.string(),
      issuer: z.string(),
      issued: z.string(),
      expires: z.string(),
      credentialUrl: z.string(),
      inProgress: z.boolean(),
    })
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["case-study", "lab", "personal", "course"]),
      description: z.string(),
      bullets: z.array(z.string()),
      tools: z.array(z.string()),
      url: z.string(),
    })
  ),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;

export function emptyProfile(): ProfileInputT {
  return {
    contact: { name: "", email: "", phone: "", location: "", headline: "", linkedin: "", github: "", portfolio: "", otherLinks: [] },
    experiences: [],
    skills: [],
    educations: [],
    certifications: [],
    projects: [],
  };
}
