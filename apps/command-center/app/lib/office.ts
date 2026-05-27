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
    }>(`
      SELECT id::text, owner_request, status, route_type, assigned_department, assigned_agent, priority, risk_level,
             created_at::text, updated_at::text
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
        openTasks: database.tasks.filter((task) => !["done", "cancelled", "failed"].includes(task.status)).length,
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
  const rows = await queryRows<{ id: string }>(`
    INSERT INTO tasks (owner_request, status, route_type, assigned_department, assigned_agent, priority, risk_level, metadata)
    VALUES ($1, 'new', $2, $3, $4, $5, $6, '{"source":"command-center"}'::jsonb)
    RETURNING id::text
  `, [input.ownerRequest, input.routeType, input.assignedDepartment, input.assignedAgent, input.priority, input.riskLevel]);

  await queryRows(`
    INSERT INTO events (task_id, event_type, actor, severity, message)
    VALUES ($1::uuid, 'task.created', 'command-center', 'info', 'Задача создана через Command Center')
  `, [rows[0]?.id]);

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
