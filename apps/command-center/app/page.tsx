import {
  Activity,
  AlertTriangle,
  Archive,
  Bot,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Columns3,
  Database,
  FileText,
  LayoutDashboard,
  Library,
  Plus,
  Route,
  ShieldCheck,
} from "lucide-react";
import { loadCommandCenterState } from "./lib/office";
import type { AgentState, EventState, MaterialState, RouteRuleState, TaskState } from "./lib/types";

export const dynamic = "force-dynamic";

type View = "overview" | "tasks" | "agents" | "materials" | "routes" | "events";

const basePath = process.env.NEXT_PUBLIC_COMMAND_CENTER_BASE_PATH ?? process.env.COMMAND_CENTER_BASE_PATH ?? "";

const navItems: Array<{ view: View; label: string; description: string; icon: typeof Activity }> = [
  { view: "overview", label: "Обзор", description: "Пульс офиса", icon: LayoutDashboard },
  { view: "tasks", label: "Задачи", description: "Очередь и статусы", icon: ClipboardList },
  { view: "agents", label: "Агенты", description: "Runtime gateway", icon: Bot },
  { view: "materials", label: "Материалы", description: "База знаний", icon: Library },
  { view: "routes", label: "Маршруты", description: "Процессы", icon: Route },
  { view: "events", label: "Журнал", description: "События", icon: Database },
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

function label(value: string) {
  return statusLabels[value] ?? value.replaceAll("_", " ");
}

function tone(status: string) {
  if (["active", "done", "verified", "passed"].includes(status)) return "good";
  if (["running", "qc", "review", "new", "planned"].includes(status)) return "work";
  if (["blocked", "failed", "inactive"].includes(status)) return "bad";
  return "muted";
}

function viewFromSearch(searchParams?: Record<string, string | string[] | undefined>): View {
  const raw = searchParams?.view;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return navItems.some((item) => item.view === value) ? value as View : "overview";
}

function viewHref(view: View) {
  return `${basePath || ""}/?view=${view}`;
}

function StatCard({ icon: Icon, title, value, caption }: {
  icon: typeof Activity;
  title: string;
  value: string | number;
  caption: string;
}) {
  return (
    <section className="stat-card">
      <div className="stat-icon"><Icon size={18} /></div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <p>{caption}</p>
      </div>
    </section>
  );
}

function Sidebar({ activeView }: { activeView: View }) {
  return (
    <aside className="office-sidebar">
      <a className="office-brand" href={viewHref("overview")}>
        <span>AI</span>
        <div>
          <strong>Dev Office</strong>
          <small>Command Center</small>
        </div>
      </a>
      <nav aria-label="Разделы центра управления">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <a href={viewHref(item.view)} className={activeView === item.view ? "is-active" : undefined} key={item.view}>
              <Icon size={18} />
              <span>{item.label}</span>
              <small>{item.description}</small>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

function PageHeader({ activeView, connected, message }: { activeView: View; connected: boolean; message: string }) {
  const current = navItems.find((item) => item.view === activeView) ?? navItems[0];
  return (
    <header className="page-header">
      <div>
        <span>Живой офис агентов</span>
        <h1>{current.label}</h1>
        <p>{current.description}</p>
      </div>
      <div className={`connection ${connected ? "good" : "bad"}`}>
        {connected ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
        <span>{message}</span>
      </div>
    </header>
  );
}

const boardColumns = [
  { id: "planned", title: "План", hint: "сформулированы и ждут движения", states: ["new", "planned"] },
  { id: "work", title: "В работе", hint: "исполнитель уже подключен", states: ["running"] },
  { id: "review", title: "Review", hint: "код, логика или результат на проверке", states: ["review"] },
  { id: "qc", title: "QC", hint: "финальный контроль качества", states: ["qc"] },
  { id: "done", title: "Готово", hint: "закрытые и отданные результаты", states: ["done", "verified"] },
  { id: "blocked", title: "Блокеры", hint: "нужна реакция владельца", states: ["blocked", "failed"] },
];

function TaskBoard({ tasks }: { tasks: TaskState[] }) {
  return (
    <div className="board-shell" aria-label="Доска задач">
      <div className="board-tabs">
        {boardColumns.map((column) => {
          const count = tasks.filter((task) => column.states.includes(task.status)).length;
          return (
            <a href={`#column-${column.id}`} key={column.id}>
              {column.title}
              <span>{count}</span>
            </a>
          );
        })}
      </div>
      <div className="board-grid">
        {boardColumns.map((column) => {
          const columnTasks = tasks.filter((task) => column.states.includes(task.status));
          return (
            <section className="board-column" id={`column-${column.id}`} key={column.id}>
              <header>
                <div>
                  <h3>{column.title}</h3>
                  <p>{column.hint}</p>
                </div>
                <span>{columnTasks.length}</span>
              </header>
              <div className="board-cards">
                {columnTasks.length === 0 ? (
                  <div className="empty-card">
                    <CircleDot size={16} />
                    <span>Пусто</span>
                  </div>
                ) : null}
                {columnTasks.map((task) => (
                  <article className="task-card" key={task.id}>
                    <div className="task-card-top">
                      <span className={`pill ${tone(task.status)}`}>{label(task.status)}</span>
                      <small>{formatDate(task.updatedAt)}</small>
                    </div>
                    <h4>{task.title}</h4>
                    <p>{task.ownerRequest}</p>
                    <footer>
                      <span>{task.agent}</span>
                      <span>{label(task.priority)}</span>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function AgentRoster({ agents }: { agents: AgentState[] }) {
  return (
    <div className="agent-roster">
      {agents.map((agent) => (
        <article className="agent-row" key={agent.id}>
          <span className={`dot ${tone(agent.status)}`} />
          <div>
            <strong>{agent.name}</strong>
            <small>{agent.department}{agent.lastEvent ? ` · ${formatDate(agent.lastEvent)}` : ""}</small>
          </div>
          <span className={`pill ${tone(agent.status)}`}>{label(agent.status)}{agent.pid ? ` · PID ${agent.pid}` : ""}</span>
        </article>
      ))}
    </div>
  );
}

function AgentTable({ agents }: { agents: AgentState[] }) {
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            <th>Агент</th>
            <th>Отдел</th>
            <th>Gateway</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.id}>
              <th scope="row">
                <span className={`dot ${tone(agent.status)}`} />
                {agent.name}
              </th>
              <td>{agent.department}</td>
              <td>{agent.service}</td>
              <td><span className={`pill ${tone(agent.status)}`}>{label(agent.status)}{agent.pid ? ` · ${agent.pid}` : ""}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskTable({ tasks }: { tasks: TaskState[] }) {
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            <th>Задача</th>
            <th>Статус</th>
            <th>Маршрут</th>
            <th>Агент</th>
            <th>Обновлена</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <th scope="row">
                <strong>{task.title}</strong>
                <small>{task.ownerRequest}</small>
              </th>
              <td><span className={`pill ${tone(task.status)}`}>{label(task.status)}</span></td>
              <td>{task.routeType}</td>
              <td>{task.agent}</td>
              <td>{formatDate(task.updatedAt)}</td>
            </tr>
          ))}
          {tasks.length === 0 ? <tr><td colSpan={5}>Задач пока нет.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function MaterialTable({ materials }: { materials: MaterialState[] }) {
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            <th>Материал</th>
            <th>Тип</th>
            <th>Статус</th>
            <th>Хранилище</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material) => (
            <tr key={material.id}>
              <th scope="row">
                <strong>{material.title}</strong>
                <small>v{material.version} · {formatDate(material.updatedAt)}</small>
              </th>
              <td>{label(material.type)}</td>
              <td><span className={`pill ${tone(material.status)}`}>{label(material.status)}</span></td>
              <td>{material.storageUri}</td>
            </tr>
          ))}
          {materials.length === 0 ? <tr><td colSpan={4}>Библиотека пока пустая.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function RouteTable({ routes }: { routes: RouteRuleState[] }) {
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            <th>Маршрут</th>
            <th>Отдел</th>
            <th>Исполнитель</th>
            <th>Контроль</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((route) => (
            <tr key={route.routeType}>
              <th scope="row">
                <strong>{route.name}</strong>
                <small>{route.routeType}</small>
              </th>
              <td>{route.department}</td>
              <td>{route.primaryAgent}</td>
              <td>{route.qcRequired ? "QC" : "без QC"}{route.approvalRequired ? " · approval" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventTable({ events }: { events: EventState[] }) {
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            <th>Время</th>
            <th>Актор</th>
            <th>Событие</th>
            <th>Тип</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{formatDate(event.createdAt)}</td>
              <td>{event.actor}</td>
              <td>{event.message}</td>
              <td><span className={`pill ${event.severity === "error" ? "bad" : event.severity === "warn" ? "work" : "muted"}`}>{event.eventType}</span></td>
            </tr>
          ))}
          {events.length === 0 ? <tr><td colSpan={4}>Событий пока нет.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function TaskForm({ routes, agents }: { routes: RouteRuleState[]; agents: AgentState[] }) {
  return (
    <form className="control-form" action={`${basePath}/api/tasks`} method="post">
      <textarea name="ownerRequest" rows={5} placeholder="Сформулировать задачу для офиса..." aria-label="Описание задачи" required />
      <div className="control-grid">
        <select name="routeType" defaultValue="feature_development" aria-label="Маршрут">
          {routes.length > 0 ? routes.map((route) => <option value={route.routeType} key={route.routeType}>{route.name}</option>) : null}
          {routes.length === 0 ? <option value="feature_development">Feature development</option> : null}
        </select>
        <select name="assignedDepartment" defaultValue="development" aria-label="Отдел">
          <option value="management">Management</option>
          <option value="development">Development</option>
          <option value="quality-control">Quality Control</option>
          <option value="materials-library">Materials Library</option>
        </select>
        <select name="assignedAgent" defaultValue="dev-builder" aria-label="Агент">
          {agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}
        </select>
        <select name="priority" defaultValue="normal" aria-label="Приоритет">
          <option value="low">Низкий</option>
          <option value="normal">Обычный</option>
          <option value="high">Высокий</option>
          <option value="urgent">Срочный</option>
        </select>
        <input type="hidden" name="riskLevel" value="medium" />
        <button type="submit"><Plus size={16} /> Создать</button>
      </div>
    </form>
  );
}

function MaterialForm() {
  return (
    <form className="control-form compact" action={`${basePath}/api/materials`} method="post">
      <input name="title" placeholder="Название материала" aria-label="Название материала" required />
      <input name="storageUri" placeholder="Ссылка или путь к файлу" aria-label="Ссылка или путь к файлу" required />
      <select name="materialType" defaultValue="instruction" aria-label="Тип материала">
        <option value="instruction">Инструкция</option>
        <option value="report">Отчет</option>
        <option value="brief">Бриф</option>
        <option value="document">Документ</option>
      </select>
      <select name="status" defaultValue="draft" aria-label="Статус материала">
        <option value="draft">Черновик</option>
        <option value="verified">Проверено</option>
      </select>
      <textarea name="sourceSummary" rows={3} placeholder="Коротко: зачем этот материал нужен" aria-label="Краткое описание материала" />
      <button type="submit"><Plus size={16} /> Добавить</button>
    </form>
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
    <main className="office-shell">
      <Sidebar activeView={activeView} />
      <section className="office-content">
        <PageHeader activeView={activeView} connected={state.database.connected} message={state.database.message} />

        {activeView === "overview" ? (
          <div className="view-stack">
            <section className="metrics">
              <StatCard icon={Bot} title="Агенты" value={`${state.totals.activeAgents}/${state.agents.length}`} caption="активных gateway" />
              <StatCard icon={ClipboardList} title="Открытые задачи" value={state.totals.openTasks} caption={`${openTasks.length} требуют движения`} />
              <StatCard icon={Library} title="Материалы" value={state.totals.materials} caption="в библиотеке" />
              <StatCard icon={ShieldCheck} title="QC ошибки" value={state.totals.failedQc} caption="по последним проверкам" />
            </section>
            <section className="split-grid">
              <div className="panel">
                <div className="panel-head"><h2>Доска задач</h2><Columns3 size={18} /></div>
                <TaskBoard tasks={state.tasks} />
              </div>
              <div className="panel">
                <div className="panel-head"><h2>Агенты</h2><Bot size={18} /></div>
                <AgentRoster agents={state.agents} />
              </div>
            </section>
          </div>
        ) : null}

        {activeView === "tasks" ? (
          <div className="view-stack">
            <section className="panel">
              <div className="panel-head"><h2>Новая задача</h2><Plus size={18} /></div>
              <TaskForm routes={state.routes} agents={state.agents} />
            </section>
            <section className="panel">
              <div className="panel-head"><h2>Очередь задач</h2><Columns3 size={18} /></div>
              <TaskBoard tasks={state.tasks} />
            </section>
            <section className="panel">
              <div className="panel-head"><h2>Таблица задач</h2><ClipboardList size={18} /></div>
              <TaskTable tasks={state.tasks} />
            </section>
          </div>
        ) : null}

        {activeView === "agents" ? (
          <section className="panel"><div className="panel-head"><h2>Runtime агентов</h2><Bot size={18} /></div><AgentTable agents={state.agents} /></section>
        ) : null}

        {activeView === "materials" ? (
          <div className="view-stack">
            <section className="panel"><div className="panel-head"><h2>Добавить материал</h2><Archive size={18} /></div><MaterialForm /></section>
            <section className="panel"><div className="panel-head"><h2>Библиотека материалов</h2><FileText size={18} /></div><MaterialTable materials={state.materials} /></section>
          </div>
        ) : null}

        {activeView === "routes" ? (
          <section className="panel"><div className="panel-head"><h2>Route matrix</h2><Route size={18} /></div><RouteTable routes={state.routes} /></section>
        ) : null}

        {activeView === "events" ? (
          <section className="panel"><div className="panel-head"><h2>Журнал событий</h2><Database size={18} /></div><EventTable events={state.events} /></section>
        ) : null}
      </section>
    </main>
  );
}
