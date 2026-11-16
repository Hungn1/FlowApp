"use client";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** PDF and Word download buttons. Shows a retry toast if the export fails. */
export function ExportButtons({ url, disabled, disabledReason, size = "sm" }: { url: string; disabled?: boolean; disabledReason?: string; size?: "sm" | "default" }) {
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);

  async function download(format: "pdf" | "docx") {
    setBusy(format);
    try {
      const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}format=${format}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Export failed (${res.status}).`);
      }
      const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `export.${format}`;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      if (res.headers.get("X-One-Page") === "false") {
        toast.warning("This resume runs over one page, even at the smallest text size. Hide a few items on the track to fit it on one page.");
      } else {
        toast.success(`Downloaded ${name}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.", { action: { label: "Retry", onClick: () => download(format) } });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {(["pdf", "docx"] as const).map((f) => (
        <Button key={f} variant="outline" size={size} disabled={disabled || busy !== null} title={disabled ? disabledReason : undefined} onClick={() => download(f)}>
          {busy === f ? <Loader2 className="animate-spin" /> : <Download />} {f === "pdf" ? "PDF" : "Word"}
        </Button>
      ))}
    </>
  );
}
