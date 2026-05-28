"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
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
  { id: "blocked", title: "Блокеры", hint: "Нужна реакция владельца", states: ["blocked", "failed"], targetStatus: "blocked" },
];

const statusLabels: Record<string, string> = {
  new: "новая",
  planned: "запланирована",
  running: "в работе",
  blocked: "блокер",
  review: "review",
  qc: "QC",
  done: "готово",
  failed: "ошибка",
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
  }).format(date);
}

function toneClass(status: string) {
  if (["done", "verified", "passed"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["running", "qc", "review", "new", "planned"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["blocked", "failed"].includes(status)) return "border-red-200 bg-red-50 text-red-700";
  return "border-border bg-muted text-muted-foreground";
}

export function TaskBoard({ tasks }: { tasks: TaskState[] }) {
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === activeTaskId) ?? null,
    [activeTaskId, tasks]
  );

  async function handleDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const column = boardColumns.find((item) => item.id === event.over?.id);
    setActiveTaskId(null);
    if (!column) return;

    const task = tasks.find((item) => item.id === taskId);
    if (!task || column.states.includes(task.status)) return;

    setPendingTaskId(taskId);
    try {
      const response = await fetch("/api/tasks/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status: column.targetStatus }),
      });
      if (!response.ok) throw new Error(await response.text());
      router.refresh();
    } finally {
      setPendingTaskId(null);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(String(event.active.id));
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveTaskId(null)}>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex gap-2 overflow-x-auto border-b bg-background p-2">
          {boardColumns.map((column) => {
            const count = tasks.filter((task) => column.states.includes(task.status)).length;
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
            const columnTasks = tasks.filter((task) => column.states.includes(task.status));
            return (
              <KanbanColumn
                column={column}
                key={column.id}
                pendingTaskId={pendingTaskId}
                tasks={columnTasks}
              />
            );
          })}
        </div>
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard dragging task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  column,
  tasks,
  pendingTaskId,
}: {
  column: typeof boardColumns[number];
  tasks: TaskState[];
  pendingTaskId: string | null;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });

  return (
    <section
      className={`min-h-[560px] border-r bg-background p-2 transition-colors last:border-r-0 ${isOver ? "bg-muted" : ""}`}
      id={`column-${column.id}`}
      ref={setNodeRef}
    >
      <Card size="sm" className="mb-2 shadow-none">
        <CardHeader>
          <CardTitle>{column.title}</CardTitle>
          <CardDescription>{column.hint}</CardDescription>
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
          <DraggableTaskCard disabled={pendingTaskId === task.id} key={task.id} task={task} />
        ))}
      </div>
    </section>
  );
}

function DraggableTaskCard({ disabled, task }: { disabled?: boolean; task: TaskState }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled,
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
    >
      <TaskCard pending={disabled} task={task} />
    </div>
  );
}

function TaskCard({ dragging, pending, task }: { dragging?: boolean; pending?: boolean; task: TaskState }) {
  return (
    <Card size="sm" className={`shadow-xs ${dragging ? "w-[270px] shadow-lg" : ""}`}>
      <CardHeader>
        <CardDescription className="flex items-center justify-between gap-2">
          <Badge className={toneClass(task.status)} variant="outline">{pending ? "обновление" : label(task.status)}</Badge>
          <span>{formatDate(task.updatedAt)}</span>
        </CardDescription>
        <CardTitle className="line-clamp-3">{task.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-4 text-sm text-muted-foreground">{task.ownerRequest}</p>
      </CardContent>
      <CardFooter className="justify-between text-xs text-muted-foreground">
        <span>{task.agent}</span>
        <span>{label(task.priority)}</span>
      </CardFooter>
    </Card>
  );
}
