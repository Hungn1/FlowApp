"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, Briefcase, KanbanSquare, LayoutDashboard, Layers, Menu, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/tracker", label: "Tracker", icon: KanbanSquare },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/tracks", label: "Tracks", icon: Layers },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-sidebar p-3 md:flex">
        <Link href="/" className="mb-6 px-3 pt-2 text-lg font-semibold tracking-tight">
          ApplyFlow
        </Link>
        <NavLinks />
        <div className="mt-auto">
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background px-4 py-2 md:hidden">
        <Link href="/" className="font-semibold">ApplyFlow</Link>
        <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu />
        </Button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col bg-sidebar p-3 shadow-lg">
            <div className="mb-6 flex items-center justify-between px-3 pt-2">
              <span className="text-lg font-semibold">ApplyFlow</span>
              <Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X />
              </Button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="mt-auto">
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
