"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { VerdictBadge } from "@/components/jobs/badges";
import { STATUSES, type Status } from "@/lib/jobs/schema";
import type { ApplicationDTO } from "@/lib/applications/service";
import type { Verdict } from "@/lib/jobs/entry-level";
import { todayStr } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Key = "company" | "title" | "track" | "status" | "appliedAt" | "followUpDate" | "nextAction" | "verdict";
const COLS: { key: Key; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "title", label: "Role" },
  { key: "track", label: "Track" },
  { key: "status", label: "Status" },
  { key: "appliedAt", label: "Applied" },
  { key: "followUpDate", label: "Follow-up" },
  { key: "nextAction", label: "Next action" },
  { key: "verdict", label: "Entry-level" },
];

const value = (a: ApplicationDTO, k: Key): string | number => {
  switch (k) {
    case "track": return a.track?.name ?? "~";
    case "status": return STATUSES.indexOf(a.status);
    case "verdict": return ["true", "stretch", "not"].indexOf(a.verdict);
    default: return (a[k] as string) || "~"; // "~" sorts empty values last
  }
};

export function TrackerTable({ apps, onStatus }: { apps: ApplicationDTO[]; onStatus: (jobId: string, s: Status) => void }) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "followUpDate", dir: 1 });
  const rows = useMemo(
    () => [...apps].sort((a, b) => {
      const va = value(a, sort.key);
      const vb = value(b, sort.key);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    }),
    [apps, sort]
  );
  const today = todayStr();

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            {COLS.map((c) => {
              const active = sort.key === c.key;
              return (
                <th key={c.key} className="px-3 py-2 font-medium" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : 1 }))}
                  >
                    {c.label}
                    {active ? (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const overdue = a.followUpDate && a.followUpDate < today && a.status !== "Rejected" && a.status !== "Offer";
            return (
              <tr key={a.jobId} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 font-medium"><Link href={`/jobs/${a.jobId}`} className="hover:underline">{a.company}</Link></td>
                <td className="px-3 py-2">{a.title}</td>
                <td className="px-3 py-2">
                  {a.track ? (
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: a.track.color }} />{a.track.name}</span>
                  ) : <span className="text-muted-foreground">Unassigned</span>}
                </td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`Status for ${a.company}`}
                    className="rounded border border-input bg-background px-1 py-0.5"
                    value={a.status}
                    onChange={(e) => onStatus(a.jobId, e.target.value as Status)}
                  >
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{a.appliedAt || "—"}</td>
                <td className={cn("px-3 py-2", overdue ? "text-destructive" : "text-muted-foreground")}>{a.followUpDate || "—"}</td>
                <td className="max-w-56 truncate px-3 py-2 text-muted-foreground">{a.nextAction || "—"}</td>
                <td className="px-3 py-2"><VerdictBadge verdict={a.verdict as Verdict} fake={a.fakeEntryLevel} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
