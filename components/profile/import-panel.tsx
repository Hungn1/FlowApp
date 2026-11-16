"use client";
import { useRef, useState } from "react";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/states";
import { api } from "@/lib/api-client";
import type { ParsedResume } from "@/lib/profile/schema";

export type ParseResult = { source: "ai" | "rules"; text: string; draft: ParsedResume; aiAvailable: boolean };

export function ImportPanel({ onParsed, onCancel }: { onParsed: (r: ParseResult) => void; onCancel?: () => void }) {
  const [tab, setTab] = useState("upload");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function run(mode: "auto" | "rules" = "auto") {
    setError(null);
    setFieldError(null);
    if (tab === "upload" && !file) return setFieldError("Choose a PDF, DOCX, or TXT file first.");
    if (tab === "paste" && text.trim().length < 50) return setFieldError("Paste at least a few lines of your resume.");
    const form = new FormData();
    if (tab === "upload" && file) form.append("file", file);
    if (tab === "paste") form.append("text", text);
    form.append("mode", mode);
    setBusy(true);
    try {
      const res = await api<ParseResult>("/api/profile/parse", { method: "POST", body: form });
      onParsed(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parsing failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import your master resume</CardTitle>
        <CardDescription>
          Upload or paste it once. ApplyFlow splits it into experience, skills, education, certifications and projects that you can
          edit before saving. Nothing is saved until you press Save.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs value={tab} onValueChange={(v) => { setTab(v); setFieldError(null); }}>
          <TabsList>
            <TabsTrigger value="upload">Upload file</TabsTrigger>
            <TabsTrigger value="paste">Paste text</TabsTrigger>
          </TabsList>
          <TabsContent value="upload">
            <div
              className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f);
              }}
            >
              <FileUp className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm">{file ? file.name : "Drop a file here, or choose one"}</p>
              <p className="text-xs text-muted-foreground">PDF, DOCX or TXT, up to 5 MB</p>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                Choose file
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="paste">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your full resume here…"
              className="min-h-64 font-mono text-xs"
              aria-invalid={Boolean(fieldError)}
            />
          </TabsContent>
        </Tabs>
        {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
        {error && <ErrorState message={error} onRetry={() => run()} />}
        {error && (
          <p className="text-xs text-muted-foreground">
            AI not working?{" "}
            <button className="underline" onClick={() => run("rules")}>
              Parse without AI
            </button>{" "}
            instead (less accurate, but works offline).
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy ? "Parsing… (up to 30s)" : "Parse resume"}
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
