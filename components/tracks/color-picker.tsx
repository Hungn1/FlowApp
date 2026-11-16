"use client";
import { Check } from "lucide-react";
import { TRACK_COLORS } from "@/lib/tracks/defaults";

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Track color">
      {TRACK_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className="flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ background: c }}
        >
          {value === c && <Check className="h-4 w-4 text-white" />}
        </button>
      ))}
    </div>
  );
}
