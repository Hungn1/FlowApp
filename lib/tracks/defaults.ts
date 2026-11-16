import type { SectionKey } from "@/lib/resume/types";

export type Emphasis = "portfolio" | "certs" | "customer" | "general";

export const EMPHASIS_OPTIONS: { value: Emphasis; label: string; hint: string }[] = [
  { value: "portfolio", label: "Portfolio and case studies", hint: "Projects first, design skills up top" },
  { value: "certs", label: "Certifications, labs and tools", hint: "Certs and labs first, tools up top" },
  { value: "customer", label: "Customer-facing and troubleshooting", hint: "Experience first, support tools up top" },
  { value: "general", label: "Balanced", hint: "Experience, projects, skills" },
];

export const SECTION_ORDER: Record<Emphasis, SectionKey[]> = {
  portfolio: ["summary", "projects", "skills", "experience", "education", "certifications"],
  certs: ["summary", "certifications", "skills", "projects", "experience", "education"],
  customer: ["summary", "experience", "skills", "certifications", "projects", "education"],
  general: ["summary", "experience", "projects", "skills", "certifications", "education"],
};

// Words that pull a skill / project toward the top for each emphasis.
export const EMPHASIS_WORDS: Record<Emphasis, RegExp> = {
  portfolio: /figma|sketch|adobe|xd|miro|maze|prototyp|wirefram|user research|usability|\bux\b|\bui\b|design|accessib|wcag|persona|journey|interaction|visual|html|css/i,
  certs: /security|secur|siem|splunk|wireshark|nmap|metasploit|burp|kali|linux|firewall|incident|threat|vulnerab|soc|network|tcp|ids|ips|log|python|bash|powershell|active directory|iam|mfa|tryhackme|ctf|lab|comptia|a\+|ccna|cysa|isc2|gsec/i,
  customer: /help ?desk|support|ticket|servicenow|zendesk|freshdesk|jira|active directory|windows|macos|office|microsoft 365|troubleshoot|hardware|printer|network|customer|de-escalat|communication|patience|listening|password|imaging|remote desktop|comptia|a\+|itil|google it/i,
  general: /./,
};

export type DefaultTrack = {
  name: string;
  slug: string;
  color: string;
  emphasis: Emphasis;
  summary: string;
  keywords: string[];
};

export const DEFAULT_TRACKS: DefaultTrack[] = [
  {
    name: "UX/UI Design",
    slug: "ux-ui",
    color: "#8b5cf6",
    emphasis: "portfolio",
    summary: "Entry-level UX/UI designer who turns user research into clear, accessible prototypes. Portfolio of case studies built in Figma.",
    keywords: ["ux", "ui", "user experience", "product designer", "interaction design", "figma", "wireframe", "prototype", "usability", "user research", "visual design", "design system"],
  },
  {
    name: "Cybersecurity",
    slug: "cybersecurity",
    color: "#ef4444",
    emphasis: "certs",
    summary: "Entry-level security analyst with hands-on lab work in log analysis, network traffic, and incident detection.",
    keywords: ["security", "cybersecurity", "soc", "siem", "incident", "threat", "vulnerability", "splunk", "security+", "penetration", "firewall", "iam", "grc", "analyst"],
  },
  {
    name: "Tech Support",
    slug: "tech-support",
    color: "#0ea5e9",
    emphasis: "customer",
    summary: "Customer-focused IT support technician who resolves hardware, software, and account issues quickly and documents every fix.",
    keywords: ["help desk", "helpdesk", "service desk", "it support", "technical support", "desktop support", "technician", "tier 1", "ticket", "servicenow", "a+", "troubleshoot"],
  },
];

export const TRACK_COLORS = ["#8b5cf6", "#ef4444", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#6366f1", "#14b8a6"];
