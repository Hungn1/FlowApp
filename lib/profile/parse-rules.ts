import type { ParsedResume } from "./schema";

// Offline fallback parser. Less accurate than AI, but it never invents anything:
// every value it returns is copied from the resume text.

const SECTION_PATTERNS: Record<string, RegExp> = {
  experiences: /^(work |professional |relevant )?(experience|employment|work history)\b/i,
  skills: /^(technical )?skills\b|^tools\b|^technologies\b|^core competencies\b/i,
  educations: /^education\b|^academic/i,
  certifications: /^certifications?\b|^licenses?\b|^certificates?\b/i,
  projects: /^(selected |academic |personal )?projects\b|^case studies\b|^portfolio\b/i,
  summary: /^(professional )?summary\b|^profile\b|^objective\b|^about\b/i,
};

const DATE_RANGE =
  /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4})\s*[-–—to]+\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4}|present|current|now)/i;
const BULLET = /^\s*[•●▪◦\-*–]\s*/;
const URL = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s,;|]*)?)/gi;

const TOOL_WORDS = new Set(
  "figma sketch adobe xd photoshop illustrator miro jira servicenow zendesk freshdesk wireshark nmap splunk metasploit burp kali linux windows macos active directory office 365 microsoft 365 powershell python bash git github sql excel tableau notion confluence slack teams intune azure aws virtualbox vmware okta".split(" ")
);
const DESIGN_WORDS = /figma|prototyp|wirefram|user research|usability|ux|ui|design system|persona|journey|accessibility|wcag|interaction|visual design|typography/i;
const SOFT_WORDS = /communication|teamwork|empathy|customer service|problem.solving|leadership|time management|collaboration|adaptab|patience|active listening|de-escalat/i;

function splitSections(lines: string[]) {
  const sections: Record<string, string[]> = { header: [] };
  let current = "header";
  for (const line of lines) {
    const clean = line.replace(/[:\s]+$/, "").trim();
    const isHeading =
      clean.length > 0 &&
      !/:\s*\S/.test(clean) &&
      clean.split(/\s+/).length <= 4 &&
      clean.length < 40 &&
      Object.entries(SECTION_PATTERNS).find(([, re]) => re.test(clean));
    if (isHeading) {
      current = isHeading[0];
      sections[current] ??= [];
      continue;
    }
    (sections[current] ??= []).push(line);
  }
  return sections;
}

function blocks(lines: string[]): string[][] {
  // A new block starts at a non-bullet line that contains a date range, or after a blank line.
  const out: string[][] = [];
  let cur: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (cur.length) out.push(cur);
      cur = [];
      continue;
    }
    if (!BULLET.test(line) && DATE_RANGE.test(line) && cur.some((l) => BULLET.test(l))) {
      out.push(cur);
      cur = [];
    }
    cur.push(line);
  }
  if (cur.length) out.push(cur);
  return out;
}

function splitList(lines: string[]): string[] {
  return lines
    .flatMap((l) => l.replace(BULLET, "").replace(/^[A-Za-z /&]+:\s*/, "").split(/[,;|•·]/))
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 60);
}

function categorize(name: string): ParsedResume["skills"][number]["category"] {
  const n = name.toLowerCase();
  if (TOOL_WORDS.has(n) || [...TOOL_WORDS].some((t) => n.includes(t))) return "tool";
  if (DESIGN_WORDS.test(n)) return "design";
  if (SOFT_WORDS.test(n)) return "soft";
  return "technical";
}

const TECH_TITLE = /it |help ?desk|support|technician|developer|engineer|design|ux|ui|security|analyst|soc|network|system|software|data/i;

