import type { ResumeDoc } from "./types";

// A tailored resume = the track's base resume + a list of suggested changes you accept or reject.
// Pure functions, safe in the browser.

export type ChangeStatus = "pending" | "accepted" | "rejected";

export type Change = {
  id: string;
  kind: "summary" | "bullet" | "skills";
  /** For bullets: which experience or project, and which bullet. */
  target?: { type: "experience" | "project"; id: string; index: number };
  label: string;
  before: string;
  after: string;
  /** For skills: the new order as skill ids. */
  skillIds?: string[];
  reason: string;
  /** Set when the text mentions something we couldn't find in your profile. */
  warning?: string;
  status: ChangeStatus;
};

export type TailoredContent = {
  base: ResumeDoc;
  trackName: string;
  source: "ai" | "basic";
  generatedAt: string;
  note?: string;
};

export function applyChanges(base: ResumeDoc, changes: Change[], include: (c: Change) => boolean = (c) => c.status === "accepted"): ResumeDoc {
  const doc: ResumeDoc = structuredClone(base);
  for (const c of changes) {
    if (!include(c)) continue;
    if (c.kind === "summary") {
      doc.summary = c.after;
      if (c.after && !doc.sectionOrder.includes("summary")) doc.sectionOrder = ["summary", ...doc.sectionOrder];
    } else if (c.kind === "bullet" && c.target) {
      const list = c.target.type === "experience" ? doc.experience : doc.projects;
      const item = list.find((x) => x.ref.id === c.target!.id);
      if (item && c.target.index < item.bullets.length) item.bullets[c.target.index] = c.after;
    } else if (c.kind === "skills" && c.skillIds) {
      const order = new Map(c.skillIds.map((id, i) => [id, i]));
      const flat = doc.skills.flatMap((g) => g.skills.map((s) => ({ ...s, label: g.label })));
      flat.sort((a, b) => (order.get(a.ref.id) ?? 999) - (order.get(b.ref.id) ?? 999));
      const groups: ResumeDoc["skills"] = [];
      for (const s of flat) {
        let g = groups.find((x) => x.label === s.label);
        if (!g) groups.push((g = { label: s.label, skills: [] }));
        g.skills.push({ ref: s.ref, name: s.name });
      }
      doc.skills = groups;
    }
  }
  return doc;
}

/** Word-level diff for showing changes. Returns runs marked same / added / removed. */
export type DiffRun = { text: string; op: "same" | "add" | "del" };
export function wordDiff(a: string, b: string): DiffRun[] {
  const x = a.split(/(\s+)/);
  const y = b.split(/(\s+)/);
  const n = x.length;
  const m = y.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffRun[] = [];
  const push = (text: string, op: DiffRun["op"]) => {
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += text;
    else out.push({ text, op });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) push(x[i++], (j++, "same"));
    else if (dp[i + 1][j] >= dp[i][j + 1]) push(x[i++], "del");
    else push(y[j++], "add");
  }
  while (i < n) push(x[i++], "del");
  while (j < m) push(y[j++], "add");
  return out;
}
