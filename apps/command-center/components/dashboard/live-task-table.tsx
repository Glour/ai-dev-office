"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArchiveIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  Clock3Icon,
  Loader2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArtifactGallery } from "@/components/dashboard/artifact-gallery";
import { MarkdownView } from "@/components/dashboard/markdown-view";
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
  rejected: "отклонена",
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
  if (status === "rejected") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-border bg-muted text-muted-foreground";
}

function statusIcon(status: string) {
  if (["running", "review", "qc"].includes(status)) return <Loader2Icon className="size-3 animate-spin" />;
  if (["done", "verified"].includes(status)) return <CheckCircle2Icon className="size-3" />;
  if (["blocked", "failed"].includes(status)) return <CircleDashedIcon className="size-3" />;
  if (status === "rejected") return <XIcon className="size-3" />;
  return <Clock3Icon className="size-3" />;
}

function progressFor(task: TaskState) {
  if (["done", "verified"].includes(task.status)) return 100;
  if (task.status === "rejected") return 0;
  if (task.stepCount === 0) return 0;
  const done = task.steps.filter((step) => ["done", "skipped"].includes(step.status)).length;
  const running = task.steps.some((step) => step.status === "running") ? 0.5 : 0;
  return Math.min(96, Math.round(((done + running) / task.stepCount) * 100));
}

function completedStepsFor(task: TaskState) {
  if (["done", "verified"].includes(task.status)) return task.stepCount;
  if (task.status === "rejected") return 0;
  return task.steps.filter((step) => ["done", "skipped"].includes(step.status)).length;
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
                      <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-muted-foreground">{task.ownerRequest}</p>
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
                          className={`h-full rounded-full transition-all ${["blocked", "failed"].includes(task.status) ? "bg-red-400" : task.status === "rejected" ? "bg-slate-300" : "bg-emerald-400"}`}
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
              <MarkdownView value={task.result} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {task.status === "rejected"
                  ? "Задача отклонена до запуска. Runtime не запускался."
                  : "Результат еще не записан. Когда агент завершит работу или заблокирует задачу, итог появится здесь."}
              </p>
            )}
          </DetailBlock>

          <DetailBlock title="Артефакты">
            <ArtifactGallery artifacts={task.artifacts} />
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
                  {step.output && step.output !== "{}" ? (
                    <p className="mt-2 text-xs text-muted-foreground">Технический вывод скрыт; итог показан в блоке “Результат”.</p>
                  ) : null}
                </div>
              ))}
              {task.steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {task.status === "rejected" ? "Задача отклонена до запуска, шаги выполнения не создавались." : "Шаги еще не созданы."}
                </p>
              ) : null}
            </div>
          </DetailBlock>

          <div className="grid gap-4 lg:grid-cols-2">
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
