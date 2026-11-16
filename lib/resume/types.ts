// A resume as structured data. Used for track base resumes, tailored resumes, and export.
// Every entry keeps a `ref` back to the profile item it came from, so nothing can appear
// that isn't in the master profile.

export type ItemType = "experience" | "skill" | "education" | "cert" | "project";
export type Ref = { type: ItemType; id: string };

export type ResumeExperience = { ref: Ref; title: string; company: string; location: string; dates: string; bullets: string[] };
export type ResumeProject = { ref: Ref; name: string; kind: string; description: string; bullets: string[]; tools: string[]; url: string };
export type ResumeEducation = { ref: Ref; school: string; degree: string; dates: string; coursework: string[] };
export type ResumeCert = { ref: Ref; name: string; issuer: string; date: string; inProgress: boolean };
export type ResumeSkillGroup = { label: string; skills: { ref: Ref; name: string }[] };

export type SectionKey = "summary" | "experience" | "projects" | "skills" | "certifications" | "education";

export type ResumeDoc = {
  header: { name: string; email: string; phone: string; location: string; links: string[] };
  summary: string;
  sectionOrder: SectionKey[];
  experience: ResumeExperience[];
  projects: ResumeProject[];
  skills: ResumeSkillGroup[];
  certifications: ResumeCert[];
  education: ResumeEducation[];
};

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  certifications: "Certifications",
  education: "Education",
};
