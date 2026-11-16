"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, MessageSquareText, Plus, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { api, ApiError } from "@/lib/api-client";
import { STAR_HINT } from "@/lib/interview/bank";
import type { Category, QuestionDTO } from "@/lib/interview/service";
import { cn } from "@/lib/utils";
import { AiSetupNote, GenerateError, type Mode } from "./ai-shared";

const GROUPS: { key: Category; title: string; hint?: string }[] = [
  { key: "job", title: "About this job", hint: "Tied to this posting's requirements. Have a specific example ready for each." },
  { key: "track", title: "Technical", hint: "Common questions for this kind of role." },
  { key: "behavioral", title: "Behavioral", hint: STAR_HINT },
  { key: "custom", title: "Your questions" },
];

type SaveState = "idle" | "saving" | "saved" | "error";

function QuestionCard({ q, onDeleted }: { q: QuestionDTO; onDeleted: (id: string) => void }) {
  const [answer, setAnswer] = useState(q.answer);
  const [saved, setSaved] = useState(q.answer);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (value: string) => {
      setState("saving");
      setError(null);
      try {
        await api(`/api/interview/${q.id}`, { method: "PATCH", json: { answer: value } });
        setSaved(value);
        setState("saved");
      } catch (e) {
        setState("error");
        setError(e instanceof ApiError && e.fieldErrors?.answer ? e.fieldErrors.answer[0] : e instanceof Error ? e.message : "Couldn't save.");
      }
    },
    [q.id]
  );

  // Autosave a second after you stop typing.
  useEffect(() => {
    if (answer === saved) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(answer), 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [answer, saved, save]);

  async function remove() {
    try {
      await api(`/api/interview/${q.id}`, { method: "DELETE" });
      onDeleted(q.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete.", { action: { label: "Retry", onClick: remove } });
    }
  }

  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  return (
    <div className="flex flex-col gap-2 border-b py-3 last:border-0" data-testid="question">
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm font-medium">{q.question}</p>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Delete question" onClick={remove}><Trash2 /></Button>
      </div>
      <Textarea
        rows={answer ? 4 : 2}
        placeholder="Draft your answer…"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onBlur={() => answer !== saved && save(answer)}
        aria-label={`Answer: ${q.question}`}
        aria-invalid={state === "error"}
      />
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{words ? `${words} words · about ${Math.max(1, Math.round(words / 130))} min spoken` : ""}</span>
        <span aria-live="polite" className="flex items-center gap-1">
          {state === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Saving</>}
          {state === "saved" && answer === saved && <><Check className="h-3 w-3" /> Saved</>}
          {state === "error" && (
            <span className="flex items-center gap-2 text-destructive">
              {error}
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => save(answer)}><RotateCw /> Retry</Button>
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

export function InterviewTab({ jobId, trackName }: { jobId: string; trackName: string | null }) {
  const [questions, setQuestions] = useState<QuestionDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<{ message: string; mode: Mode; needsProfile: boolean } | null>(null);
  const [newQ, setNewQ] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setQuestions(await api<QuestionDTO[]>(`/api/jobs/${jobId}/interview`));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load questions.");
    }
  }, [jobId]);
  useEffect(() => {
    load();
  }, [load]);

  async function generate(mode: Mode = "auto") {
    setGenerating(true);
    setGenError(null);
    try {
      const r = await api<{ questions: QuestionDTO[]; source: string }>(`/api/jobs/${jobId}/interview`, { method: "POST", json: { action: "generate", mode } });
      setQuestions(r.questions);
    } catch (e) {
      setGenError({ message: e instanceof Error ? e.message : "Couldn't make questions.", mode, needsProfile: false });
    } finally {
      setGenerating(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (newQ.trim().length < 5) return setAddError("Write the question (at least 5 characters).");
    setAdding(true);
    try {
      const q = await api<QuestionDTO>(`/api/jobs/${jobId}/interview`, { method: "POST", json: { action: "add", question: newQ } });
      setQuestions((list) => [...(list ?? []), q]);
      setNewQ("");
    } catch (err) {
      setAddError(err instanceof ApiError && err.fieldErrors?.question ? err.fieldErrors.question[0] : err instanceof Error ? err.message : "Couldn't add it.");
    } finally {
      setAdding(false);
    }
  }

  if (loadError) return <ErrorState message={loadError} onRetry={load} />;
  if (!questions) return <ListSkeleton rows={4} />;

  const err = genError && <GenerateError error={genError} onRetry={() => generate(genError.mode)} onBasic={() => generate("basic")} />;
  const addForm = (
    <form onSubmit={add} className="flex flex-col gap-1" noValidate>
      <div className="flex gap-2">
        <Input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="Add a question you expect, e.g. from a recruiter call" aria-label="New question" aria-invalid={!!addError} />
        <Button type="submit" variant="outline" disabled={adding}>{adding ? <Loader2 className="animate-spin" /> : <Plus />} Add</Button>
      </div>
      {addError && <p className="text-xs text-destructive">{addError}</p>}
    </form>
  );

  if (questions.length === 0)
    return (
      <div className="flex flex-col gap-3">
        {err}
        <EmptyState
          icon={<MessageSquareText className="h-8 w-8" />}
          title="Prepare for the interview"
          description={`Get questions about this job's requirements, ${trackName ? `${trackName} technical questions` : "technical questions"} and behavioral questions, with space to draft your answers.`}
          action={
            <Button onClick={() => generate()} disabled={generating}>
              {generating ? <Loader2 className="animate-spin" /> : <MessageSquareText />} {generating ? "Making questions…" : "Get questions"}
            </Button>
          }
        />
        {addForm}
        <AiSetupNote what="interview prep" />
      </div>
    );

  const answered = questions.filter((q) => q.answer.trim()).length;
  return (
    <div className="flex flex-col gap-4">
      {err}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-sm font-medium">{answered} of {questions.length} answered</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={answered} aria-valuemax={questions.length} aria-label="Answers drafted">
              <div className={cn("h-full rounded-full bg-primary transition-all")} style={{ width: `${(answered / questions.length) * 100}%` }} />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => generate()} disabled={generating} title="Answered questions and your own are kept">
            {generating ? <Loader2 className="animate-spin" /> : <RotateCw />} New questions
          </Button>
        </CardContent>
      </Card>
      {GROUPS.map((g) => {
        const list = questions.filter((q) => q.category === g.key);
        if (!list.length && g.key !== "custom") return null;
        return (
          <Card key={g.key}>
            <CardHeader>
              <CardTitle>{g.key === "track" && trackName ? `${trackName} technical` : g.title} <span className="font-normal text-muted-foreground">({list.length})</span></CardTitle>
              {g.hint && <CardDescription className="mt-1">{g.hint}</CardDescription>}
            </CardHeader>
            <CardContent>
              {list.map((q) => <QuestionCard key={q.id} q={q} onDeleted={(id) => setQuestions((l) => l?.filter((x) => x.id !== id) ?? null)} />)}
              {g.key === "custom" && <div className={cn(list.length && "mt-3")}>{addForm}</div>}
            </CardContent>
          </Card>
        );
      })}
      <AiSetupNote what="interview prep" />
    </div>
  );
}
