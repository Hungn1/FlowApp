"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Save, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, ListSkeleton } from "@/components/states";
import { api, ApiError } from "@/lib/api-client";
import type { ApplicationDTO, ContactDTO } from "@/lib/applications/service";
import { addDays, todayStr } from "@/lib/dates";
import { STATUSES, type Status } from "@/lib/jobs/schema";

type Form = Pick<ApplicationDTO, "status" | "appliedAt" | "followUpDate" | "lastResponseAt" | "nextAction" | "notes">;

export function ApplicationTab({ jobId, onStatusChange }: { jobId: string; onStatusChange?: (s: Status) => void }) {
  const [app, setApp] = useState<ApplicationDTO | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const apply = (a: ApplicationDTO) => {
    setApp(a);
    setForm({ status: a.status, appliedAt: a.appliedAt, followUpDate: a.followUpDate, lastResponseAt: a.lastResponseAt, nextAction: a.nextAction, notes: a.notes });
  };
  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const a = await api<ApplicationDTO>(`/api/applications/${jobId}`);
      // Don't clobber edits if a second load lands after you started typing.
      setApp((prev) => {
        if (!prev) setForm({ status: a.status, appliedAt: a.appliedAt, followUpDate: a.followUpDate, lastResponseAt: a.lastResponseAt, nextAction: a.nextAction, notes: a.notes });
        return prev ?? a;
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load the application.");
    }
  }, [jobId]);
  useEffect(() => {
    load();
  }, [load]);

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;
  if (!app || !form) return <ListSkeleton rows={3} />;

  const dirty = (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== app[k]);
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  async function save() {
    if (!form || !app) return;
    setSaving(true);
    setSaveError(null);
    setErrors({});
    try {
      // Send only changed fields so the server can fill in implied dates on a status change.
      const patch = Object.fromEntries((Object.keys(form) as (keyof Form)[]).filter((k) => form[k] !== app[k]).map((k) => [k, form[k]]));
      const a = await api<ApplicationDTO>(`/api/applications/${jobId}`, { method: "PATCH", json: patch });
      apply(a);
      if (patch.status) onStatusChange?.(a.status);
      toast.success("Application saved");
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        setErrors(e.fieldErrors);
        setSaveError("Some fields need fixing.");
      } else setSaveError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const today = todayStr();
  const quick = (days: number) => set({ followUpDate: addDays(today, days) });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>Application</CardTitle>
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} {dirty ? "Save" : "Saved"}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {saveError && <ErrorState message={saveError} onRetry={save} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <NativeSelect id="status" value={form.status} onChange={(e) => set({ status: e.target.value as Status })}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="appliedAt">Date applied</Label>
              <Input id="appliedAt" type="date" value={form.appliedAt} max={today} onChange={(e) => set({ appliedAt: e.target.value })} aria-invalid={!!errors.appliedAt} />
              {errors.appliedAt && <p className="text-xs text-destructive">{errors.appliedAt[0]}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nextAction">Next action</Label>
              <Input id="nextAction" value={form.nextAction} placeholder="e.g. Email the recruiter" onChange={(e) => set({ nextAction: e.target.value })} aria-invalid={!!errors.nextAction} />
              {errors.nextAction && <p className="text-xs text-destructive">{errors.nextAction[0]}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="followUpDate">Follow-up date</Label>
              <div className="flex gap-1">
                <Input id="followUpDate" type="date" value={form.followUpDate} onChange={(e) => set({ followUpDate: e.target.value })} />
                {form.followUpDate && (
                  <Button variant="ghost" size="icon" aria-label="Clear follow-up date" onClick={() => set({ followUpDate: "" })}><X /></Button>
                )}
              </div>
              <div className="flex gap-1">
                {[3, 7, 14].map((d) => (
                  <Button key={d} variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => quick(d)}>+{d} days</Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastResponseAt">Last heard back</Label>
              <Input id="lastResponseAt" type="date" value={form.lastResponseAt} max={today} onChange={(e) => set({ lastResponseAt: e.target.value })} />
              <p className="text-xs text-muted-foreground">Set this when they reply, so the 7-day no-response flag clears.</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={8} value={form.notes} placeholder="Who you talked to, what they asked, salary discussed…" onChange={(e) => set({ notes: e.target.value })} aria-invalid={!!errors.notes} />
          </div>
        </CardContent>
      </Card>
      <Contacts jobId={jobId} contacts={app.contacts} onChange={(contacts) => setApp({ ...app, contacts })} />
    </div>
  );
}

const EMPTY: Omit<ContactDTO, "id"> = { name: "", role: "", email: "", linkedin: "", notes: "" };

function Contacts({ jobId, contacts, onChange }: { jobId: string; contacts: ContactDTO[]; onChange: (c: ContactDTO[]) => void }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = (c?: ContactDTO) => {
    setEditing(c ? c.id : "new");
    setDraft(c ? { name: c.name, role: c.role, email: c.email, linkedin: c.linkedin, notes: c.notes } : EMPTY);
    setErrors({});
    setError(null);
  };

  async function save() {
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      if (editing === "new") {
        const c = await api<ContactDTO>(`/api/applications/${jobId}/contacts`, { method: "POST", json: draft });
        onChange([...contacts, c]);
      } else {
        const c = await api<ContactDTO>(`/api/contacts/${editing}`, { method: "PUT", json: draft });
        onChange(contacts.map((x) => (x.id === c.id ? c : x)));
      }
      setEditing(null);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrors(e.fieldErrors);
      else setError(e instanceof Error ? e.message : "Couldn't save the contact.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/contacts/${id}`, { method: "DELETE" });
      onChange(contacts.filter((c) => c.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete the contact.");
    }
  }

  return (
    <Card className="self-start">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Contacts</CardTitle>
          <CardDescription className="mt-1">Recruiters, hiring managers, referrals.</CardDescription>
        </div>
        {editing === null && <Button variant="outline" size="sm" onClick={() => start()}><Plus /> Add</Button>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {contacts.length === 0 && editing === null && <p className="text-sm text-muted-foreground">No contacts yet.</p>}
        {contacts.map((c) =>
          editing === c.id ? null : (
            <div key={c.id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name}{c.role && <span className="font-normal text-muted-foreground"> · {c.role}</span>}</p>
                {c.email && <a href={`mailto:${c.email}`} className="block truncate text-xs underline">{c.email}</a>}
                {c.linkedin && <p className="truncate text-xs text-muted-foreground">{c.linkedin}</p>}
                {c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${c.name}`} onClick={() => start(c)}><Pencil /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Delete ${c.name}`} onClick={() => remove(c.id)}><Trash2 /></Button>
            </div>
          )
        )}
        {editing !== null && (
          <div className="flex flex-col gap-2 rounded-md border p-3">
            {(["name", "role", "email", "linkedin"] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1">
                <Label htmlFor={`contact-${k}`} className="text-xs capitalize">{k === "linkedin" ? "LinkedIn" : k}{k === "name" ? " *" : ""}</Label>
                <Input id={`contact-${k}`} className="h-8" value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} aria-invalid={!!errors[k]} />
                {errors[k] && <p className="text-xs text-destructive">{errors[k][0]}</p>}
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <Label htmlFor="contact-notes" className="text-xs">Notes</Label>
              <Textarea id="contact-notes" rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
            {error && <ErrorState message={error} onRetry={save} />}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save contact</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
