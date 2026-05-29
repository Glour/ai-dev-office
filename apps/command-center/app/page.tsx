import {
  ActivityIcon,
  ArchiveIcon,
  BotIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  DatabaseIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  NetworkIcon,
  PlusIcon,
  RouteIcon,
  ShieldCheckIcon,
  KeyRoundIcon,
  WrenchIcon,
} from "lucide-react";
import { DepartmentsOrgChart } from "@/components/dashboard/departments-org-chart";
import { FileDropzone } from "@/components/dashboard/file-dropzone";
import { LiveTaskTable } from "@/components/dashboard/live-task-table";
import { MaterialLibrary } from "@/components/dashboard/material-library";
import { TaskForm } from "@/components/dashboard/task-form";
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
import { SelectField } from "@/components/ui/select-field";
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
import { loadCommandCenterState, secretsVaultStatus } from "./lib/office";
import type { AgentState, CapabilityState, EventState, RouteRuleState, SecretState } from "./lib/types";

export const dynamic = "force-dynamic";

type View = "overview" | "tasks" | "departments" | "agents" | "materials" | "capabilities" | "secrets" | "routes" | "events";

const basePath = process.env.NEXT_PUBLIC_COMMAND_CENTER_BASE_PATH ?? process.env.COMMAND_CENTER_BASE_PATH ?? "";

const navItems: Array<{ view: View; label: string; description: string; icon: typeof ActivityIcon }> = [
  { view: "overview", label: "Обзор", description: "Пульс офиса", icon: LayoutDashboardIcon },
  { view: "tasks", label: "Задачи", description: "Очередь и статусы", icon: ClipboardListIcon },
  { view: "departments", label: "Отделы", description: "Оргструктура и ответственность", icon: NetworkIcon },
  { view: "agents", label: "Агенты", description: "Runtime gateway", icon: BotIcon },
  { view: "materials", label: "Материалы", description: "База знаний", icon: LibraryIcon },
  { view: "capabilities", label: "Навыки", description: "Skills и tools", icon: WrenchIcon },
  { view: "secrets", label: "Секреты", description: "Encrypted vault", icon: KeyRoundIcon },
  { view: "routes", label: "Маршруты", description: "Процессы", icon: RouteIcon },
  { view: "events", label: "Журнал", description: "События", icon: DatabaseIcon },
];

const statusLabels: Record<string, string> = {
  new: "новая",
  planned: "запланирована",
  running: "в работе",
  waiting_owner: "требуется действие владельца",
  blocked: "блокер",
  review: "review",
  qc: "QC",
  done: "готово",
  cancelled: "отменена",
  failed: "ошибка",
  rejected: "отклонена",
  draft: "черновик",
  verified: "проверено",
  archived: "архив",
  active: "активен",
  inactive: "выключен",
  disabled: "выключен",
  login: "логин",
  api_key: "API key",
  ssh_key: "SSH key",
  token: "токен",
  cookie: "cookie",
  env: "env",
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

function selectedTaskFromSearch(searchParams?: Record<string, string | string[] | undefined>) {
  const raw = searchParams?.task;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.length > 0 ? value : undefined;
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
    timeZone: "Europe/Moscow",
  }).format(date);
}

function toneClass(status: string) {
  if (["active", "done", "verified", "passed"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["running", "qc", "review", "new", "planned", "waiting_owner"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["blocked", "failed", "inactive"].includes(status)) return "border-red-200 bg-red-50 text-red-700";
  if (status === "rejected") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-border bg-muted text-muted-foreground";
}

function Sidebar({ activeView }: { activeView: View }) {
  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <div className="flex min-h-14 items-center px-3">
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
            <CardDescription>12 Hermes profiles</CardDescription>
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
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden" aria-label="Разделы центра управления">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              asChild
              className="h-8 shrink-0 gap-1.5 px-2"
              key={item.view}
              size="sm"
              variant={activeView === item.view ? "secondary" : "ghost"}
            >
              <a href={viewHref(item.view)}>
                <Icon className="size-3.5" />
                {item.label}
              </a>
            </Button>
          );
        })}
      </nav>
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
    <Card className="@container/card shadow-xs">
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

