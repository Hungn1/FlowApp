// Shapes shared by the match analysis on the server and the Match tab in the browser.

/** unknown = something a resume can't show (shifts, driver's license). Left out of the score. */
export type Met = "yes" | "partial" | "no" | "unknown";
export type Source = "ai" | "basic";
export type CoveredBy = { type: string; id: string; label: string; why: string };

export type RequirementResult = {
  requirementId: string;
  text: string;
  kind: "hard" | "nice";
  met: Met;
  evidence: string;
  coveredBy: CoveredBy[];
};

export type MatchResult = {
  score: number;
  summary: string;
  requirements: RequirementResult[];
  missingKeywords: string[];
  transferable: { requirementId: string; suggestion: string }[];
  source: Source;
  generatedAt: string;
  /** True when the profile or job changed after this analysis was made. */
  stale: boolean;
};

/** Hard requirements count double. Met = full credit, partial = half. */
export function computeScore(reqs: Pick<RequirementResult, "kind" | "met">[]): number {
  if (!reqs.length) return 0;
  let got = 0;
  let total = 0;
  for (const r of reqs) {
    if (r.met === "unknown") continue;
    const w = r.kind === "hard" ? 2 : 1;
    total += w;
    got += r.met === "yes" ? w : r.met === "partial" ? w / 2 : 0;
  }
  return total ? Math.round((got / total) * 100) : 0;
}
