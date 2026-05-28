"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  const boardTasks = tasks.filter((task) => !["archived", "cancelled"].includes(task.status));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
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

    const task = boardTasks.find((item) => item.id === taskId);
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
      data-column-id={column.id}
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
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <DraggableTaskCard disabled={pendingTaskId === task.id} key={task.id} task={task} />
          ))}
        </SortableContext>
      </div>
    </section>
  );
}

function DraggableTaskCard({ disabled, task }: { disabled?: boolean; task: TaskState }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      data-task-id={task.id}
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
        {task.runningStep ? (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            Сейчас: {task.runningStep}
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
