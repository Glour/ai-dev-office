import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { Pool } from "pg";
import type {
  AgentState,
  CapabilityState,
  CommandCenterState,
  EventState,
  DepartmentState,
  MaterialState,
  RouteRuleState,
  TaskState,
} from "./types";

const execFileAsync = promisify(execFile);

const agentDirectory = [
  { id: "owner-assistant", name: "Owner Assistant", department: "management" },
  { id: "orchestrator", name: "Orchestrator", department: "management" },
  { id: "dev-builder", name: "Dev Builder", department: "development" },
  { id: "dev-reviewer", name: "Dev Reviewer", department: "development" },
  { id: "qa-lead", name: "QA Lead", department: "quality-control" },
  { id: "seo-strategist", name: "SEO Strategist", department: "marketing" },
  { id: "marketing-researcher", name: "Marketing Researcher", department: "marketing" },
  { id: "content-writer", name: "Content Writer", department: "marketing" },
  { id: "ads-specialist", name: "Ads Specialist", department: "marketing" },
  { id: "security-officer", name: "Security Officer", department: "security" },
  { id: "materials-librarian", name: "Materials Librarian", department: "materials-library" },
  { id: "daily-auditor", name: "Daily Auditor", department: "quality-control" },
] as const;

const departmentDirectory: DepartmentState[] = [
  {
    id: "management",
    name: "Управление",
    mission: "Принимать задачи владельца, классифицировать запросы, запускать маршруты и возвращать понятный результат.",
    lead: "owner-assistant",
    responsibilities: ["единая точка входа", "маршрутизация", "приоритизация", "отчет владельцу"],
    tools: ["Postgres tasks", "Hermes dispatcher", "Command Center"],
    flows: ["owner_request", "route_selection", "handoff", "final_report"],
    products: ["план задачи", "статус", "финальный отчет"],
    agentIds: ["owner-assistant", "orchestrator"],
    routeTypes: ["owner_request", "feature_development", "bugfix", "content_production", "ad_campaign", "security_review"],
  },
  {
    id: "development",
    name: "Разработка",
    mission: "Делать изменения кода только через Codex CLI, проверки и ревью.",
    lead: "dev-builder",
    responsibilities: ["реализация", "bugfix", "детерминированные проверки", "code review"],
    tools: ["tools/codex-cli/run-codex-task.sh", "tools/codex-cli/review-codex-task.sh", "tests/lint/build"],
    flows: ["feature_development", "bugfix"],
    products: ["patch", "review report", "build/test output"],
    agentIds: ["dev-builder", "dev-reviewer"],
    routeTypes: ["feature_development", "bugfix"],
  },
  {
    id: "quality-control",
    name: "Контроль качества",
    mission: "Не выпускать владельцу непроверенные, сломанные или рискованные результаты.",
    lead: "qa-lead",
    responsibilities: ["acceptance gates", "browser/UI QA", "регрессия", "ежедневный аудит"],
    tools: ["tools/universal-qa", "qc/acceptance-gates.yaml", "events/incidents"],
    flows: ["qa_review", "daily_audit"],
    products: ["qc_results", "release checklist", "daily audit"],
    agentIds: ["qa-lead", "daily-auditor"],
    routeTypes: ["qa_review", "daily_audit"],
  },
  {
    id: "marketing",
    name: "Маркетинг",
    mission: "Производить доказательный контент, SEO-структуру, исследования и рекламные кампании под один проект.",
    lead: "seo-strategist",
    responsibilities: ["SEO brief", "research report", "content draft", "SEO review", "рекламные кампании и аналитика"],
    tools: ["web research", "source ledger", "style guide", "Yandex Metrica", "Yandex Direct", "Yandex Webmaster"],
    flows: ["content_production", "seo_brief", "marketing_research", "content_rewrite", "seo_review", "ad_campaign"],
    products: ["SEO brief", "research report", "draft", "SEO review", "ad plan", "campaign report"],
    agentIds: ["seo-strategist", "marketing-researcher", "content-writer", "ads-specialist"],
    routeTypes: ["content_production", "seo_brief", "marketing_research", "content_rewrite", "seo_review", "ad_campaign"],
  },
  {
    id: "security",
    name: "Безопасность",
    mission: "Проверять продукты, задачи, интеграции и артефакты на риски до запуска и публикации.",
    lead: "security-officer",
    responsibilities: ["threat modeling", "secret exposure", "dependency risk", "access control", "security acceptance"],
    tools: ["security checklist", "dependency audit", "logs/events", "secret redaction"],
    flows: ["security_review", "release_security_gate", "incident_review"],
    products: ["risk assessment", "security findings", "go/no-go decision"],
    agentIds: ["security-officer"],
    routeTypes: ["security_review", "release_security_gate"],
  },
  {
    id: "materials-library",
    name: "Библиотека материалов",
    mission: "Хранить только проверенные и переиспользуемые материалы проекта.",
    lead: "materials-librarian",
    responsibilities: ["версионирование", "каталогизация", "сохранение финальных материалов", "поиск знаний"],
    tools: ["materials table", "artifacts", "memory"],
    flows: ["material_save"],
    products: ["verified material", "style guide", "source ledger", "reusable report"],
    agentIds: ["materials-librarian"],
    routeTypes: ["material_save"],
  },
];

let pool: Pool | null = null;

const repoPath = process.env.AI_DEV_OFFICE_REPO ?? process.cwd().replace(/\/apps\/command-center$/, "");

type RouteStep = {
  title: string;
  assignedAgent: string;
  toolName?: string;
};

