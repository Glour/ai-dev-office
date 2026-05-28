import {
  ActivityIcon,
  ArchiveIcon,
  BotIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  DatabaseIcon,
  FileTextIcon,
  GitBranchIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  PlusIcon,
  RouteIcon,
  ShieldCheckIcon,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { loadCommandCenterState } from "./lib/office";
import type { AgentState, EventState, MaterialState, RouteRuleState, TaskState } from "./lib/types";

export const dynamic = "force-dynamic";

type View = "overview" | "tasks" | "agents" | "materials" | "routes" | "events";

const basePath = process.env.NEXT_PUBLIC_COMMAND_CENTER_BASE_PATH ?? process.env.COMMAND_CENTER_BASE_PATH ?? "";

const navItems: Array<{ view: View; label: string; description: string; icon: typeof ActivityIcon }> = [
  { view: "overview", label: "Обзор", description: "Пульс офиса", icon: LayoutDashboardIcon },
  { view: "tasks", label: "Задачи", description: "Очередь и статусы", icon: ClipboardListIcon },
  { view: "agents", label: "Агенты", description: "Runtime gateway", icon: BotIcon },
  { view: "materials", label: "Материалы", description: "База знаний", icon: LibraryIcon },
  { view: "routes", label: "Маршруты", description: "Процессы", icon: RouteIcon },
  { view: "events", label: "Журнал", description: "События", icon: DatabaseIcon },
];

const boardColumns = [
  { id: "planned", title: "План", hint: "Сформулированы и ждут движения", states: ["new", "planned"] },
  { id: "work", title: "В работе", hint: "Исполнитель уже подключен", states: ["running"] },
  { id: "review", title: "Review", hint: "Код, логика или результат на проверке", states: ["review"] },
  { id: "qc", title: "QC", hint: "Финальный контроль качества", states: ["qc"] },
  { id: "done", title: "Готово", hint: "Закрытые и отданные результаты", states: ["done", "verified"] },
  { id: "blocked", title: "Блокеры", hint: "Нужна реакция владельца", states: ["blocked", "failed"] },
];

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
  draft: "черновик",
  verified: "проверено",
  archived: "архив",
  active: "активен",
  inactive: "выключен",
  unknown: "неизвестно",
  low: "низкий",
  normal: "обычный",
  high: "высокий",
  urgent: "срочно",
  medium: "средний",
};

function viewFromSearch(searchParams?: Record<string, string | string[] | undefined>): View {
  const raw = searchParams?.view;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return navItems.some((item) => item.view === value) ? value as View : "overview";
}

function viewHref(view: View) {
  return `${basePath || ""}/?view=${view}`;
}

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
  if (["active", "done", "verified", "passed"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["running", "qc", "review", "new", "planned"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["blocked", "failed", "inactive"].includes(status)) return "border-red-200 bg-red-50 text-red-700";
  return "border-border bg-muted text-muted-foreground";
}

function Sidebar({ activeView }: { activeView: View }) {
  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <div className="p-3">
        <a className="flex min-h-12 items-center gap-3 rounded-lg px-2" href={viewHref("overview")}>
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">AI</span>
          <span className="grid min-w-0 leading-tight">
            <strong className="truncate text-sm font-semibold">Dev Office</strong>
            <span className="truncate text-xs text-muted-foreground">Command Center</span>
          </span>
        </a>
      </div>
      <Separator />
      <nav className="grid gap-1 p-2">
        <p className="px-2 py-2 text-xs font-medium text-muted-foreground">Кабинет</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.view;
          return (
            <Button
              asChild
              className="h-10 justify-start gap-2 px-2"
              key={item.view}
              variant={active ? "secondary" : "ghost"}
            >
              <a href={viewHref(item.view)}>
                <Icon className="size-4" />
                <span>{item.label}</span>
              </a>
            </Button>
          );
        })}
      </nav>
      <div className="mt-auto p-3">
        <Card size="sm" className="bg-background shadow-none">
          <CardHeader>
            <CardTitle className="text-sm">AI Dev Office</CardTitle>
            <CardDescription>7 Hermes profiles</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </aside>
  );
}

