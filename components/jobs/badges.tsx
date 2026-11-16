import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VERDICT_LABEL, type Verdict } from "@/lib/jobs/entry-level";

export function VerdictBadge({ verdict, fake }: { verdict: Verdict; fake?: boolean }) {
  if (fake)
    return (
      <Badge variant="danger" title="Labeled entry-level, but the requirements say otherwise">
        <AlertTriangle className="h-3 w-3" /> Fake entry-level
      </Badge>
    );
  const variant = verdict === "true" ? "success" : verdict === "stretch" ? "warning" : "danger";
  return <Badge variant={variant}>{VERDICT_LABEL[verdict]}</Badge>;
}

export function TrackChip({ track }: { track: { name: string; color: string } | null }) {
  if (!track) return <Badge variant="outline">Unassigned</Badge>;
  return (
    <Badge variant="outline" className="gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: track.color }} />
      {track.name}
    </Badge>
  );
}

export function formatPay(min: number | null, max: number | null, period: string) {
  if (min == null && max == null) return "";
  const fmt = (n: number) =>
    period === "hour" ? `$${n % 1 ? n.toFixed(2) : n}` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  const range = min != null && max != null && min !== max ? `${fmt(min)}–${fmt(max)}` : fmt((min ?? max)!);
  return `${range}${period === "hour" ? "/hr" : period === "year" ? "/yr" : ""}`;
}

export const WORK_MODE_LABEL: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  unknown: "Work mode not stated",
};