export function parseResumeWithRules(text: string): ParsedResume {
  const lines = text.replace(/\r/g, "").split("\n");
  const s = splitSections(lines);
  const all = text;

  const email = all.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? "";
  const phone = all.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] ?? "";
  const urls = [...(s.header ?? []).join(" ").matchAll(URL)].map((m) => m[1]).filter((u) => !u.includes("@") && !email.includes(u));
  const linkedin = urls.find((u) => /linkedin/i.test(u)) ?? "";
  const github = urls.find((u) => /github/i.test(u)) ?? "";
  const portfolio = urls.find((u) => /behance|dribbble|portfolio|\.design|\.me|\.io|wixsite|squarespace|notion\.site/i.test(u) && u !== github) ?? "";
  const otherLinks = urls.filter((u) => ![linkedin, github, portfolio].includes(u));
  const headerLines = (s.header ?? []).map((l) => l.trim()).filter(Boolean);
  const name = headerLines[0]?.split(/[|•]/)[0].trim() ?? "";
  const location =
    headerLines.join(" | ").match(/\b([A-Z][a-zA-Z.\s]+,\s*[A-Z]{2})\b/)?.[1]?.trim() ?? "";

  const experiences = blocks(s.experiences ?? []).map((b) => {
    const head = b.filter((l) => !BULLET.test(l));
    const bullets = b.filter((l) => BULLET.test(l)).map((l) => l.replace(BULLET, "").trim());
    const dateLine = head.find((l) => DATE_RANGE.test(l)) ?? "";
    const m = dateLine.match(DATE_RANGE);
    const headText = head.map((l) => l.replace(DATE_RANGE, "").replace(/[|,–—-]\s*$/, "").trim()).filter(Boolean);
    const [first = "", second = ""] = headText;
    const parts = first.split(/\s+[|@–—-]\s+|\s+at\s+|,\s+/);
    const title = parts[0] ?? first;
    const company = parts[1] ?? second;
    return {
      company: company || second || "",
      title,
      location: "",
      start: m?.[1] ?? "",
      end: m?.[2] ? m[2].replace(/current|now/i, "Present") : "",
      isTechRole: TECH_TITLE.test(title),
      bullets,
    };
  }).filter((e) => e.title || e.company);

  const skills = Array.from(new Set(splitList(s.skills ?? []))).map((n) => ({ name: n, category: categorize(n) }));

  const educations = blocks(s.educations ?? []).map((b) => {
    const m = b.join(" ").match(DATE_RANGE);
    const year = b.join(" ").match(/\b(19|20)\d{2}\b/g) ?? [];
    const degreeLine = b.find((l) => /bachelor|master|associate|b\.?s\.?|b\.?a\.?|m\.?s\.?|diploma|certificate|degree/i.test(l)) ?? "";
    const coursework = b.filter((l) => /coursework/i.test(l)).flatMap((l) => l.split(/:/)[1]?.split(/[,;]/) ?? []).map((x) => x.trim()).filter(Boolean);
    return {
      school: b[0].replace(DATE_RANGE, "").trim(),
      degree: degreeLine.split(/,| in /i)[0]?.replace(DATE_RANGE, "").trim() ?? "",
      field: degreeLine.match(/ in ([^,|]+)/i)?.[1]?.trim() ?? "",
      start: m?.[1] ?? "",
      end: m?.[2] ?? year[year.length - 1] ?? "",
      coursework,
    };
  });

  const certifications = (s.certifications ?? [])
    .map((l) => l.replace(BULLET, "").trim())
    .filter(Boolean)
    .map((l) => {
      const inProgress = /in progress|expected|pursuing|studying/i.test(l);
      const year = l.match(/\b(19|20)\d{2}\b/)?.[0] ?? "";
      const [nm, issuer = ""] = l.replace(/\(.*?\)/g, "").split(/\s+[–—-]\s+|,\s+|\s+\|\s+/);
      return { name: nm.trim(), issuer: issuer.replace(/\b(19|20)\d{2}\b/, "").trim(), issued: year, expires: "", credentialUrl: "", inProgress };
    });

  const projects = blocks(s.projects ?? []).map((b) => {
    const head = b.filter((l) => !BULLET.test(l));
    const bullets = b.filter((l) => BULLET.test(l)).map((l) => l.replace(BULLET, "").trim());
    const title = (head[0] ?? bullets[0] ?? "").replace(DATE_RANGE, "").trim();
    const url = b.join(" ").match(URL)?.[0] ?? "";
    const toolsLine = b.find((l) => /tools|tech|stack|built with/i.test(l)) ?? "";
    const blob = b.join(" ").toLowerCase();
    const type: ParsedResume["projects"][number]["type"] = /case study|ux|usability|redesign|prototype/.test(blob)
      ? "case-study"
      : /lab|tryhackme|hack the box|ctf|home ?lab|siem|wireshark/.test(blob)
      ? "lab"
      : /course|class|capstone/.test(blob)
      ? "course"
      : "personal";
    return {
      name: title.split(/\s+[|–—-]\s+/)[0],
      type,
      description: head.slice(1).filter((l) => l !== toolsLine).join(" "),
      bullets,
      tools: toolsLine ? toolsLine.split(/:/).slice(1).join(":").split(/[,;]/).map((t) => t.trim()).filter(Boolean) : [],
      url,
    };
  }).filter((p) => p.name);

  return {
    contact: { name, email, phone, location, headline: (s.summary ?? []).join(" ").trim().slice(0, 200), linkedin, github, portfolio, otherLinks },
    experiences,
    skills,
    educations,
    certifications,
    projects,
  };
}