function Header({
  activeView,
  connected,
  message,
}: {
  activeView: View;
  connected: boolean;
  message: string;
}) {
  const current = navItems.find((item) => item.view === activeView) ?? navItems[0];
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-h-14 items-center gap-3 px-4 lg:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-medium">{current.label}</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">{current.description}</p>
        </div>
        <Badge className={connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"} variant="outline">
          <CheckCircle2Icon className="size-3" />
          {message}
        </Badge>
      </div>
    </header>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: typeof ActivityIcon;
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <Card className="@container/card bg-gradient-to-t from-primary/5 to-card shadow-xs">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
        <CardAction>
          <Badge variant="outline">
            <Icon className="size-3" />
            live
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="text-sm text-muted-foreground">{description}</CardFooter>
    </Card>
  );
}

function TaskBoard({ tasks }: { tasks: TaskState[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex gap-2 overflow-x-auto border-b bg-muted/35 p-2">
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
      <div className="grid auto-cols-[minmax(250px,1fr)] grid-flow-col overflow-x-auto">
        {boardColumns.map((column) => {
          const columnTasks = tasks.filter((task) => column.states.includes(task.status));
          return (
            <section className="min-h-[520px] border-r bg-muted/30 p-2 last:border-r-0" id={`column-${column.id}`} key={column.id}>
              <Card size="sm" className="mb-2 shadow-none">
                <CardHeader>
                  <CardTitle>{column.title}</CardTitle>
                  <CardDescription>{column.hint}</CardDescription>
                  <CardAction>
                    <Badge variant="outline">{columnTasks.length}</Badge>
                  </CardAction>
                </CardHeader>
              </Card>
              <div className="grid gap-2">
                {columnTasks.length === 0 ? (
                  <Card size="sm" className="border-dashed shadow-none">
                    <CardContent className="flex min-h-20 items-center justify-center text-sm text-muted-foreground">Пусто</CardContent>
                  </Card>
                ) : null}
                {columnTasks.map((task) => (
                  <Card size="sm" className="shadow-xs" key={task.id}>
                    <CardHeader>
                      <CardDescription className="flex items-center justify-between gap-2">
                        <Badge className={toneClass(task.status)} variant="outline">{label(task.status)}</Badge>
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
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AgentList({ agents }: { agents: AgentState[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Агенты</CardTitle>
        <CardDescription>Runtime Hermes gateway</CardDescription>
        <CardAction>
          <BotIcon className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-0 p-0">
        {agents.map((agent) => (
          <div className="flex min-h-16 items-center gap-3 border-t px-4" key={agent.id}>
            <span className={`size-2 rounded-full ${agent.status === "active" ? "bg-emerald-300" : "bg-muted-foreground/30"}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{agent.name}</p>
              <p className="truncate text-xs text-muted-foreground">{agent.department} · {formatDate(agent.lastEvent)}</p>
            </div>
            <Badge className={toneClass(agent.status)} variant="outline">{label(agent.status)}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TaskForm({ routes, agents }: { routes: RouteRuleState[]; agents: AgentState[] }) {
  const selectClass = "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <form action={`${basePath}/api/tasks`} className="grid gap-3" method="post">
      <Textarea aria-label="Описание задачи" name="ownerRequest" placeholder="Сформулировать задачу для офиса..." required rows={5} />
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_0.8fr_auto]">
        <select aria-label="Маршрут" className={selectClass} defaultValue="feature_development" name="routeType">
          {routes.length > 0 ? routes.map((route) => <option value={route.routeType} key={route.routeType}>{route.name}</option>) : null}
          {routes.length === 0 ? <option value="feature_development">Feature development</option> : null}
        </select>
        <select aria-label="Отдел" className={selectClass} defaultValue="development" name="assignedDepartment">
          <option value="management">Management</option>
          <option value="development">Development</option>
          <option value="quality-control">Quality Control</option>
          <option value="materials-library">Materials Library</option>
        </select>
        <select aria-label="Агент" className={selectClass} defaultValue="dev-builder" name="assignedAgent">
          {agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}
        </select>
        <select aria-label="Приоритет" className={selectClass} defaultValue="normal" name="priority">
          <option value="low">Низкий</option>
          <option value="normal">Обычный</option>
          <option value="high">Высокий</option>
          <option value="urgent">Срочный</option>
        </select>
        <input type="hidden" name="riskLevel" value="medium" />
        <Button type="submit"><PlusIcon className="size-4" />Создать</Button>
      </div>
    </form>
  );
}

function MaterialForm() {
  const selectClass = "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <form action={`${basePath}/api/materials`} className="grid gap-3" method="post">
      <div className="grid gap-2 md:grid-cols-2">
        <Input aria-label="Название материала" name="title" placeholder="Название материала" required />
        <Input aria-label="Ссылка или путь к файлу" name="storageUri" placeholder="Ссылка или путь к файлу" required />
        <select aria-label="Тип материала" className={selectClass} defaultValue="instruction" name="materialType">
          <option value="instruction">Инструкция</option>
          <option value="report">Отчет</option>
          <option value="brief">Бриф</option>
          <option value="document">Документ</option>
        </select>
        <select aria-label="Статус материала" className={selectClass} defaultValue="draft" name="status">
          <option value="draft">Черновик</option>
          <option value="verified">Проверено</option>
        </select>
      </div>
      <Textarea aria-label="Краткое описание материала" name="sourceSummary" placeholder="Коротко: зачем этот материал нужен" rows={3} />
      <Button className="w-full md:w-fit" type="submit"><PlusIcon className="size-4" />Добавить</Button>
    </form>
  );
}

function TaskTable({ tasks }: { tasks: TaskState[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Задача</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Маршрут</TableHead>
          <TableHead>Агент</TableHead>
          <TableHead>Обновлена</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell>
              <div className="max-w-xl">
                <p className="line-clamp-1 font-medium">{task.title}</p>
                <p className="line-clamp-1 text-muted-foreground">{task.ownerRequest}</p>
              </div>
            </TableCell>
            <TableCell><Badge className={toneClass(task.status)} variant="outline">{label(task.status)}</Badge></TableCell>
            <TableCell>{task.routeType}</TableCell>
            <TableCell>{task.agent}</TableCell>
            <TableCell>{formatDate(task.updatedAt)}</TableCell>
          </TableRow>
        ))}
        {tasks.length === 0 ? <TableRow><TableCell colSpan={5}>Задач пока нет.</TableCell></TableRow> : null}
      </TableBody>
    </Table>
  );
}

function AgentTable({ agents }: { agents: AgentState[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Агент</TableHead>
          <TableHead>Отдел</TableHead>
          <TableHead>Gateway</TableHead>
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {agents.map((agent) => (
          <TableRow key={agent.id}>
            <TableCell className="font-medium">{agent.name}</TableCell>
            <TableCell>{agent.department}</TableCell>
            <TableCell className="max-w-lg truncate">{agent.service}</TableCell>
            <TableCell><Badge className={toneClass(agent.status)} variant="outline">{label(agent.status)}{agent.pid ? ` · ${agent.pid}` : ""}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MaterialTable({ materials }: { materials: MaterialState[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Материал</TableHead>
          <TableHead>Тип</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Хранилище</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {materials.map((material) => (
          <TableRow key={material.id}>
            <TableCell>
              <p className="font-medium">{material.title}</p>
              <p className="text-muted-foreground">v{material.version} · {formatDate(material.updatedAt)}</p>
            </TableCell>
            <TableCell>{label(material.type)}</TableCell>
            <TableCell><Badge className={toneClass(material.status)} variant="outline">{label(material.status)}</Badge></TableCell>
            <TableCell>{material.storageUri}</TableCell>
          </TableRow>
        ))}
        {materials.length === 0 ? <TableRow><TableCell colSpan={4}>Библиотека пока пустая.</TableCell></TableRow> : null}
      </TableBody>
    </Table>
  );
}

function RouteTable({ routes }: { routes: RouteRuleState[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Маршрут</TableHead>
          <TableHead>Отдел</TableHead>
          <TableHead>Исполнитель</TableHead>
          <TableHead>Контроль</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {routes.map((route) => (
          <TableRow key={route.routeType}>
            <TableCell>
              <p className="font-medium">{route.name}</p>
              <p className="text-muted-foreground">{route.routeType}</p>
            </TableCell>
            <TableCell>{route.department}</TableCell>
            <TableCell>{route.primaryAgent}</TableCell>
            <TableCell>{route.qcRequired ? "QC" : "без QC"}{route.approvalRequired ? " · approval" : ""}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function EventTable({ events }: { events: EventState[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Время</TableHead>
          <TableHead>Актор</TableHead>
          <TableHead>Событие</TableHead>
          <TableHead>Тип</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell>{formatDate(event.createdAt)}</TableCell>
            <TableCell>{event.actor}</TableCell>
            <TableCell>{event.message}</TableCell>
            <TableCell><Badge variant="outline">{event.eventType}</Badge></TableCell>
          </TableRow>
        ))}
        {events.length === 0 ? <TableRow><TableCell colSpan={4}>Событий пока нет.</TableCell></TableRow> : null}
      </TableBody>
    </Table>
  );
}

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const activeView = viewFromSearch(params);
  const state = await loadCommandCenterState();
  const openTasks = state.tasks.filter((task) => !["done", "cancelled", "failed"].includes(task.status));

  return (
    <main className="flex min-h-svh bg-background">
      <Sidebar activeView={activeView} />
      <section className="min-w-0 flex-1">
        <Header activeView={activeView} connected={state.database.connected} message={state.database.message} />
        <div className="mx-auto grid w-full max-w-[1680px] gap-4 p-4 lg:p-6">
          {activeView === "overview" ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={BotIcon} label="Агенты" value={`${state.totals.activeAgents}/${state.agents.length}`} description="активных gateway" />
                <StatCard icon={ClipboardListIcon} label="Открытые задачи" value={state.totals.openTasks} description={`${openTasks.length} требуют движения`} />
                <StatCard icon={LibraryIcon} label="Материалы" value={state.totals.materials} description="в библиотеке" />
                <StatCard icon={ShieldCheckIcon} label="QC ошибки" value={state.totals.failedQc} description="по последним проверкам" />
              </section>
              <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.45fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle>Доска задач</CardTitle>
                    <CardDescription>Основной поток AI Dev Office</CardDescription>
                    <CardAction><GitBranchIcon className="size-4 text-muted-foreground" /></CardAction>
                  </CardHeader>
                  <CardContent>
                    <TaskBoard tasks={state.tasks} />
                  </CardContent>
                </Card>
                <AgentList agents={state.agents} />
              </section>
            </>
          ) : null}

          {activeView === "tasks" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Новая задача</CardTitle>
                  <CardDescription>Создать запись в очереди офиса</CardDescription>
                </CardHeader>
                <CardContent><TaskForm routes={state.routes} agents={state.agents} /></CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Очередь задач</CardTitle>
                  <CardDescription>Канбан по текущим статусам</CardDescription>
                </CardHeader>
                <CardContent><TaskBoard tasks={state.tasks} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Таблица задач</CardTitle></CardHeader>
                <CardContent><TaskTable tasks={state.tasks} /></CardContent>
              </Card>
            </>
          ) : null}

          {activeView === "agents" ? (
            <Card>
              <CardHeader>
                <CardTitle>Runtime агентов</CardTitle>
                <CardDescription>Сервисы, PID и отделы</CardDescription>
              </CardHeader>
              <CardContent><AgentTable agents={state.agents} /></CardContent>
            </Card>
          ) : null}

          {activeView === "materials" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Добавить материал</CardTitle>
                  <CardDescription>Сохранить ссылку или файл в библиотеку</CardDescription>
                  <CardAction><ArchiveIcon className="size-4 text-muted-foreground" /></CardAction>
                </CardHeader>
                <CardContent><MaterialForm /></CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Библиотека материалов</CardTitle>
                  <CardAction><FileTextIcon className="size-4 text-muted-foreground" /></CardAction>
                </CardHeader>
                <CardContent><MaterialTable materials={state.materials} /></CardContent>
              </Card>
            </>
          ) : null}

          {activeView === "routes" ? (
            <Card>
              <CardHeader>
                <CardTitle>Route matrix</CardTitle>
                <CardDescription>Какие агенты принимают типовые процессы</CardDescription>
              </CardHeader>
              <CardContent><RouteTable routes={state.routes} /></CardContent>
            </Card>
          ) : null}

          {activeView === "events" ? (
            <Card>
              <CardHeader>
                <CardTitle>Журнал событий</CardTitle>
                <CardDescription>Последние события офиса</CardDescription>
              </CardHeader>
              <CardContent><EventTable events={state.events} /></CardContent>
            </Card>
          ) : null}
        </div>
      </section>
    </main>
  );
}
