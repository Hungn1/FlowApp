"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, KeyRound, RotateCw, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";

export type Mode = "auto" | "basic";

let statusCache: { configured: boolean; model: string } | null = null;
export function useAiStatus() {
  const [status, setStatus] = useState(statusCache);
  useEffect(() => {
    if (statusCache) return;
    api<{ configured: boolean; model: string }>("/api/ai/status")
      .then((s) => setStatus((statusCache = s)))
      .catch(() => setStatus({ configured: false, model: "" }));
  }, []);
  return status;
}

/** Load a saved result (GET) and (re)generate it (POST {mode}). */
export function useGenerated<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<{ message: string; mode: Mode; needsProfile: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setData(await api<T | null>(url));
      setLoaded(true);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load.");
    }
  }, [url]);
  useEffect(() => {
    load();
  }, [load]);

  const generate = useCallback(
    async (mode: Mode = "auto") => {
      setGenerating(true);
      setGenError(null);
      try {
        setData(await api<T>(url, { method: "POST", json: { mode } }));
        return true;
      } catch (e) {
        setGenError({ message: e instanceof Error ? e.message : "Something went wrong.", mode, needsProfile: e instanceof ApiError && e.status === 409 });
        return false;
      } finally {
        setGenerating(false);
      }
    },
    [url]
  );

  return { data, setData, loaded, loadError, load, generate, generating, genError };
}

export function SourceBadge({ source }: { source: string }) {
  if (source === "ai") return <Badge variant="secondary"><Sparkles className="h-3 w-3" /> AI</Badge>;
  if (source === "basic") return <Badge variant="outline">Basic (no AI)</Badge>;
  return <Badge variant="outline">Edited by you</Badge>;
}

export function AiSetupNote({ what }: { what: string }) {
  const status = useAiStatus();
  if (!status || status.configured) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
      <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        AI isn&apos;t set up, so {what} uses the basic version. To turn on AI, add <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY=…</code> to{" "}
        <code className="rounded bg-muted px-1">.env.local</code> in the project folder and restart <code className="rounded bg-muted px-1">npm run dev</code>.
      </span>
    </div>
  );
}

export function GenerateError({ error, onRetry, onBasic }: { error: { message: string; mode: Mode; needsProfile: boolean }; onRetry: () => void; onBasic: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <span>{error.message}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {error.needsProfile ? (
          <Button asChild size="sm"><Link href="/profile">Go to Profile</Link></Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={onRetry}><RotateCw /> Retry</Button>
            {error.mode === "auto" && <Button variant="ghost" size="sm" onClick={onBasic}><Wand2 /> Use the basic version instead</Button>}
          </>
        )}
      </div>
    </div>
  );
}

export function StaleNote({ what, onRedo, busy }: { what: string; onRedo: () => void; busy: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/30">
      <span>Your profile or this job changed after this {what} was made.</span>
      <Button size="sm" variant="outline" onClick={onRedo} disabled={busy}><RotateCw /> Redo it</Button>
    </div>
  );
}

export const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
