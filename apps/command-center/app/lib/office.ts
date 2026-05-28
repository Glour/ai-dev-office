import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { Pool } from "pg";
import type {
  AgentState,
  CommandCenterState,
  EventState,
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
  { id: "materials-librarian", name: "Materials Librarian", department: "materials-library" },
  { id: "daily-auditor", name: "Daily Auditor", department: "quality-control" },
] as const;

let pool: Pool | null = null;

type RouteStep = {
  title: string;
  assignedAgent: string;
  toolName?: string;
};

const routeFlows: Record<string, RouteStep[]> = {
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
};

function stepsForRoute(routeType: string, primaryAgent: string): RouteStep[] {
  return routeFlows[routeType] ?? [
    { title: "Классификация и запуск задачи", assignedAgent: "orchestrator" },
    { title: "Выполнение основного шага", assignedAgent: primaryAgent },
    { title: "Контроль результата", assignedAgent: "qa-lead" },
    { title: "Отчет владельцу", assignedAgent: "owner-assistant" },
  ];
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
  const [tasks, materials, events, routes, failedQc] = await Promise.all([
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
    }>(`
      SELECT id::text, owner_request, status, route_type, assigned_department, assigned_agent, priority, risk_level,
             created_at::text, updated_at::text,
             (SELECT count(*)::text FROM task_steps WHERE task_steps.task_id = tasks.id) AS step_count,
             (SELECT title FROM task_steps WHERE task_steps.task_id = tasks.id AND task_steps.status = 'running' ORDER BY step_order LIMIT 1) AS running_step
      FROM tasks
      ORDER BY updated_at DESC
      LIMIT 60
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
    queryRows<{ count: string }>("SELECT count(*)::text FROM qc_results WHERE status = 'failed'"),
  ]);

  return {
    tasks: tasks.map<TaskState>((task, index) => ({
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
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    })),
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
        openTasks: database.tasks.filter((task) => !["done", "archived", "cancelled", "failed"].includes(task.status)).length,
        materials: database.materials.length,
        failedQc: database.failedQc,
      },
      agents,
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
  const allowed = new Set(["new", "planned", "running", "blocked", "review", "qc", "done", "archived", "cancelled", "failed"]);
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