const routeFlows: Record<string, RouteStep[]> = {
  owner_request: [
    { title: "Прием задачи владельца", assignedAgent: "owner-assistant" },
    { title: "Классификация и выбор маршрута", assignedAgent: "orchestrator" },
    { title: "Постановка задачи ответственному отделу", assignedAgent: "orchestrator" },
    { title: "Контроль результата", assignedAgent: "qa-lead" },
    { title: "Отчет владельцу", assignedAgent: "owner-assistant" },
  ],
  feature_development: [
    { title: "Классификация запроса и постановка маршрута", assignedAgent: "orchestrator" },
    { title: "Реализация через Codex CLI", assignedAgent: "dev-builder", toolName: "tools/codex-cli/run-codex-task.sh" },
    { title: "Детерминированные проверки", assignedAgent: "dev-builder" },
    { title: "Code review через Codex CLI", assignedAgent: "dev-reviewer", toolName: "tools/codex-cli/review-codex-task.sh" },
    { title: "Финальный QC", assignedAgent: "qa-lead", toolName: "tools/universal-qa" },
    { title: "Сохранение материалов", assignedAgent: "materials-librarian" },
    { title: "Отчет владельцу", assignedAgent: "owner-assistant" },
  ],
  bugfix: [
    { title: "Классификация бага и маршрута", assignedAgent: "orchestrator" },
    { title: "Исправление через Codex CLI", assignedAgent: "dev-builder", toolName: "tools/codex-cli/run-codex-task.sh" },
    { title: "Регрессионные проверки", assignedAgent: "dev-builder" },
    { title: "Review исправления", assignedAgent: "dev-reviewer", toolName: "tools/codex-cli/review-codex-task.sh" },
    { title: "QC решение", assignedAgent: "qa-lead", toolName: "tools/universal-qa" },
    { title: "Отчет владельцу", assignedAgent: "owner-assistant" },
  ],
  qa_review: [
    { title: "Выбор проверок", assignedAgent: "qa-lead" },
    { title: "Запуск Universal QA", assignedAgent: "qa-lead", toolName: "tools/universal-qa" },
    { title: "QC решение", assignedAgent: "qa-lead" },
  ],
  material_save: [
    { title: "Проверка материала", assignedAgent: "materials-librarian" },
    { title: "Версионирование и сохранение", assignedAgent: "materials-librarian" },
    { title: "Отчет владельцу", assignedAgent: "owner-assistant" },
  ],
  daily_audit: [
    { title: "Анализ событий и инцидентов", assignedAgent: "daily-auditor" },
    { title: "Формирование улучшений", assignedAgent: "daily-auditor" },
    { title: "Отчет владельцу", assignedAgent: "owner-assistant" },
  ],
  content_production: [
    { title: "Классификация контент-задачи", assignedAgent: "orchestrator" },
    { title: "SEO brief и поисковый интент", assignedAgent: "seo-strategist" },
    { title: "Research report и source ledger", assignedAgent: "marketing-researcher" },
    { title: "Draft по brief + research", assignedAgent: "content-writer" },
    { title: "SEO review и правки структуры", assignedAgent: "seo-strategist" },
    { title: "Content QC", assignedAgent: "qa-lead" },
    { title: "Сохранение reusable materials", assignedAgent: "materials-librarian" },
    { title: "Отчет владельцу", assignedAgent: "owner-assistant" },
  ],
  seo_brief: [
    { title: "SEO brief: интент, структура, запросы", assignedAgent: "seo-strategist" },
    { title: "Отчет владельцу", assignedAgent: "owner-assistant" },
  ],
  marketing_research: [
    { title: "Research report и source ledger", assignedAgent: "marketing-researcher" },
    { title: "Отчет владельцу", assignedAgent: "owner-assistant" },
  ],
  content_rewrite: [
    { title: "Редактура текста по brief/style guide", assignedAgent: "content-writer" },
    { title: "SEO review", assignedAgent: "seo-strategist" },
    { title: "Content QC", assignedAgent: "qa-lead" },
    { title: "Отчет владельцу", assignedAgent: "owner-assistant" },
  ],
  seo_review: [
    { title: "SEO review готового текста", assignedAgent: "seo-strategist" },
    { title: "Отчет владельцу", assignedAgent: "owner-assistant" },
  ],
  ad_campaign: [
    { title: "Классификация рекламной задачи", assignedAgent: "orchestrator" },
    { title: "Проверка цели, оффера и посадочной", assignedAgent: "ads-specialist" },
    { title: "План кампании и метрик", assignedAgent: "ads-specialist" },
    { title: "Настройка/проверка аналитики", assignedAgent: "ads-specialist" },
    { title: "Security/privacy review", assignedAgent: "security-officer" },
    { title: "QC рекламного запуска", assignedAgent: "qa-lead" },
    { title: "Отчет владельцу", assignedAgent: "owner-assistant" },
  ],
  security_review: [
    { title: "Классификация security-scope", assignedAgent: "orchestrator" },
    { title: "Threat model и checklist", assignedAgent: "security-officer" },
    { title: "Проверка секретов, доступов и зависимостей", assignedAgent: "security-officer" },
    { title: "Security decision", assignedAgent: "security-officer" },
    { title: "Отчет владельцу", assignedAgent: "owner-assistant" },
  ],
};

function stepsForRoute(routeType: string, primaryAgent: string): RouteStep[] {
  return routeFlows[routeType] ?? [
    { title: "Классификация и запуск задачи", assignedAgent: "orchestrator" },
    { title: "Выполнение основного шага", assignedAgent: primaryAgent },
    { title: "Контроль результата", assignedAgent: "qa-lead" },
    { title: "Отчет владельцу", assignedAgent: "owner-assistant" },
  ];
}

