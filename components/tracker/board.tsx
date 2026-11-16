"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, GripVertical } from "lucide-react";
import { STATUSES, type Status } from "@/lib/jobs/schema";
import type { ApplicationDTO } from "@/lib/applications/service";
import { todayStr } from "@/lib/dates";
import { cn } from "@/lib/utils";

const COLUMN_STYLE: Record<Status, string> = {
  Saved: "bg-neutral-400",
  Applied: "bg-sky-500",
  Interviewing: "bg-violet-500",
  Offer: "bg-emerald-500",
  Rejected: "bg-red-400",
};

function Card({ app, dragging, overlay }: { app: ApplicationDTO; dragging?: boolean; overlay?: boolean }) {
  const today = todayStr();
  const overdue = app.followUpDate && app.followUpDate < today && app.status !== "Rejected" && app.status !== "Offer";
  const due = app.followUpDate === today;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border bg-card p-3 pl-4 text-sm shadow-xs",
        dragging && "opacity-40",
        overlay && "rotate-2 shadow-lg"
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: app.track?.color ?? "var(--border)" }} aria-hidden />
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <Link href={`/jobs/${app.jobId}`} className="block truncate font-medium hover:underline" onPointerDown={(e) => e.stopPropagation()}>
            {app.company}
          </Link>
          <p className="truncate text-muted-foreground">{app.title}</p>
        </div>
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {app.track && (
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: app.track.color }} />
            {app.track.name}
          </span>
        )}
        {app.appliedAt && <span>Applied {app.appliedAt}</span>}
      </div>
      {(app.nextAction || app.followUpDate) && (
        <p className={cn("mt-1.5 flex items-center gap-1 text-xs", overdue ? "text-destructive" : due ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
          <CalendarClock className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {app.nextAction || "Follow up"}
            {app.followUpDate && ` · ${overdue ? "overdue " : due ? "today " : ""}${app.followUpDate}`}
          </span>
        </p>
      )}
    </div>
  );
}

function SortableCard({ app }: { app: ApplicationDTO }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app.jobId, data: { status: app.status } });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-label={`${app.company}, ${app.title}. Press space to move.`}
      className="cursor-grab touch-manipulation active:cursor-grabbing"
    >
      <Card app={app} dragging={isDragging} />
    </div>
  );
}

function Column({ status, apps }: { status: Status; apps: ApplicationDTO[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}`, data: { status } });
  return (
    <div className="flex w-64 shrink-0 flex-col md:w-auto md:min-w-0 md:flex-1">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cn("h-2 w-2 rounded-full", COLUMN_STYLE[status])} />
        <p className="text-sm font-medium">{status}</p>
        <span className="text-xs text-muted-foreground">{apps.length}</span>
      </div>
      <SortableContext id={status} items={apps.map((a) => a.jobId)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn("flex min-h-40 flex-1 flex-col gap-2 rounded-lg bg-muted/50 p-2 transition-colors", isOver && "bg-accent")}
        >
          {apps.map((a) => <SortableCard key={a.jobId} app={a} />)}
          {apps.length === 0 && <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">Drop here</p>}
        </div>
      </SortableContext>
    </div>
  );
}

export function Board({
  apps,
  onMove,
}: {
  apps: ApplicationDTO[];
  /** Called after a drop with the card's new status and the ids of its column in order. */
  onMove: (jobId: string, status: Status, orderedIds: string[]) => void;
}) {
  // Local copy so cards move smoothly while dragging; parent state is updated on drop.
  const [local, setLocal] = useState<ApplicationDTO[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const items = local ?? apps;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const byStatus = useMemo(() => {
    const m = Object.fromEntries(STATUSES.map((s) => [s, [] as ApplicationDTO[]])) as Record<Status, ApplicationDTO[]>;
    items.forEach((a) => m[a.status].push(a));
    return m;
  }, [items]);

  const statusOf = (id: string): Status | null => {
    if (id.startsWith("col:")) return id.slice(4) as Status;
    return items.find((a) => a.jobId === id)?.status ?? null;
  };

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setLocal(apps);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const from = statusOf(String(active.id));
    const to = statusOf(String(over.id));
    if (!from || !to || from === to) return;
    setLocal((prev) => {
      const list = [...(prev ?? apps)];
      const idx = list.findIndex((a) => a.jobId === active.id);
      if (idx < 0) return prev;
      const moved = { ...list[idx], status: to };
      list.splice(idx, 1);
      const overIdx = list.findIndex((a) => a.jobId === over.id);
      list.splice(overIdx >= 0 ? overIdx : list.length, 0, moved);
      return list;
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    const current = local ?? apps;
    setLocal(null);
    if (!over) return;
    const id = String(active.id);
    const to = statusOf(String(over.id)) ?? current.find((a) => a.jobId === id)?.status;
    if (!to) return;
    const column = current.filter((a) => a.status === to).map((a) => a.jobId);
    if (!column.includes(id)) column.push(id);
    const oldIndex = column.indexOf(id);
    const overIndex = over.id === `col:${to}` ? column.length - 1 : column.indexOf(String(over.id));
    if (overIndex >= 0 && overIndex !== oldIndex) {
      column.splice(oldIndex, 1);
      column.splice(overIndex, 0, id);
    }
    const original = apps.find((a) => a.jobId === id);
    const originalColumn = apps.filter((a) => a.status === to).map((a) => a.jobId);
    if (original?.status === to && originalColumn.join() === column.join()) return;
    onMove(id, to, column);
  }

  const active = activeId ? items.find((a) => a.jobId === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => { setActiveId(null); setLocal(null); }}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        {STATUSES.map((s) => <Column key={s} status={s} apps={byStatus[s]} />)}
      </div>
      <DragOverlay>{active ? <Card app={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
