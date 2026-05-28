"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArchiveIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  Clock3Icon,
  FileTextIcon,
  Loader2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CommandCenterState, TaskState } from "@/app/lib/types";

const statusLabels: Record<string, string> = {
  new: "новая",
  planned: "запланирована",
  running: "в работе",
  blocked: "блокер",
  review: "review",
  qc: "QC",
  done: "готово",
  cancelled: "отменена",
  failed: "ошибка",
  verified: "проверено",
  archived: "архив",
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
  if (["running", "qc", "review", "new", "planned"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["blocked", "failed"].includes(status)) return "border-red-200 bg-red-50 text-red-700";
  return "border-border bg-muted text-muted-foreground";
}

function statusIcon(status: string) {
  if (["running", "review", "qc"].includes(status)) return <Loader2Icon className="size-3 animate-spin" />;
  if (["done", "verified"].includes(status)) return <CheckCircle2Icon className="size-3" />;
  if (["blocked", "failed"].includes(status)) return <CircleDashedIcon className="size-3" />;
  return <Clock3Icon className="size-3" />;
}

function progressFor(task: TaskState) {
  if (["done", "verified"].includes(task.status)) return 100;
  if (task.stepCount === 0) return 0;
  const done = task.steps.filter((step) => ["done", "skipped"].includes(step.status)).length;
  const running = task.steps.some((step) => step.status === "running") ? 0.5 : 0;
  return Math.min(96, Math.round(((done + running) / task.stepCount) * 100));
}

function completedStepsFor(task: TaskState) {
  if (["done", "verified"].includes(task.status)) return task.stepCount;
  return task.steps.filter((step) => ["done", "skipped"].includes(step.status)).length;
}

function normalizeOutput(output?: string) {
  if (!output || output === "{}") return "";
  try {
    return JSON.stringify(JSON.parse(output), null, 2);
  } catch {
    return output;
  }
}

async function postTaskAction(taskId: string, action: "archive" | "delete") {
  const form = new FormData();
  form.set("taskId", taskId);
  form.set("action", action);
  form.set("redirect", "/?view=tasks");
  await fetch("/api/tasks/action", { method: "POST", body: form });
}

export function LiveTaskTable({
  initialSelectedTaskId,
  initialState,
  limit,
}: {
  initialSelectedTaskId?: string;
  initialState: CommandCenterState;
  limit?: number;
}) {
  const [state, setState] = useState(initialState);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialSelectedTaskId ?? null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const tasks = useMemo(() => {
    const visible = state.tasks.filter((task) => !["archived", "cancelled"].includes(task.status));
    return typeof limit === "number" ? visible.slice(0, limit) : visible;
  }, [state.tasks, limit]);

  const selectedTask = selectedTaskId ? state.tasks.find((task) => task.id === selectedTaskId) ?? null : null;

  async function refresh() {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (response.ok) setState(await response.json() as CommandCenterState);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function runAction(taskId: string, action: "archive" | "delete") {
    setActionTaskId(taskId);
    try {
      await postTaskAction(taskId, action);
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      await refresh();
    } finally {
      setActionTaskId(null);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 2500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  useEffect(() => {
    if (initialSelectedTaskId) setSelectedTaskId(initialSelectedTaskId);
  }, [initialSelectedTaskId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-background">
        <div className="flex min-h-11 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`size-2 rounded-full ${isRefreshing ? "animate-pulse bg-amber-400" : "bg-emerald-400"}`} />
            {isRefreshing ? "обновляю статусы" : "live-статусы активны"}
          </div>
          <Button onClick={() => void refresh()} size="sm" type="button" variant="outline">
            <Loader2Icon className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Обновить
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Задача</th>
                <th className="w-40 px-4 py-3 font-medium">Статус</th>
                <th className="w-72 px-4 py-3 font-medium">Прогресс</th>
                <th className="w-52 px-4 py-3 font-medium">Маршрут</th>
                <th className="w-44 px-4 py-3 font-medium">Агент</th>
                <th className="w-32 px-4 py-3 font-medium">Обновлена</th>
                <th className="w-24 px-4 py-3 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const progress = progressFor(task);
                return (
                  <tr
                    className="group cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/45"
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <td className="px-4 py-4 align-top">
                      <p className="line-clamp-1 font-medium">{task.title}</p>
                      <p className="mt-1 line-clamp-2 text-muted-foreground">{task.ownerRequest}</p>
                      {task.hermesSummary ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{task.hermesSummary}</p> : null}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <Badge className={toneClass(task.status)} variant="outline">
                        {statusIcon(task.status)}
                        {label(task.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center justify-between gap-3">
                        <span className="line-clamp-1 text-muted-foreground">{task.runningStep ?? "нет активного шага"}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${["blocked", "failed"].includes(task.status) ? "bg-red-400" : "bg-emerald-400"}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{completedStepsFor(task)}/{task.stepCount} шагов</p>
                    </td>
                    <td className="px-4 py-4 align-top text-muted-foreground">{task.routeType}</td>
                    <td className="px-4 py-4 align-top text-muted-foreground">{task.agent}</td>
                    <td className="px-4 py-4 align-top text-muted-foreground">{formatDate(task.updatedAt)}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                        <Button
                          aria-label="Архивировать задачу"
                          disabled={actionTaskId === task.id}
                          onClick={() => void runAction(task.id, "archive")}
                          size="icon"
                          title="Архивировать"
                          type="button"
                          variant="ghost"
                        >
                          <ArchiveIcon className="size-4" />
                        </Button>
                        <Button
                          aria-label="Удалить задачу"
                          disabled={actionTaskId === task.id}
                          onClick={() => void runAction(task.id, "delete")}
                          size="icon"
                          title="Удалить"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tasks.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-muted-foreground" colSpan={7}>Задач пока нет.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {mounted && selectedTask ? createPortal(
          <TaskDetailsModal
            onArchive={() => void runAction(selectedTask.id, "archive")}
            onClose={() => setSelectedTaskId(null)}
            onDelete={() => void runAction(selectedTask.id, "delete")}
            task={selectedTask}
          />,
          document.body
        ) : null}
    </>
  );
}

function TaskDetailsModal({
  onArchive,
  onClose,
  onDelete,
  task,
}: {
  onArchive: () => void;
  onClose: () => void;
  onDelete: () => void;
  task: TaskState;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className={toneClass(task.status)} variant="outline">{statusIcon(task.status)}{label(task.status)}</Badge>
              <Badge variant="outline">{task.routeType}</Badge>
              <Badge variant="outline">{task.agent}</Badge>
            </div>
            <h2 className="line-clamp-2 text-xl font-semibold">{task.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Обновлена {formatDate(task.updatedAt)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button onClick={onArchive} size="icon" title="Архивировать" type="button" variant="ghost"><ArchiveIcon className="size-4" /></Button>
            <Button onClick={onDelete} size="icon" title="Удалить" type="button" variant="ghost"><Trash2Icon className="size-4" /></Button>
            <Button onClick={onClose} size="icon" title="Закрыть" type="button" variant="ghost"><XIcon className="size-4" /></Button>
          </div>
        </div>

        <div className="grid min-h-0 gap-4 overflow-y-auto p-5">
          <DetailBlock title="Запрос">
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{task.ownerRequest}</p>
          </DetailBlock>

          <DetailBlock title="Результат">
            {task.result ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-6">{task.result}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Результат еще не записан. Когда агент завершит работу или заблокирует задачу, итог появится здесь.</p>
            )}
          </DetailBlock>

          <DetailBlock title="Шаги">
            <div className="grid gap-2">
              {task.steps.map((step, index) => (
                <div className="min-w-0 rounded-lg border px-3 py-2" key={step.id}>
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{index + 1}</span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{step.title}</p>
                    <Badge className={toneClass(step.status)} variant="outline">{label(step.status)}</Badge>
                  </div>
                  <p className="mt-1 break-words text-xs text-muted-foreground">{step.assignedAgent ?? "агент не назначен"}{step.toolName ? ` · ${step.toolName}` : ""}</p>
                  {normalizeOutput(step.output) ? (
                    <pre className="mt-2 max-h-40 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-2 text-xs leading-5">
                      {normalizeOutput(step.output)}
                    </pre>
                  ) : null}
                </div>
              ))}
              {task.steps.length === 0 ? <p className="text-sm text-muted-foreground">Шаги еще не созданы.</p> : null}
            </div>
          </DetailBlock>

          <div className="grid gap-4 lg:grid-cols-2">
            <DetailBlock title="Артефакты">
              {task.artifacts.length > 0 ? (
                <div className="grid gap-2">
                  {task.artifacts.map((artifact) => (
                    <a className="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted" href={artifact.uri} key={artifact.id}>
                      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium">{artifact.title}</span>
                      <span className="text-xs text-muted-foreground">{artifact.type}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Файлы, отчеты и документы по этой задаче пока не прикреплены.</p>
              )}
            </DetailBlock>

            <DetailBlock title="QC">
              {task.qcResults.length > 0 ? task.qcResults.map((result) => (
                <div className="rounded-lg border px-3 py-2" key={result.id}>
                  <Badge className={toneClass(result.status)} variant="outline">{label(result.status)}</Badge>
                  <p className="mt-2 break-words text-sm">{result.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{result.gate} · {formatDate(result.createdAt)}</p>
                </div>
              )) : <p className="text-sm text-muted-foreground">QC еще не запускался.</p>}
            </DetailBlock>
          </div>

          <DetailBlock title="События">
            <div className="grid gap-2">
              {task.events.map((event) => (
                <div className="rounded-lg border px-3 py-2" key={event.id}>
                  <p className="break-words text-sm">{event.message}</p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">{event.actor} · {event.eventType} · {formatDate(event.createdAt)}</p>
                </div>
              ))}
              {task.events.length === 0 ? <p className="text-sm text-muted-foreground">Событий по задаче пока нет.</p> : null}
            </div>
          </DetailBlock>
        </div>
      </div>
    </div>
  );
}

function DetailBlock({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="min-w-0 rounded-xl border bg-background p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}
