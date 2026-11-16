import * as React from "react";
import { cn } from "@/lib/utils";

// Native select styled to match. Fast, accessible, works on phones.
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
NativeSelect.displayName = "NativeSelect";
