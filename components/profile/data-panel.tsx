"use client";
import { useState } from "react";
import { Database, Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/states";
import { api } from "@/lib/api-client";

export function DataPanel({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<null | "delete" | "sample">(null);
  const [error, setError] = useState<string | null>(null);

  async function deleteAll() {
    setBusy("delete");
    setError(null);
    try {
      await api("/api/data", { method: "DELETE", json: { confirm } });
      toast.success("All data deleted");
      setOpen(false);
      setConfirm("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setBusy(null);
    }
  }

  async function loadSample() {
    setBusy("sample");
    setError(null);
    try {
      const r = await api<{ added: string[] }>("/api/data/sample", { method: "POST" });
      toast.success(r.added.length ? `Added sample ${r.added.join(", ")}` : "Sample data is already loaded");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load sample data.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your data</CardTitle>
        <CardDescription>Everything lives in one local file on your computer (prisma/applyflow.db). Nothing is uploaded except the text sent to the AI.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/api/data/export" download>
              <Download /> Export all (JSON)
            </a>
          </Button>
          <Button variant="outline" onClick={loadSample} disabled={busy !== null}>
            {busy === "sample" ? <Loader2 className="animate-spin" /> : <Database />} Load sample data
          </Button>
          <Button variant="destructive" onClick={() => setOpen(true)} disabled={busy !== null}>
            <Trash2 /> Delete all
          </Button>
        </div>
        {error && !open && <ErrorState message={error} />}
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setConfirm(""); setError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete everything?</DialogTitle>
            <DialogDescription>
              This permanently removes your profile, tracks, jobs, applications, tailored materials and notes. Export first if you might want them back.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor="confirm-delete" className="text-sm">Type <strong>DELETE</strong> to confirm</label>
            <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </div>
          {error && <ErrorState message={error} onRetry={deleteAll} />}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={confirm !== "DELETE" || busy === "delete"} onClick={deleteAll}>
              {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete all data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
