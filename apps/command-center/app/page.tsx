import {
  Activity,
  AlertTriangle,
  Archive,
  Bot,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Database,
  FileText,
  Library,
  Plus,
  Route,
  ShieldCheck,
} from "lucide-react";
import { loadCommandCenterState } from "./lib/office";
import type { AgentState, EventState, MaterialState, RouteRuleState, TaskState } from "./lib/types";

export const dynamic = "force-dynamic";

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

function StatCard({ icon: Icon, label: title, value, caption }: {
  icon: typeof Activity;
  label: string;
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

function AgentRow({ agent }: { agent: AgentState }) {
  return (
    <article className="agent-row">
      <div className={`status-dot ${tone(agent.status)}`} />
      <div>
        <strong>{agent.name}</strong>
        <span>{agent.department} · {agent.service}</span>
      </div>
      <em>{label(agent.status)}{agent.pid ? ` · PID ${agent.pid}` : ""}</em>
    </article>
  );
}

function TaskCard({ task }: { task: TaskState }) {
  return (
    <article className="task-card">
      <header>
        <span className={`pill ${tone(task.status)}`}>{label(task.status)}</span>
        <span className="text-muted">{formatDate(task.updatedAt)}</span>
      </header>
      <h3>{task.title}</h3>
      <p>{task.ownerRequest}</p>
      <footer>
        <span>{task.routeType}</span>
        <span>{task.agent}</span>
        <span>{label(task.priority)}</span>
      </footer>
    </article>
  );
}

function MaterialRow({ material }: { material: MaterialState }) {
  return (
    <article className="material-row">
      <FileText size={18} />
      <div>
        <strong>{material.title}</strong>
        <span>{label(material.type)} · v{material.version} · {material.storageUri}</span>
      </div>
      <em className={`pill ${tone(material.status)}`}>{label(material.status)}</em>
    </article>
  );
}

function EventRow({ event }: { event: EventState }) {
  return (
    <article className="event-row">
      <span>{formatDate(event.createdAt)}</span>
      <strong>{event.actor}</strong>
      <p>{event.message}</p>
      <em className={`pill ${event.severity === "error" ? "bad" : event.severity === "warn" ? "work" : "muted"}`}>
        {event.eventType}
      </em>
    </article>
  );
}

function RouteRow({ route }: { route: RouteRuleState }) {
  return (
    <article className="route-row">
      <Route size={17} />
      <div>
        <strong>{route.name}</strong>
        <span>{route.department} → {route.primaryAgent}</span>
      </div>
      <em>{route.qcRequired ? "QC" : "без QC"}{route.approvalRequired ? " · approve" : ""}</em>
    </article>
  );
}

export default async function CommandCenterPage() {
  const state = await loadCommandCenterState();
  const openTasks = state.tasks.filter((task) => !["done", "cancelled", "failed"].includes(task.status));
  const latestTasks = state.tasks.slice(0, 8);
  const latestMaterials = state.materials.slice(0, 8);
  const latestEvents = state.events.slice(0, 10);

  return (
    <main className="office-shell">
      <aside className="side-rail" aria-label="Навигация">
        <div className="brand-mark">AO</div>
        <a href="#overview" aria-label="Обзор"><Activity size={20} /></a>
        <a href="#tasks" aria-label="Задачи"><ClipboardList size={20} /></a>
        <a href="#agents" aria-label="Агенты"><Bot size={20} /></a>
        <a href="#materials" aria-label="Материалы"><Library size={20} /></a>
        <a href="#events" aria-label="События"><Database size={20} /></a>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>AI Dev Office</p>
            <h1>Центр управления</h1>
          </div>
          <div className={`connection ${state.database.connected ? "good" : "bad"}`}>
            {state.database.connected ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{state.database.message}</span>
          </div>
        </header>

        <section className="metrics" id="overview">
          <StatCard icon={Bot} label="Агенты" value={`${state.totals.activeAgents}/${state.agents.length}`} caption="активных gateway" />
          <StatCard icon={ClipboardList} label="Открытые задачи" value={state.totals.openTasks} caption={`${openTasks.length} требуют движения`} />
          <StatCard icon={Library} label="Материалы" value={state.totals.materials} caption="в библиотеке" />
          <StatCard icon={ShieldCheck} label="QC ошибки" value={state.totals.failedQc} caption="по последним проверкам" />
        </section>

        <section className="main-grid">
          <section className="panel task-panel" id="tasks">
            <div className="panel-head">
              <div>
                <span>Очередь</span>
                <h2>Задачи</h2>
              </div>
              <CircleDot size={18} />
            </div>

            <form className="quick-form" action="/api/tasks" method="post">
              <textarea name="ownerRequest" rows={4} placeholder="Сформулировать задачу для офиса..." aria-label="Описание задачи" required />
              <div className="form-grid">
                <select name="routeType" defaultValue="feature_development" aria-label="Маршрут">
                  {state.routes.length > 0 ? state.routes.map((route) => (
                    <option value={route.routeType} key={route.routeType}>{route.name}</option>
                  )) : (
                    <>
                      <option value="feature_development">Feature development</option>
                      <option value="bugfix">Bug fix</option>
                      <option value="qa_review">QA review</option>
                      <option value="material_save">Material save</option>
                    </>
                  )}
                </select>
                <select name="assignedDepartment" defaultValue="development" aria-label="Отдел">
                  <option value="management">Management</option>
                  <option value="development">Development</option>
                  <option value="quality-control">Quality Control</option>
                  <option value="materials-library">Materials Library</option>
                </select>
                <select name="assignedAgent" defaultValue="dev-builder" aria-label="Агент">
                  {state.agents.map((agent) => (
                    <option value={agent.id} key={agent.id}>{agent.name}</option>
                  ))}
                </select>
                <select name="priority" defaultValue="normal" aria-label="Приоритет">
                  <option value="low">Низкий</option>
                  <option value="normal">Обычный</option>
                  <option value="high">Высокий</option>
                  <option value="urgent">Срочный</option>
                </select>
                <input type="hidden" name="riskLevel" value="medium" />
                <button type="submit"><Plus size={17} /> Создать</button>
              </div>
            </form>

            <div className="task-list">
              {latestTasks.length > 0 ? latestTasks.map((task) => <TaskCard task={task} key={task.id} />) : (
                <p className="empty-state">Задач пока нет. Создай первую задачу выше.</p>
              )}
            </div>
          </section>

          <section className="panel" id="agents">
            <div className="panel-head">
              <div>
                <span>Runtime</span>
                <h2>Агенты</h2>
              </div>
              <Bot size={18} />
            </div>
            <div className="agent-list">
              {state.agents.map((agent) => <AgentRow agent={agent} key={agent.id} />)}
            </div>
          </section>
        </section>

        <section className="lower-grid">
          <section className="panel" id="materials">
            <div className="panel-head">
              <div>
                <span>База знаний</span>
                <h2>Материалы</h2>
              </div>
              <Archive size={18} />
            </div>
            <form className="material-form" action="/api/materials" method="post">
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
              <textarea name="sourceSummary" rows={2} placeholder="Коротко: зачем этот материал нужен" aria-label="Краткое описание материала" />
              <button type="submit"><Plus size={17} /> Добавить</button>
            </form>
            <div className="material-list">
              {latestMaterials.length > 0 ? latestMaterials.map((material) => <MaterialRow material={material} key={material.id} />) : (
                <p className="empty-state">Библиотека пустая. Добавь ссылку, файл или инструкцию.</p>
              )}
            </div>
          </section>

          <section className="panel route-panel">
            <div className="panel-head">
              <div>
                <span>Маршруты</span>
                <h2>Процессы</h2>
              </div>
              <Route size={18} />
            </div>
            <div className="route-list">
              {state.routes.map((route) => <RouteRow route={route} key={route.routeType} />)}
              {state.routes.length === 0 ? <p className="empty-state">Route matrix появится после подключения Postgres.</p> : null}
            </div>
          </section>

          <section className="panel event-panel" id="events">
            <div className="panel-head">
              <div>
                <span>Журнал</span>
                <h2>События</h2>
              </div>
              <Database size={18} />
            </div>
            <div className="event-list">
              {latestEvents.map((event) => <EventRow event={event} key={event.id} />)}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
