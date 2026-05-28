export type AgentState = {
  id: string;
  name: string;
  department: string;
  service: string;
  status: "active" | "inactive" | "unknown";
  pid?: string;
  currentTask?: string;
  queueSize?: number;
  lastEvent?: string;
};

export type TaskState = {
  id: string;
  title: string;
  ownerRequest: string;
  status: string;
  routeType: string;
  department: string;
  agent: string;
  priority: string;
  riskLevel: string;
  stepCount: number;
  runningStep?: string;
  hermesStatus?: string;
  hermesSummary?: string;
  result?: string;
  steps: TaskStepState[];
  events: EventState[];
  artifacts: ArtifactState[];
  qcResults: QcResultState[];
  createdAt: string;
  updatedAt: string;
};

export type TaskStepState = {
  id: string;
  title: string;
  status: string;
  assignedAgent?: string;
  toolName?: string;
  output?: string;
  startedAt?: string;
  completedAt?: string;
};

export type ArtifactState = {
  id: string;
  title: string;
  type: string;
  uri: string;
  contentType?: string;
  size?: number;
  createdAt: string;
};

export type QcResultState = {
  id: string;
  status: string;
  gate: string;
  summary: string;
  createdAt: string;
};

export type MaterialState = {
  id: string;
  title: string;
  type: string;
  status: string;
  version: number;
  storageUri: string;
  sourceSummary?: string;
  updatedAt: string;
};

export type EventState = {
  id: string;
  taskId?: string;
  eventType: string;
  actor: string;
  severity: string;
  message: string;
  createdAt: string;
};

export type RouteRuleState = {
  routeType: string;
  name: string;
  department: string;
  primaryAgent: string;
  qcRequired: boolean;
  approvalRequired: boolean;
};

export type CapabilityState = {
  id: string;
  type: "skill" | "tool";
  name: string;
  slug: string;
  status: string;
  scopeDepartment?: string;
  scopeAgent?: string;
  description: string;
  instructions: string;
  config: string;
  updatedAt: string;
};

export type SecretState = {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  scopeDepartment?: string;
  scopeAgent?: string;
  description: string;
  fingerprint?: string;
  updatedAt: string;
  lastUsedAt?: string;
};

export type DepartmentState = {
  id: string;
  name: string;
  mission: string;
  lead: string;
  responsibilities: string[];
  tools: string[];
  flows: string[];
  products: string[];
  agentIds: string[];
  routeTypes: string[];
};

export type CommandCenterState = {
  mode: "live" | "fallback";
  checkedAt: string;
  database: {
    connected: boolean;
    message: string;
  };
  totals: {
    activeAgents: number;
    openTasks: number;
    materials: number;
    failedQc: number;
  };
  agents: AgentState[];
  departments: DepartmentState[];
  tasks: TaskState[];
  materials: MaterialState[];
  events: EventState[];
  routes: RouteRuleState[];
  capabilities: CapabilityState[];
  secrets: SecretState[];
};