function rejectReasonForOwnerRequest(ownerRequest: string) {
  const normalized = ownerRequest.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Запрос отклонен: пустая формулировка. Опишите действие и ожидаемый результат.";
  }

  const hasLettersOrDigits = /[\p{L}\p{N}]/u.test(normalized);
  if (!hasLettersOrDigits) {
    return "Запрос отклонен: в нем нет осмысленного текста. Опишите действие и ожидаемый результат.";
  }

  const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const hasActionContext = /https?:\/\/|\/[\w.-]+|#[\w-]+|@\w+|\d/u.test(normalized);
  if (normalized.length <= 6 && words.length <= 1 && !hasActionContext) {
    return "Запрос отклонен: слишком короткая или неосмысленная формулировка. Сформулируйте задачу, действие и ожидаемый результат.";
  }

  if (normalized.length < 12 && words.length < 2 && !hasActionContext) {
    return "Запрос отклонен: недостаточно данных для маршрутизации. Сформулируйте задачу, действие и ожидаемый результат.";
  }

  return null;
}

async function createHermesKanbanTask(input: {
  taskId: string;
  title: string;
  body: string;
  assignee: string;
  routeType: string;
  priority: string;
  steps: RouteStep[];
}) {
  const hermesHome = process.env.HERMES_RUNTIME_HOME ?? `${process.env.HOME ?? "/root"}/.hermes-ai-dev-office`;
  const priorityMap: Record<string, string> = {
    low: "-10",
    normal: "0",
    high: "10",
    urgent: "20",
  };
  const body = [
    input.body,
    "",
    `Command Center task id: ${input.taskId}`,
    `Route: ${input.routeType}`,
    "Steps:",
    ...input.steps.map((step, index) => `${index + 1}. ${step.title} -> ${step.assignedAgent}${step.toolName ? ` (${step.toolName})` : ""}`),
  ].join("\n");

  const createArgs = [
    "kanban",
    "create",
    input.title,
    "--body",
    body,
    "--assignee",
    input.assignee,
    "--workspace",
    `dir:${repoPath}`,
    "--priority",
    priorityMap[input.priority] ?? "0",
    "--idempotency-key",
    `command-center:${input.taskId}`,
    "--created-by",
    "command-center",
    "--json",
  ];

  const env = {
    ...process.env,
    HERMES_HOME: hermesHome,
    AI_DEV_OFFICE_REPO: repoPath,
  };

  const { stdout } = await execFileAsync("hermes", createArgs, { env, timeout: 15000, maxBuffer: 1024 * 1024 });
  const created = JSON.parse(stdout) as { id?: string };
  if (!created.id) throw new Error("Hermes Kanban did not return a task id");

  const dispatch = await execFileAsync("hermes", ["kanban", "dispatch", "--max", "1", "--json"], {
    env,
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });

  return {
    hermesTaskId: created.id,
    dispatch: dispatch.stdout ? JSON.parse(dispatch.stdout) as unknown : null,
  };
}

function databaseUrl() {
  return process.env.DATABASE_URL
    ?? `postgres://${process.env.POSTGRES_USER ?? "ai_dev_office"}:${process.env.POSTGRES_PASSWORD ?? "change-me"}@${process.env.POSTGRES_HOST ?? "127.0.0.1"}:${process.env.POSTGRES_PORT ?? "5432"}/${process.env.POSTGRES_DB ?? "ai_dev_office"}`;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: 4,
      connectionTimeoutMillis: 1500,
      idleTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function queryRows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}

type HermesKanbanSnapshot = {
  id: string;
  status: string;
  assignee?: string | null;
  summary?: string | null;
  lastComment?: string | null;
  result?: string | null;
};

function commandCenterStatusFromHermes(status: string) {
  const normalized = status.toLowerCase();
  if (["blocked", "failed"].includes(normalized)) return "blocked";
  if (["done", "completed", "succeeded"].includes(normalized)) return "done";
  if (["archived"].includes(normalized)) return "archived";
  if (["running", "in_progress"].includes(normalized)) return "running";
  if (["review", "qc"].includes(normalized)) return normalized;
  return "planned";
}

function hermesKanbanPath() {
  const hermesHome = process.env.HERMES_RUNTIME_HOME ?? `${process.env.HOME ?? "/root"}/.hermes-ai-dev-office`;
  return `${hermesHome}/kanban.db`;
}