function AgentSummary({ agents }: { agents: AgentState[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Состояние агентов</CardTitle>
        <CardDescription>Короткая сводка runtime без боковой панели</CardDescription>
        <CardAction>
          <Button asChild size="sm" variant="outline">
            <a href={viewHref("agents")}>Все агенты</a>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {agents.map((agent) => (
            <div className="flex min-h-12 items-center gap-2 rounded-lg border bg-background px-3" key={agent.id}>
              <span className={`size-2 rounded-full ${agent.status === "active" ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{agent.name}</p>
                <p className="truncate text-xs text-muted-foreground">{agent.department}</p>
              </div>
              <Badge className={toneClass(agent.status)} variant="outline">{label(agent.status)}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MaterialForm() {
  return (
    <form action={`${basePath}/api/materials`} className="grid gap-3" encType="multipart/form-data" method="post">
      <div className="grid gap-2 md:grid-cols-2">
        <Input aria-label="Название материала" name="title" placeholder="Название материала или папки" />
        <Input aria-label="Ссылка или путь к файлу" name="storageUri" placeholder="Ссылка, если материал уже где-то лежит" />
        <SelectField aria-label="Тип материала" defaultValue="instruction" name="materialType">
          <option value="instruction">Инструкция</option>
          <option value="report">Отчет</option>
          <option value="brief">Бриф</option>
          <option value="document">Документ</option>
        </SelectField>
        <SelectField aria-label="Статус материала" defaultValue="draft" name="status">
          <option value="draft">Черновик</option>
          <option value="verified">Проверено</option>
        </SelectField>
      </div>
      <FileDropzone description="Можно загрузить один или несколько файлов; каждый станет отдельным материалом библиотеки." />
      <Textarea aria-label="Краткое описание материала" name="sourceSummary" placeholder="Коротко: зачем этот материал нужен" rows={3} />
      <Button className="w-full md:w-fit" type="submit"><PlusIcon className="size-4" />Добавить</Button>
    </form>
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

function CapabilityManager({ agents, capabilities }: { agents: AgentState[]; capabilities: CapabilityState[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Добавить навык или инструмент</CardTitle>
          <CardDescription>Задайте зону видимости: весь офис, отдел или конкретный агент.</CardDescription>
        </CardHeader>
        <CardContent>
          <CapabilityForm agents={agents} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Каталог навыков и инструментов</CardTitle>
          <CardDescription>Редактируемый список того, чем могут пользоваться отделы и агенты.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {capabilities.map((capability) => (
            <details className="rounded-xl border bg-background p-4" key={capability.id}>
              <summary className="cursor-pointer list-none">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                    {capability.type === "tool" ? <WrenchIcon className="size-4" /> : <span className="text-sm font-semibold">S</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{capability.name}</p>
                      <Badge variant="outline">{capability.type === "tool" ? "инструмент" : "скилл"}</Badge>
                      <Badge className={toneClass(capability.status)} variant="outline">{label(capability.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{capability.description || "Описание не задано"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {capability.scopeAgent ? `агент: ${capability.scopeAgent}` : capability.scopeDepartment ? `отдел: ${capability.scopeDepartment}` : "весь офис"}
                    </p>
                  </div>
                </div>
              </summary>
              <div className="mt-4 border-t pt-4">
                <CapabilityForm agents={agents} capability={capability} />
              </div>
            </details>
          ))}
          {capabilities.length === 0 ? <p className="text-sm text-muted-foreground">Навыки и инструменты пока не заведены.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function CapabilityForm({ agents, capability }: { agents: AgentState[]; capability?: CapabilityState }) {
  const departments = Array.from(new Set(agents.map((agent) => agent.department))).sort();
  return (
    <form action={`${basePath}/api/capabilities`} className="grid gap-3" method="post">
      <input name="id" type="hidden" value={capability?.id ?? ""} />
      <div className="grid gap-2 sm:grid-cols-2">
        <SelectField aria-label="Тип" defaultValue={capability?.type ?? "skill"} name="capabilityType">
          <option value="skill">Скилл</option>
          <option value="tool">Инструмент</option>
        </SelectField>
        <SelectField aria-label="Статус" defaultValue={capability?.status ?? "active"} name="status">
          <option value="active">Активен</option>
          <option value="draft">Черновик</option>
          <option value="disabled">Выключен</option>
        </SelectField>
      </div>
      <Input aria-label="Название" defaultValue={capability?.name ?? ""} name="name" placeholder="Название" required />
      <Input aria-label="Slug" defaultValue={capability?.slug ?? ""} name="slug" placeholder="slug-название" required />
      <div className="grid gap-2 sm:grid-cols-2">
        <SelectField aria-label="Отдел" defaultValue={capability?.scopeDepartment ?? ""} name="scopeDepartment">
          <option value="">Весь офис</option>
          {departments.map((department) => <option key={department} value={department}>{department}</option>)}
        </SelectField>
        <SelectField aria-label="Агент" defaultValue={capability?.scopeAgent ?? ""} name="scopeAgent">
          <option value="">Не ограничивать агентом</option>
          {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
        </SelectField>
      </div>
      <Textarea aria-label="Описание" defaultValue={capability?.description ?? ""} name="description" placeholder="Что это дает офису" rows={3} />
      <Textarea aria-label="Инструкции" defaultValue={capability?.instructions ?? ""} name="instructions" placeholder="Инструкции, правила использования, промпт или policy" rows={6} />
      <Textarea aria-label="Конфиг JSON" className="font-mono text-xs" defaultValue={capability?.config ?? "{}"} name="config" placeholder='{"visibility":"department"}' rows={4} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit"><PlusIcon className="size-4" />{capability ? "Сохранить" : "Добавить"}</Button>
        {capability ? (
          <Button name="action" type="submit" value="delete" variant="destructive">Удалить</Button>
        ) : null}
      </div>
    </form>
  );
}

function SecretsVault({ agents, secrets }: { agents: AgentState[]; secrets: SecretState[] }) {
  const vault = secretsVaultStatus();
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Добавить секрет</CardTitle>
          <CardDescription>Значение шифруется на сервере и не показывается обратно в интерфейсе.</CardDescription>
          <CardAction>
            <Badge className={vault.configured ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"} variant="outline">
              {vault.configured ? "vault key ok" : "vault key missing"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <SecretForm agents={agents} disabled={!vault.configured} />
          {!vault.configured ? <p className="mt-3 text-sm text-red-600">{vault.message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Хранилище секретов</CardTitle>
          <CardDescription>В UI видны только метаданные и ссылка вида secret://slug. Открытый текст не возвращается.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {secrets.map((secret) => (
            <div className="rounded-xl border bg-background p-4" key={secret.id}>
              <div className="flex items-start gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <KeyRoundIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{secret.name}</p>
                    <Badge variant="outline">{label(secret.type)}</Badge>
                    <Badge className={toneClass(secret.status)} variant="outline">{label(secret.status)}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">secret://{secret.slug}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{secret.description || "Описание не задано"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {secret.scopeAgent ? `агент: ${secret.scopeAgent}` : secret.scopeDepartment ? `отдел: ${secret.scopeDepartment}` : "весь офис"}
                    {secret.fingerprint ? ` · fp:${secret.fingerprint}` : ""}
                  </p>
                </div>
                <form action={`${basePath}/api/secrets`} method="post">
                  <input name="id" type="hidden" value={secret.id} />
                  <Button name="action" size="sm" type="submit" value="delete" variant="destructive">Удалить</Button>
                </form>
              </div>
            </div>
          ))}
          {secrets.length === 0 ? <p className="text-sm text-muted-foreground">Секретов пока нет.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SecretForm({ agents, disabled }: { agents: AgentState[]; disabled: boolean }) {
  const departments = Array.from(new Set(agents.map((agent) => agent.department))).sort();
  return (
    <form action={`${basePath}/api/secrets`} className="grid gap-3" method="post">
      <fieldset className="grid gap-3" disabled={disabled}>
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField aria-label="Тип секрета" defaultValue="generic" name="secretType">
            <option value="generic">Generic</option>
            <option value="login">Login/password</option>
            <option value="api_key">API key</option>
            <option value="ssh_key">SSH key</option>
            <option value="token">Token</option>
            <option value="cookie">Cookie</option>
            <option value="env">Env</option>
          </SelectField>
          <SelectField aria-label="Статус" defaultValue="active" name="status">
            <option value="active">Активен</option>
            <option value="disabled">Выключен</option>
          </SelectField>
        </div>
        <Input aria-label="Название секрета" name="name" placeholder="Название" required />
        <Input aria-label="Slug секрета" name="slug" placeholder="slug для secret://slug" required />
        <div className="grid gap-2 sm:grid-cols-2">
          <SelectField aria-label="Отдел" defaultValue="" name="scopeDepartment">
            <option value="">Весь офис</option>
            {departments.map((department) => <option key={department} value={department}>{department}</option>)}
          </SelectField>
          <SelectField aria-label="Агент" defaultValue="" name="scopeAgent">
            <option value="">Не ограничивать агентом</option>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </SelectField>
        </div>
        <Textarea aria-label="Описание секрета" name="description" placeholder="Для чего нужен секрет и кто может использовать" rows={3} />
        <Textarea aria-label="Значение секрета" className="font-mono text-xs" name="secretValue" placeholder="Вставьте пароль, токен, SSH private key или JSON credentials" required rows={8} />
        <Button type="submit"><KeyRoundIcon className="size-4" />Зашифровать и сохранить</Button>
      </fieldset>
    </form>
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
  const selectedTaskId = selectedTaskFromSearch(params);
  const state = await loadCommandCenterState();
  const openTasks = state.tasks.filter((task) => !["done", "archived", "cancelled", "failed", "rejected"].includes(task.status));

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
              <Card>
                <CardHeader>
                  <CardTitle>Последние задачи</CardTitle>
                  <CardDescription>Live-таблица: статус, прогресс, карточка результата</CardDescription>
                  <CardAction>
                    <Button asChild size="sm" variant="outline">
                      <a href={viewHref("tasks")}>Открыть задачи</a>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent><LiveTaskTable initialSelectedTaskId={selectedTaskId} initialState={state} limit={12} /></CardContent>
              </Card>
              <AgentSummary agents={state.agents} />
            </>
          ) : null}

          {activeView === "tasks" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Новая задача</CardTitle>
                  <CardDescription>Отправить запрос главному ассистенту: маршрут и исполнителей определит офис</CardDescription>
                </CardHeader>
                <CardContent><TaskForm action={`${basePath}/api/tasks`} /></CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Задачи</CardTitle>
                  <CardDescription>Live-список без канбана: клик по строке открывает карточку задачи</CardDescription>
                </CardHeader>
                <CardContent><LiveTaskTable initialSelectedTaskId={selectedTaskId} initialState={state} /></CardContent>
              </Card>
            </>
          ) : null}

          {activeView === "departments" ? (
            <DepartmentsOrgChart agents={state.agents} departments={state.departments} routes={state.routes} />
          ) : null}

          {activeView === "agents" ? (
            <>
              <AgentList agents={state.agents} />
              <Card>
                <CardHeader>
                  <CardTitle>Runtime агентов</CardTitle>
                  <CardDescription>Сервисы, PID и отделы</CardDescription>
                </CardHeader>
                <CardContent><AgentTable agents={state.agents} /></CardContent>
              </Card>
            </>
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
                <CardContent><MaterialLibrary materials={state.materials} /></CardContent>
              </Card>
            </>
          ) : null}

          {activeView === "capabilities" ? (
            <CapabilityManager agents={state.agents} capabilities={state.capabilities} />
          ) : null}

          {activeView === "secrets" ? (
            <SecretsVault agents={state.agents} secrets={state.secrets} />
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
