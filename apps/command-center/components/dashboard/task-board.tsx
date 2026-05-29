"use client";

import { useEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { ArchiveIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TaskState } from "@/app/lib/types";

const boardColumns = [
  { id: "planned", title: "План", hint: "Сформулированы и ждут движения", states: ["new", "planned"], targetStatus: "planned" },
  { id: "work", title: "В работе", hint: "Исполнитель уже подключен", states: ["running"], targetStatus: "running" },
  { id: "review", title: "Review", hint: "Код, логика или результат на проверке", states: ["review"], targetStatus: "review" },
  { id: "qc", title: "QC", hint: "Финальный контроль качества", states: ["qc"], targetStatus: "qc" },
  { id: "done", title: "Готово", hint: "Закрытые и отданные результаты", states: ["done", "verified"], targetStatus: "done" },
  { id: "blocked", title: "Ожидает владельца", hint: "Нужна реакция владельца", states: ["waiting_owner", "blocked", "failed"], targetStatus: "waiting_owner" },
];

type BoardColumn = typeof boardColumns[number];

type DragState = {
  task: TaskState;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
  width: number;
  height: number;
  overColumnId: string | null;
};

const statusLabels: Record<string, string> = {
  new: "новая",
  planned: "запланирована",
  running: "в работе",
  waiting_owner: "требуется действие владельца",
  blocked: "блокер",
  review: "review",
  qc: "QC",
  done: "готово",
  failed: "ошибка",
  rejected: "отклонена",
  verified: "проверено",
  low: "низкий",
  normal: "обычный",
  high: "высокий",
  urgent: "срочно",
};

function label(value: string) {
  return statusLabels[value] ?? value.replaceAll("_", " ");
}

function formatDate(value?: string) {
  if (!value) return "нет данных";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(date);
}

function toneClass(status: string) {
  if (["done", "verified", "passed"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["running", "qc", "review", "new", "planned", "waiting_owner"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["blocked", "failed"].includes(status)) return "border-red-200 bg-red-50 text-red-700";
  if (status === "rejected") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-border bg-muted text-muted-foreground";
}

function columnAtPoint(x: number, y: number) {
  return boardColumns.find((column) => {
    const element = document.querySelector<HTMLElement>(`[data-column-id="${column.id}"]`);
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }) ?? null;
}

export function TaskBoard({ tasks }: { tasks: TaskState[] }) {
  const router = useRouter();
  const boardTasks = tasks.filter((task) => !["archived", "cancelled"].includes(task.status));
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!dragState) return;
    const activeDrag = dragState;

    function handlePointerMove(event: globalThis.PointerEvent) {
      if (event.pointerId !== activeDrag.pointerId) return;
      const column = columnAtPoint(event.clientX, event.clientY);
      setDragState((current) => current ? {
        ...current,
        x: event.clientX,
        y: event.clientY,
        overColumnId: column?.id ?? null,
      } : null);
    }

    async function handlePointerUp(event: globalThis.PointerEvent) {
      if (event.pointerId !== activeDrag.pointerId) return;
      const column = columnAtPoint(event.clientX, event.clientY);
      const task = activeDrag.task;
      setDragState(null);
      if (!column || column.states.includes(task.status)) return;

      setPendingTaskId(task.id);
      try {
        const response = await fetch("/api/tasks/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id, status: column.targetStatus }),
        });
        if (!response.ok) throw new Error(await response.text());
        router.refresh();
      } finally {
        setPendingTaskId(null);
      }
    }

    function handlePointerCancel(event: globalThis.PointerEvent) {
      if (event.pointerId !== activeDrag.pointerId) return;
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [dragState, router]);

  function handleTaskPointerDown(event: ReactPointerEvent<HTMLDivElement>, task: TaskState) {
    if (pendingTaskId === task.id || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button,a,input,select,textarea,form")) return;

    const rect = event.currentTarget.getBoundingClientRect();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      task,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height,
      overColumnId: null,
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex gap-2 overflow-x-auto border-b bg-background p-2">
        {boardColumns.map((column) => {
          const count = boardTasks.filter((task) => column.states.includes(task.status)).length;
          return (
            <a className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border bg-background px-2 text-xs font-medium" href={`#column-${column.id}`} key={column.id}>
              {column.title}
              <Badge variant="secondary">{count}</Badge>
            </a>
          );
        })}
      </div>
      <div className="grid auto-cols-[minmax(270px,1fr)] grid-flow-col overflow-x-auto bg-background">
        {boardColumns.map((column) => {
          const columnTasks = boardTasks.filter((task) => column.states.includes(task.status));
          return (
            <KanbanColumn
              column={column}
              draggingTaskId={dragState?.task.id ?? null}
              isOver={dragState?.overColumnId === column.id}
              key={column.id}
              onTaskPointerDown={handleTaskPointerDown}
              pendingTaskId={pendingTaskId}
              tasks={columnTasks}
            />
          );
        })}
      </div>
      {dragState ? createPortal(
        <div
          className="pointer-events-none fixed z-[1000]"
          data-drag-overlay
          style={{
            height: dragState.height,
            left: dragState.x - dragState.offsetX,
            top: dragState.y - dragState.offsetY,
            width: dragState.width,
            willChange: "left, top",
          }}
        >
          <TaskCard dragging task={dragState.task} />
        </div>,
        document.body
      ) : null}
    </div>
  );
}

function KanbanColumn({
  column,
  draggingTaskId,
  isOver,
  onTaskPointerDown,
  tasks,
  pendingTaskId,
}: {
  column: BoardColumn;
  draggingTaskId: string | null;
  isOver: boolean;
  onTaskPointerDown: (event: ReactPointerEvent<HTMLDivElement>, task: TaskState) => void;
  tasks: TaskState[];
  pendingTaskId: string | null;
}) {
  return (
    <section
      data-column-id={column.id}
      className={`min-h-[560px] border-r bg-background p-2 transition-colors last:border-r-0 ${isOver ? "bg-muted" : ""}`}
      id={`column-${column.id}`}
    >
      <Card size="sm" className="mb-2 h-28 shadow-none">
        <CardHeader className="h-full">
          <CardTitle>{column.title}</CardTitle>
          <CardDescription className="line-clamp-2">{column.hint}</CardDescription>
          <CardAction>
            <Badge variant="outline">{tasks.length}</Badge>
          </CardAction>
        </CardHeader>
      </Card>
      <div className="grid gap-2">
        {tasks.length === 0 ? (
          <Card size="sm" className={`border-dashed shadow-none ${isOver ? "border-primary/40 bg-muted" : ""}`}>
            <CardContent className="flex min-h-24 items-center justify-center text-sm text-muted-foreground">
              Перетащи задачу сюда
            </CardContent>
          </Card>
        ) : null}
        {tasks.map((task) => (
          <DraggableTaskCard
            dragging={draggingTaskId === task.id}
            disabled={pendingTaskId === task.id}
            key={task.id}
            onPointerDown={onTaskPointerDown}
            task={task}
          />
        ))}
      </div>
    </section>
  );
}

function DraggableTaskCard({
  disabled,
  dragging,
  onPointerDown,
  task,
}: {
  disabled?: boolean;
  dragging?: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>, task: TaskState) => void;
  task: TaskState;
}) {
  return (
    <div
      className={`cursor-grab touch-none active:cursor-grabbing ${dragging ? "opacity-30" : ""}`}
      data-task-id={task.id}
      onPointerDown={(event) => onPointerDown(event, task)}
    >
      <TaskCard pending={disabled} task={task} />
    </div>
  );
}

function TaskCard({ dragging, pending, task }: { dragging?: boolean; pending?: boolean; task: TaskState }) {
  return (
    <Card size="sm" className={`shadow-xs ${dragging ? "shadow-lg ring-1 ring-foreground/10" : ""}`}>
      <CardHeader>
        <CardDescription className="flex items-center justify-between gap-2">
          <Badge className={toneClass(task.status)} variant="outline">{pending ? "обновление" : label(task.status)}</Badge>
          <span>{formatDate(task.updatedAt)}</span>
        </CardDescription>
        <CardTitle className="line-clamp-3">{task.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-4 text-sm text-muted-foreground">{task.ownerRequest}</p>
        {task.runningStep ? (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            Сейчас: {task.runningStep}
          </p>
        ) : null}
        {task.hermesSummary ? (
          <p className={`mt-2 line-clamp-3 text-xs ${["blocked", "failed"].includes(task.status) ? "text-red-600" : "text-muted-foreground"}`}>
            Hermes: {task.hermesSummary}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="justify-between text-xs text-muted-foreground">
        <span>{task.agent}</span>
        <div className="flex items-center gap-1">
          <span>{label(task.priority)}</span>
          {!dragging ? <TaskActions taskId={task.id} /> : null}
        </div>
      </CardFooter>
    </Card>
  );
}

function TaskActions({ taskId }: { taskId: string }) {
  return (
    <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()}>
      <form action="/api/tasks/action" method="post">
        <input name="taskId" type="hidden" value={taskId} />
        <input name="action" type="hidden" value="archive" />
        <input name="redirect" type="hidden" value="/?view=tasks" />
        <Button aria-label="Архивировать задачу" size="icon" title="Архивировать" type="submit" variant="ghost">
          <ArchiveIcon className="size-3.5" />
        </Button>
      </form>
      <form action="/api/tasks/action" method="post">
        <input name="taskId" type="hidden" value={taskId} />
        <input name="action" type="hidden" value="delete" />
        <input name="redirect" type="hidden" value="/?view=tasks" />
        <Button aria-label="Удалить задачу" size="icon" title="Удалить" type="submit" variant="ghost">
          <Trash2Icon className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}