async function readHermesKanbanSnapshots(hermesIds: string[]): Promise<Record<string, HermesKanbanSnapshot>> {
  if (hermesIds.length === 0) return {};

  const script = `
import json
import sqlite3
import sys

db_path = sys.argv[1]
ids = json.loads(sys.argv[2])
con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
out = {}

for task_id in ids:
    task = con.execute(
        "select id, status, assignee, result, last_failure_error from tasks where id = ?",
        [task_id],
    ).fetchone()
    if not task:
        continue
    run = con.execute(
        "select status, outcome, summary from task_runs where task_id = ? order by id desc limit 1",
        [task_id],
    ).fetchone()
    comment = con.execute(
        "select body from task_comments where task_id = ? order by id desc limit 1",
        [task_id],
    ).fetchone()
    summary = None
    if run and run["summary"]:
        summary = run["summary"]
    elif comment and comment["body"]:
        summary = comment["body"]
    elif task["last_failure_error"]:
        summary = task["last_failure_error"]
    elif task["result"]:
        summary = task["result"]
    result = None
    if comment and comment["body"]:
        result = comment["body"]
    elif task["result"]:
        result = task["result"]
    elif summary:
        result = summary
    out[task_id] = {
        "id": task["id"],
        "status": task["status"],
        "assignee": task["assignee"],
        "summary": summary,
        "lastComment": comment["body"] if comment else None,
        "result": result,
    }

print(json.dumps(out, ensure_ascii=False))
`;

  const { stdout } = await execFileAsync("python3", ["-c", script, hermesKanbanPath(), JSON.stringify(hermesIds)], {
    timeout: 2500,
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(stdout || "{}") as Record<string, HermesKanbanSnapshot>;
}

async function syncHermesKanbanState() {
  const tracked = await queryRows<{
    id: string;
    status: string;
    hermes_id: string | null;
    hermes_status: string | null;
    hermes_summary: string | null;
    hermes_result: string | null;
  }>(`
    SELECT id::text,
           status,
           metadata->>'hermes_kanban_task_id' AS hermes_id,
           metadata->>'hermes_status' AS hermes_status,
           metadata->>'hermes_summary' AS hermes_summary,
           metadata->>'hermes_result' AS hermes_result
    FROM tasks
    WHERE metadata ? 'hermes_kanban_task_id'
      AND status NOT IN ('archived', 'cancelled', 'rejected')
    ORDER BY updated_at DESC
    LIMIT 60
  `);

  const hermesIds = tracked.map((task) => task.hermes_id).filter((id): id is string => Boolean(id));
  const snapshots = await readHermesKanbanSnapshots(hermesIds);

  for (const task of tracked) {
    if (!task.hermes_id) continue;
    const snapshot = snapshots[task.hermes_id];
    if (!snapshot) continue;

    const nextStatus = commandCenterStatusFromHermes(snapshot.status);
    const summary = snapshot.summary?.slice(0, 2000) ?? null;
    const result = snapshot.result?.slice(0, 12000) ?? summary;
    const changed = task.status !== nextStatus
      || task.hermes_status !== snapshot.status
      || (task.hermes_summary ?? null) !== summary
      || (task.hermes_result ?? null) !== result;

    if (!changed) continue;

    await queryRows(`
      UPDATE tasks
      SET status = $2,
          assigned_agent = COALESCE($3, assigned_agent),
          updated_at = now(),
          metadata = metadata || jsonb_build_object(
            'hermes_status', $4::text,
            'hermes_summary', $5::text,
            'hermes_result', $6::text,
            'hermes_synced_at', now()
          )
      WHERE id = $1::uuid
    `, [task.id, nextStatus, snapshot.assignee ?? null, snapshot.status, summary, result]);

    if (nextStatus === "blocked") {
      await queryRows(`
        UPDATE task_steps
        SET status = 'blocked',
            completed_at = COALESCE(completed_at, now()),
            output = COALESCE(output, '{}'::jsonb) || jsonb_build_object('hermes_summary', $2::text)
        WHERE task_id = $1::uuid AND status = 'running'
      `, [task.id, result ?? summary]);

      await queryRows(`
        UPDATE agent_runs
        SET status = 'failed',
            completed_at = COALESCE(completed_at, now()),
            error = COALESCE($2::text, 'Hermes Kanban blocked the task')
        WHERE task_id = $1::uuid AND status = 'running'
      `, [task.id, result ?? summary]);
    }

    if (nextStatus === "done") {
      await queryRows(`
        UPDATE task_steps
        SET status = 'done',
            completed_at = COALESCE(completed_at, now()),
            output = COALESCE(output, '{}'::jsonb) || jsonb_build_object('hermes_summary', $2::text)
        WHERE task_id = $1::uuid AND status = 'running'
      `, [task.id, result ?? summary]);

      await queryRows(`
        UPDATE agent_runs
        SET status = 'succeeded',
            completed_at = COALESCE(completed_at, now()),
            output = COALESCE(output, '{}'::jsonb) || jsonb_build_object('hermes_summary', $2::text)
        WHERE task_id = $1::uuid AND status = 'running'
      `, [task.id, result ?? summary]);
    }

    await queryRows(`
      INSERT INTO events (task_id, event_type, actor, severity, message, payload)
      VALUES (
        $1::uuid,
        'hermes.kanban.synced',
        'command-center',
        CASE WHEN $2 = 'blocked' THEN 'warn' ELSE 'info' END,
        $3,
        jsonb_build_object('hermes_task_id', $4::text, 'hermes_status', $5::text, 'summary', $6::text, 'result', $7::text)
      )
    `, [
      task.id,
      nextStatus,
      nextStatus === "blocked" ? "Hermes Kanban заблокировал задачу" : "Статус синхронизирован из Hermes Kanban",
      task.hermes_id,
      snapshot.status,
      summary,
      result,
    ]);
  }
}

async function serviceStatus(agentId: string): Promise<Pick<AgentState, "status" | "pid">> {
  const service = `hermes-gateway-ai-dev-office@${agentId}.service`;
  try {
    const { stdout } = await execFileAsync("systemctl", ["--user", "show", service, "--property=ActiveState,MainPID"], {
      timeout: 1200,
    });
    const values = new Map(stdout.trim().split("\n").map((line) => {
      const [key, ...rest] = line.split("=");
      return [key, rest.join("=")];
    }));
    const activeState = values.get("ActiveState") ?? "";
    const pid = values.get("MainPID") ?? "";
    return {
      status: activeState === "active" ? "active" : activeState === "inactive" ? "inactive" : "unknown",
      pid: pid && pid !== "0" ? pid : undefined,
    };
  } catch {
    return { status: "unknown" };
  }
}

async function readAgentGatewayState(agentId: string): Promise<Partial<AgentState>> {
  const runtimeHome = process.env.HERMES_RUNTIME_HOME ?? "/root/.hermes-ai-dev-office";
  const statePath = `${runtimeHome}/profiles/${agentId}/gateway_state.json`;
  try {
    const payload = JSON.parse(await readFile(statePath, "utf8")) as Record<string, unknown>;
    return {
      lastEvent: typeof payload.updated_at === "string" ? payload.updated_at : undefined,
    };
  } catch {
    return {};
  }
}

async function loadAgents(): Promise<AgentState[]> {
  return Promise.all(agentDirectory.map(async (agent) => {
    const [status, state] = await Promise.all([
      serviceStatus(agent.id),
      readAgentGatewayState(agent.id),
    ]);

    return {
      ...agent,
      service: `hermes-gateway-ai-dev-office@${agent.id}.service`,
      status: status.status,
      pid: status.pid,
      queueSize: state.queueSize ?? 0,
      lastEvent: state.lastEvent,
    };
  }));
}

async function loadDatabaseState() {
  try {
    await syncHermesKanbanState();
  } catch {
    // The dashboard must stay available even if Hermes runtime is temporarily unavailable.
  }

  const [tasks, taskSteps, taskArtifacts, taskQcResults, materials, events, routes, capabilities, failedQc] = await Promise.all([
    queryRows<{
      id: string;
      owner_request: string;
      status: string;
      route_type: string;
      assigned_department: string;
      assigned_agent: string;
      priority: string;
      risk_level: string;
      created_at: string;
      updated_at: string;
      step_count: string;
      running_step: string | null;
      hermes_status: string | null;
      hermes_summary: string | null;
      result: string | null;
    }>(`
      SELECT id::text, owner_request, status, route_type, assigned_department, assigned_agent, priority, risk_level,
             created_at::text, updated_at::text,
             metadata->>'hermes_status' AS hermes_status,
             metadata->>'hermes_summary' AS hermes_summary,
             metadata->>'hermes_result' AS result,
             (SELECT count(*)::text FROM task_steps WHERE task_steps.task_id = tasks.id) AS step_count,
             (SELECT title FROM task_steps WHERE task_steps.task_id = tasks.id AND task_steps.status = 'running' ORDER BY step_order LIMIT 1) AS running_step
      FROM tasks
      ORDER BY updated_at DESC
      LIMIT 60
    `),
    queryRows<{
      id: string;
      task_id: string;
      title: string;
      status: string;
      assigned_agent: string | null;
      tool_name: string | null;
      output: string;
      started_at: string | null;
      completed_at: string | null;
    }>(`
      SELECT id::text, task_id::text, title, status, assigned_agent, tool_name, output::text,
             started_at::text, completed_at::text
      FROM task_steps
      WHERE task_id IN (SELECT id FROM tasks ORDER BY updated_at DESC LIMIT 60)
      ORDER BY task_id, step_order
    `),
    queryRows<{
      id: string;
      task_id: string | null;
      artifact_type: string;
      title: string;
      uri: string;
      created_at: string;
    }>(`
      SELECT id::text, task_id::text, artifact_type, title, uri, created_at::text
      FROM artifacts
      WHERE task_id IN (SELECT id FROM tasks ORDER BY updated_at DESC LIMIT 60)
      ORDER BY created_at DESC
    `),
    queryRows<{
      id: string;
      task_id: string;
      status: string;
      gate: string;
      summary: string;
      created_at: string;
    }>(`
      SELECT id::text, task_id::text, status, gate, summary, created_at::text
      FROM qc_results
      WHERE task_id IN (SELECT id FROM tasks ORDER BY updated_at DESC LIMIT 60)
      ORDER BY created_at DESC
    `),
    queryRows<{
      id: string;
      title: string;
      material_type: string;
      status: string;
      version: number;
      storage_uri: string;
      source_summary: string | null;
      updated_at: string;
    }>(`
      SELECT id::text, title, material_type, status, version, storage_uri, source_summary, updated_at::text
      FROM materials
      ORDER BY updated_at DESC
      LIMIT 60
    `),
    queryRows<{
      id: string;
      task_id: string | null;
      event_type: string;
      actor: string;
      severity: string;
      message: string;
      created_at: string;
    }>(`
      SELECT id::text, task_id::text, event_type, actor, severity, message, created_at::text
      FROM events
      ORDER BY created_at DESC
      LIMIT 80
    `),
    queryRows<{
      route_type: string;
      name: string;
      department: string;
      primary_agent: string;
      qc_required: boolean;
      approval_required: boolean;
    }>(`
      SELECT route_type, name, department, primary_agent, qc_required, approval_required
      FROM route_rules
      ORDER BY route_type
    `),
    queryRows<{
      id: string;
      capability_type: "skill" | "tool";
      name: string;
      slug: string;
      status: string;
      scope_department: string | null;
      scope_agent: string | null;
      description: string;
      instructions: string;
      config: string;
      updated_at: string;
    }>(`
      SELECT id::text, capability_type, name, slug, status, scope_department, scope_agent,
             description, instructions, config::text, updated_at::text
      FROM office_capabilities
      WHERE status <> 'archived'
      ORDER BY capability_type, name
    `),
    queryRows<{ count: string }>("SELECT count(*)::text FROM qc_results WHERE status = 'failed'"),
  ]);

  return {
    tasks: tasks.map<TaskState>((task, index) => {
      const steps = taskSteps.filter((step) => step.task_id === task.id);
      const artifacts = taskArtifacts.filter((artifact) => artifact.task_id === task.id);
      const qcResults = taskQcResults.filter((result) => result.task_id === task.id);
      const taskEvents = events.filter((event) => event.task_id === task.id);
      return {
        id: task.id,
        title: task.owner_request.split("\n")[0]?.slice(0, 96) || `Задача ${index + 1}`,
        ownerRequest: task.owner_request,
        status: task.status,
        routeType: task.route_type,
        department: task.assigned_department,
        agent: task.assigned_agent,
        priority: task.priority,
        riskLevel: task.risk_level,
        stepCount: Number(task.step_count ?? 0),
        runningStep: task.running_step ?? undefined,
        hermesStatus: task.hermes_status ?? undefined,
        hermesSummary: task.hermes_summary ?? undefined,
        result: task.result ?? task.hermes_summary ?? undefined,
        steps: steps.map((step) => ({
          id: step.id,
          title: step.title,
          status: step.status,
          assignedAgent: step.assigned_agent ?? undefined,
          toolName: step.tool_name ?? undefined,
          output: step.output,
          startedAt: step.started_at ?? undefined,
          completedAt: step.completed_at ?? undefined,
        })),
        events: taskEvents.map<EventState>((event) => ({
          id: event.id,
          taskId: event.task_id ?? undefined,
          eventType: event.event_type,
          actor: event.actor,
          severity: event.severity,
          message: event.message,
          createdAt: event.created_at,
        })),
        artifacts: artifacts.map((artifact) => ({
          id: artifact.id,
          title: artifact.title,
          type: artifact.artifact_type,
          uri: artifact.uri,
          createdAt: artifact.created_at,
        })),
        qcResults: qcResults.map((result) => ({
          id: result.id,
          status: result.status,
          gate: result.gate,
          summary: result.summary,
          createdAt: result.created_at,
        })),
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      };
    }),
    materials: materials.map<MaterialState>((material) => ({
      id: material.id,
      title: material.title,
      type: material.material_type,
      status: material.status,
      version: material.version,
      storageUri: material.storage_uri,
      sourceSummary: material.source_summary ?? undefined,
      updatedAt: material.updated_at,
    })),
    events: events.map<EventState>((event) => ({
      id: event.id,
      taskId: event.task_id ?? undefined,
      eventType: event.event_type,
      actor: event.actor,
      severity: event.severity,
      message: event.message,
      createdAt: event.created_at,
    })),
    routes: routes.map<RouteRuleState>((route) => ({
      routeType: route.route_type,
      name: route.name,
      department: route.department,
      primaryAgent: route.primary_agent,
      qcRequired: route.qc_required,
      approvalRequired: route.approval_required,
    })),
    capabilities: capabilities.map<CapabilityState>((capability) => ({
      id: capability.id,
      type: capability.capability_type,
      name: capability.name,
      slug: capability.slug,
      status: capability.status,
      scopeDepartment: capability.scope_department ?? undefined,
      scopeAgent: capability.scope_agent ?? undefined,
      description: capability.description,
      instructions: capability.instructions,
      config: capability.config,
      updatedAt: capability.updated_at,
    })),
    failedQc: Number(failedQc[0]?.count ?? 0),
  };
}

function fallbackState(agents: AgentState[], message: string): CommandCenterState {
  const now = new Date().toISOString();

  return {
    mode: "fallback",
    checkedAt: now,
    database: { connected: false, message },
    totals: {
      activeAgents: agents.filter((agent) => agent.status === "active").length,
      openTasks: 0,
      materials: 0,
      failedQc: 0,
    },
    agents,
    departments: departmentDirectory,
    tasks: [],
    materials: [],
    events: [{
      id: "fallback-db",
      eventType: "database.unavailable",
      actor: "command-center",
      severity: "warn",
      message,
      createdAt: now,
    }],
    routes: [],
    capabilities: [],
  };
}

export async function loadCommandCenterState(): Promise<CommandCenterState> {
  const agents = await loadAgents();

  try {
    const database = await loadDatabaseState();
    return {
      mode: "live",
      checkedAt: new Date().toISOString(),
      database: { connected: true, message: "Postgres подключен" },
      totals: {
        activeAgents: agents.filter((agent) => agent.status === "active").length,
        openTasks: database.tasks.filter((task) => !["done", "archived", "cancelled", "failed", "rejected"].includes(task.status)).length,
        materials: database.materials.length,
        failedQc: database.failedQc,
      },
      agents,
      departments: departmentDirectory,
      ...database,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Postgres недоступен";
    return fallbackState(agents, message);
  }
}

export async function createTask(input: {
  ownerRequest: string;
  routeType: string;
  assignedDepartment: string;
  assignedAgent: string;
  priority: string;
  riskLevel: string;
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const routeResult = await client.query<{
      route_type: string;
      department: string;
      primary_agent: string;
    }>(`
      SELECT route_type, department, primary_agent
      FROM route_rules
      WHERE route_type = $1 AND status = 'active'
      LIMIT 1
    `, [input.routeType]);

    const route = routeResult.rows[0] ?? {
      route_type: input.routeType,
      department: input.assignedDepartment,
      primary_agent: input.assignedAgent,
    };
    const steps = stepsForRoute(route.route_type, route.primary_agent);
    const firstStep = steps[0];
    const rejectReason = rejectReasonForOwnerRequest(input.ownerRequest);

    if (rejectReason) {
      const rejectedTaskResult = await client.query<{ id: string }>(`
        INSERT INTO tasks (owner_request, status, route_type, assigned_department, assigned_agent, priority, risk_level, metadata, completed_at)
        VALUES (
          $1,
          'rejected',
          $2,
          $3,
          $4,
          $5,
          $6,
          jsonb_build_object(
            'source', 'command-center',
            'rejected_at', now(),
            'reject_reason', $7::text,
            'hermes_result', $7::text,
            'workflow_step_count', 0
          ),
          now()
        )
        RETURNING id::text
      `, [input.ownerRequest, route.route_type, route.department, route.primary_agent, input.priority, input.riskLevel, rejectReason]);

      const taskId = rejectedTaskResult.rows[0]?.id;
      if (!taskId) throw new Error("Rejected task was not created");

      await client.query(`
        INSERT INTO events (task_id, event_type, actor, severity, message, payload)
        VALUES ($1::uuid, 'task.rejected', 'command-center', 'info', 'Задача отклонена до запуска: неосмысленная или неполная формулировка', jsonb_build_object('reason', $2::text, 'route_type', $3::text))
      `, [taskId, rejectReason, route.route_type]);

      await client.query("COMMIT");
      return { id: taskId };
    }

    const taskResult = await client.query<{ id: string }>(`
      INSERT INTO tasks (owner_request, status, route_type, assigned_department, assigned_agent, priority, risk_level, metadata)
      VALUES (
        $1,
        'running',
        $2,
        $3,
        $4,
        $5,
        $6,
        jsonb_build_object('source', 'command-center', 'workflow_started_at', now(), 'workflow_step_count', $7::int)
      )
      RETURNING id::text
    `, [input.ownerRequest, route.route_type, route.department, route.primary_agent, input.priority, input.riskLevel, steps.length]);

    const taskId = taskResult.rows[0]?.id;
    if (!taskId) throw new Error("Task was not created");

    let firstStepId = "";
    for (const [index, step] of steps.entries()) {
      const stepResult = await client.query<{ id: string }>(`
        INSERT INTO task_steps (task_id, step_order, title, status, assigned_agent, tool_name, input, started_at)
        VALUES (
          $1::uuid,
          $2,
          $3,
          $4,
          $5,
          $6,
          jsonb_build_object('owner_request', $7::text, 'route_type', $8::text),
          CASE WHEN $4 = 'running' THEN now() ELSE NULL END
        )
        RETURNING id::text
      `, [
        taskId,
        index + 1,
        step.title,
        index === 0 ? "running" : "pending",
        step.assignedAgent,
        step.toolName ?? null,
        input.ownerRequest,
        route.route_type,
      ]);
      if (index === 0) firstStepId = stepResult.rows[0]?.id ?? "";
    }

    await client.query(`
      INSERT INTO agent_runs (task_id, step_id, agent_id, tool_name, status, input)
      VALUES ($1::uuid, $2::uuid, $3, $4, 'running', jsonb_build_object('owner_request', $5::text, 'route_type', $6::text))
    `, [taskId, firstStepId, firstStep?.assignedAgent ?? route.primary_agent, firstStep?.toolName ?? "hermes-profile", input.ownerRequest, route.route_type]);

    await client.query(`
      INSERT INTO events (task_id, event_type, actor, severity, message, payload)
      VALUES
        ($1::uuid, 'task.created', 'command-center', 'info', 'Задача создана через Command Center', jsonb_build_object('route_type', $2::text)),
        ($1::uuid, 'workflow.started', 'orchestrator', 'info', 'Маршрут запущен: создана цепочка шагов и первый agent_run', jsonb_build_object('first_agent', $3::text, 'steps', $4::int)),
        ($1::uuid, 'task.assigned', $3::text, 'info', 'Первый шаг передан ответственному агенту', jsonb_build_object('step_title', $5::text))
    `, [taskId, route.route_type, firstStep?.assignedAgent ?? route.primary_agent, steps.length, firstStep?.title ?? "Запуск"]);

    await client.query("COMMIT");

    try {
      const hermes = await createHermesKanbanTask({
        taskId,
        title: input.ownerRequest.split("\n")[0]?.slice(0, 96) || `Command Center task ${taskId}`,
        body: input.ownerRequest,
        assignee: firstStep?.assignedAgent ?? route.primary_agent,
        routeType: route.route_type,
        priority: input.priority,
        steps,
      });

      await queryRows(`
        UPDATE tasks
        SET metadata = metadata || jsonb_build_object('hermes_kanban_task_id', $2::text, 'hermes_dispatch_at', now())
        WHERE id = $1::uuid
      `, [taskId, hermes.hermesTaskId]);

      await queryRows(`
        INSERT INTO events (task_id, event_type, actor, severity, message, payload)
        VALUES ($1::uuid, 'hermes.kanban.dispatched', 'command-center', 'info', 'Задача создана в Hermes Kanban и передана dispatcher', jsonb_build_object('hermes_task_id', $2::text, 'dispatch', $3::jsonb))
      `, [taskId, hermes.hermesTaskId, JSON.stringify(hermes.dispatch ?? {})]);
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : "Hermes Kanban dispatch failed";
      await queryRows(`
        INSERT INTO events (task_id, event_type, actor, severity, message, payload)
        VALUES ($1::uuid, 'hermes.kanban.dispatch_failed', 'command-center', 'warn', 'Не удалось передать задачу в Hermes Kanban', jsonb_build_object('error', $2::text))
      `, [taskId, message]);
    }

    return { id: taskId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateTaskStatus(input: {
  taskId: string;
  status: string;
}) {
  const allowed = new Set(["new", "planned", "running", "blocked", "review", "qc", "done", "archived", "cancelled", "failed", "rejected"]);
  if (!allowed.has(input.status)) {
    throw new Error(`Unsupported task status: ${input.status}`);
  }

  const rows = await queryRows<{ id: string }>(`
    UPDATE tasks
    SET status = $2, updated_at = now()
    WHERE id = $1::uuid
    RETURNING id::text
  `, [input.taskId, input.status]);

  if (!rows[0]) {
    throw new Error("Task not found");
  }

  await queryRows(`
    INSERT INTO events (task_id, event_type, actor, severity, message, payload)
    VALUES ($1::uuid, 'task.status.changed', 'command-center', 'info', 'Статус задачи изменен на доске', jsonb_build_object('status', $2::text))
  `, [input.taskId, input.status]);

  return rows[0];
}

export async function archiveTask(taskId: string) {
  const rows = await queryRows<{ id: string }>(`
    UPDATE tasks
    SET status = 'archived', updated_at = now(), metadata = metadata || jsonb_build_object('archived_at', now(), 'archived_by', 'command-center')
    WHERE id = $1::uuid
    RETURNING id::text
  `, [taskId]);

  if (!rows[0]) throw new Error("Task not found");

  await queryRows(`
    UPDATE agent_runs
    SET status = 'cancelled', completed_at = now(), error = 'Task archived from Command Center'
    WHERE task_id = $1::uuid AND status = 'running'
  `, [taskId]);

  await queryRows(`
    INSERT INTO events (task_id, event_type, actor, severity, message)
    VALUES ($1::uuid, 'task.archived', 'command-center', 'info', 'Задача отправлена в архив')
  `, [taskId]);

  return rows[0];
}

export async function deleteTask(taskId: string) {
  await queryRows(`
    INSERT INTO events (task_id, event_type, actor, severity, message)
    VALUES ($1::uuid, 'task.delete.requested', 'command-center', 'warn', 'Задача удалена из Command Center')
  `, [taskId]);

  const rows = await queryRows<{ id: string }>(`
    DELETE FROM tasks
    WHERE id = $1::uuid
    RETURNING id::text
  `, [taskId]);

  if (!rows[0]) throw new Error("Task not found");
  return rows[0];
}

export async function createMaterial(input: {
  title: string;
  materialType: string;
  status: string;
  storageUri: string;
  sourceSummary: string;
}) {
  const rows = await queryRows<{ id: string }>(`
    INSERT INTO materials (title, material_type, status, storage_uri, source_summary, metadata)
    VALUES ($1, $2, $3, $4, $5, '{"source":"command-center"}'::jsonb)
    RETURNING id::text
  `, [input.title, input.materialType, input.status, input.storageUri, input.sourceSummary || null]);

  await queryRows(`
    INSERT INTO events (event_type, actor, severity, message, payload)
    VALUES ('material.created', 'command-center', 'info', 'Материал добавлен в библиотеку', jsonb_build_object('material_id', $1::text))
  `, [rows[0]?.id]);

  return rows[0];
}

export async function createArtifact(input: {
  taskId?: string;
  materialId?: string;
  artifactType: string;
  title: string;
  uri: string;
  checksum?: string;
  metadata?: Record<string, unknown>;
}) {
  const rows = await queryRows<{ id: string }>(`
    INSERT INTO artifacts (task_id, artifact_type, title, uri, checksum, metadata)
    VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)
    RETURNING id::text
  `, [
    input.taskId ?? null,
    input.artifactType,
    input.title,
    input.uri,
    input.checksum ?? null,
    JSON.stringify({ ...(input.metadata ?? {}), material_id: input.materialId }),
  ]);

  if (input.materialId && rows[0]?.id) {
    await queryRows(`
      UPDATE materials
      SET artifact_id = $2::uuid,
          metadata = metadata || jsonb_build_object('artifact_id', $2::text),
          updated_at = now()
      WHERE id = $1::uuid
    `, [input.materialId, rows[0].id]);
  }

  return rows[0];
}

export async function upsertCapability(input: {
  id?: string;
  capabilityType: string;
  name: string;
  slug: string;
  status: string;
  scopeDepartment?: string;
  scopeAgent?: string;
  description: string;
  instructions: string;
  config: string;
}) {
  const config = input.config.trim() || "{}";
  JSON.parse(config);

  if (input.id) {
    const rows = await queryRows<{ id: string }>(`
      UPDATE office_capabilities
      SET capability_type = $2,
          name = $3,
          slug = $4,
          status = $5,
          scope_department = NULLIF($6, ''),
          scope_agent = NULLIF($7, ''),
          description = $8,
          instructions = $9,
          config = $10::jsonb,
          updated_at = now()
      WHERE id = $1::uuid
      RETURNING id::text
    `, [
      input.id,
      input.capabilityType,
      input.name,
      input.slug,
      input.status,
      input.scopeDepartment ?? "",
      input.scopeAgent ?? "",
      input.description,
      input.instructions,
      config,
    ]);
    return rows[0];
  }

  const rows = await queryRows<{ id: string }>(`
    INSERT INTO office_capabilities (capability_type, name, slug, status, scope_department, scope_agent, description, instructions, config)
    VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), $7, $8, $9::jsonb)
    RETURNING id::text
  `, [
    input.capabilityType,
    input.name,
    input.slug,
    input.status,
    input.scopeDepartment ?? "",
    input.scopeAgent ?? "",
    input.description,
    input.instructions,
    config,
  ]);
  return rows[0];
}

export async function deleteCapability(id: string) {
  const rows = await queryRows<{ id: string }>(`
    UPDATE office_capabilities
    SET status = 'archived', updated_at = now()
    WHERE id = $1::uuid
    RETURNING id::text
  `, [id]);
  if (!rows[0]) throw new Error("Capability not found");
  return rows[0];
}
