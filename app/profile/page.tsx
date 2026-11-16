"use client";
import { useCallback, useEffect, useState } from "react";
import { FileText, Info, Loader2, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/states";
import { ImportPanel, type ParseResult } from "@/components/profile/import-panel";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { DataPanel } from "@/components/profile/data-panel";
import { api, ApiError } from "@/lib/api-client";
import type { ProfileInputT } from "@/lib/profile/schema";
import type { ProfileDTO } from "@/lib/profile/service";

function fromDraft(r: ParseResult, current: ProfileInputT | null): ProfileInputT {
  // Re-importing keeps ids of matching items, so tracks and tailored resumes keep their links.
  const findId = <T extends { id?: string }>(list: T[] | undefined, match: (x: T) => boolean) => list?.find(match)?.id;
  const d = r.draft;
  return {
    rawResumeText: r.text,
    contact: { ...d.contact, otherLinks: d.contact.otherLinks ?? [] },
    experiences: d.experiences.map((e) => ({
      ...e,
      id: findId(current?.experiences, (x) => x.company.toLowerCase() === e.company.toLowerCase() && x.title.toLowerCase() === e.title.toLowerCase()),
    })),
    skills: d.skills.map((s) => ({ ...s, id: findId(current?.skills, (x) => x.name.toLowerCase() === s.name.toLowerCase()) })),
    educations: d.educations.map((e) => ({ ...e, id: findId(current?.educations, (x) => x.school.toLowerCase() === e.school.toLowerCase()) })),
    certifications: d.certifications.map((c) => ({ ...c, id: findId(current?.certifications, (x) => x.name.toLowerCase() === c.name.toLowerCase()) })),
    projects: d.projects.map((p) => ({ ...p, id: findId(current?.projects, (x) => x.name.toLowerCase() === p.name.toLowerCase()) })),
  };
}

function clean(p: ProfileInputT): ProfileInputT {
  const trim = (a: string[]) => a.map((s) => s.trim()).filter(Boolean);
  return {
    ...p,
    contact: { ...p.contact, otherLinks: trim(p.contact.otherLinks) },
    experiences: p.experiences.map((e) => ({ ...e, bullets: trim(e.bullets) })),
    educations: p.educations.map((e) => ({ ...e, coursework: trim(e.coursework) })),
    projects: p.projects.map((x) => ({ ...x, bullets: trim(x.bullets), tools: trim(x.tools) })),
  };
}

export default function ProfilePage() {
  const [loaded, setLoaded] = useState<ProfileDTO | null>(null);
  const [form, setForm] = useState<ProfileInputT | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [parseNote, setParseNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const p = await api<ProfileDTO>("/api/profile");
      setLoaded(p);
      setForm(p.exists ? p : null);
      setDirty(false);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your profile.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (fn: (p: ProfileInputT) => ProfileInputT) => {
    setForm((p) => (p ? fn(p) : p));
    setDirty(true);
  };

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    setErrors({});
    try {
      const p = await api<ProfileDTO>("/api/profile", { method: "PUT", json: clean(form) });
      setLoaded(p);
      setForm(p);
      setDirty(false);
      setParseNote(null);
      toast.success("Profile saved");
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        setErrors(e.fieldErrors);
        setSaveError("Some fields need fixing. They're marked in red below.");
      } else {
        setSaveError(e instanceof Error ? e.message : "Save failed.");
      }
    } finally {
      setSaving(false);
    }
  }

  function onParsed(r: ParseResult) {
    setForm(fromDraft(r, loaded?.exists ? loaded : null));
    setDirty(true);
    setImporting(false);
    setErrors({});
    setParseNote(
      r.source === "ai"
        ? "Parsed with AI. Check every section, fix anything wrong, then press Save."
        : r.aiAvailable
          ? "Parsed without AI (basic rules). Check every section carefully, then press Save."
          : "Parsed without AI because no ANTHROPIC_API_KEY is set. Basic rules miss some details, so check every section, then press Save."
    );
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Profile" />
        <ErrorState message={loadError} onRetry={load} />
      </>
    );
  }
  if (!loaded) {
    return (
      <>
        <PageHeader title="Profile" description="Your master resume. Every tailored resume is built only from these facts." />
        <ListSkeleton rows={5} />
      </>
    );
  }

  const showImport = importing || (!form && !loaded.exists);

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your master resume. Every tailored resume is built only from these facts."
        actions={
          form && !importing ? (
            <>
              <Button variant="outline" onClick={() => setImporting(true)}>
                <Upload /> Re-import resume
              </Button>
              <Button onClick={save} disabled={saving || !dirty}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                {saving ? "Saving…" : dirty ? "Save" : "Saved"}
              </Button>
            </>
          ) : null
        }
      />

      <div className="flex flex-col gap-4">
        {loaded.isSample && !importing && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This is a <strong>sample profile</strong> so you can try the app. Use <strong>Re-import resume</strong> to replace it with yours.
            </span>
          </div>
        )}

        {showImport ? (
          <>
            {!loaded.exists && !importing && (
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title="Upload or paste your resume to start"
                description="ApplyFlow builds every track resume and tailored resume from this one profile."
              />
            )}
            <ImportPanel onParsed={onParsed} onCancel={form ? () => setImporting(false) : undefined} />
            {!form && (
              <Button variant="link" className="self-start" onClick={() => { setForm({ contact: { name: "", email: "", phone: "", location: "", headline: "", linkedin: "", github: "", portfolio: "", otherLinks: [] }, experiences: [], skills: [], educations: [], certifications: [], projects: [] }); setDirty(true); }}>
                Or start with a blank profile and type it in
              </Button>
            )}
          </>
        ) : (
          form && (
            <>
              {parseNote && (
                <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{parseNote}</span>
                </div>
              )}
              {saveError && <ErrorState message={saveError} onRetry={save} />}
              <ProfileEditor value={form} set={set} errors={errors} />
              {dirty && (
                <div className="sticky bottom-4 flex justify-end">
                  <Button onClick={save} disabled={saving} className="shadow-lg">
                    {saving ? <Loader2 className="animate-spin" /> : <Save />}
                    {saving ? "Saving…" : "Save profile"}
                  </Button>
                </div>
              )}
            </>
          )
        )}

        <DataPanel onChanged={load} />
      </div>
    </>
  );
}
