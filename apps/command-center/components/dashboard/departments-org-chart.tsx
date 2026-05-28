"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BotIcon,
  BoxesIcon,
  CheckCircle2Icon,
  Code2Icon,
  CrownIcon,
  LibraryIcon,
  MegaphoneIcon,
  NetworkIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TargetIcon,
  UserRoundIcon,
} from "lucide-react";
import type { AgentState, DepartmentState, RouteRuleState } from "@/app/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const statusLabels: Record<string, string> = {
  active: "активен",
  inactive: "выключен",
  unknown: "неизвестно",
};

const departmentVisuals: Record<string, {
  icon: typeof NetworkIcon;
  role: string;
  position: string;
}> = {
  management: {
    icon: CrownIcon,
    role: "точка входа",
    position: "lg:row-start-1 lg:col-start-2",
  },
  development: {
    icon: Code2Icon,
    role: "производство кода",
    position: "lg:row-start-2 lg:col-start-1",
  },
  marketing: {
    icon: MegaphoneIcon,
    role: "контент и спрос",
    position: "lg:row-start-2 lg:col-start-2",
  },
  security: {
    icon: ShieldCheckIcon,
    role: "контроль рисков",
    position: "lg:row-start-2 lg:col-start-3",
  },
  "quality-control": {
    icon: CheckCircle2Icon,
    role: "финальный фильтр",
    position: "lg:row-start-3 lg:col-start-1",
  },
  "materials-library": {
    icon: LibraryIcon,
    role: "память офиса",
    position: "lg:row-start-3 lg:col-start-3",
  },
};

function label(value: string) {
  return statusLabels[value] ?? value.replaceAll("_", " ");
}

function toneClass(status: string) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "inactive") return "border-red-200 bg-red-50 text-red-700";
  return "border-border bg-muted text-muted-foreground";
}

function agentRole(agentId: string) {
  const roles: Record<string, string> = {
    "owner-assistant": "принимает задачу владельца",
    orchestrator: "классифицирует и ведет маршрут",
    "dev-builder": "реализует через Codex CLI",
    "dev-reviewer": "проверяет код и архитектуру",
    "qa-lead": "закрывает acceptance gates",
    "daily-auditor": "ищет системные улучшения",
    "seo-strategist": "собирает SEO-структуру",
    "marketing-researcher": "делает research и source ledger",
    "content-writer": "пишет и редактирует тексты",
    "ads-specialist": "отвечает за рекламу и метрики",
    "security-officer": "проверяет риски и доступы",
    "materials-librarian": "сохраняет verified материалы",
  };
  return roles[agentId] ?? "исполнитель отдела";
}

export function DepartmentsOrgChart({
  agents,
  departments,
  routes,
}: {
  agents: AgentState[];
  departments: DepartmentState[];
  routes: RouteRuleState[];
}) {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("management");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const selectedDepartment = departments.find((department) => department.id === selectedDepartmentId) ?? departments[0];
  const selectedAgent = selectedAgentId ? agents.find((agent) => agent.id === selectedAgentId) ?? null : null;
  const selectedDepartmentAgents = selectedDepartment
    ? agents.filter((agent) => selectedDepartment.agentIds.includes(agent.id))
    : [];
  const selectedDepartmentRoutes = selectedDepartment
    ? routes.filter((route) => selectedDepartment.routeTypes.includes(route.routeType))
    : [];

  const activeAgentCountByDepartment = useMemo(() => {
    const counts = new Map<string, number>();
    for (const department of departments) {
      counts.set(department.id, agents.filter((agent) => department.agentIds.includes(agent.id) && agent.status === "active").length);
    }
    return counts;
  }, [agents, departments]);

  function selectDepartment(departmentId: string) {
    setSelectedDepartmentId(departmentId);
    setSelectedAgentId(null);
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Оргструктура AI Dev Office</CardTitle>
          <CardDescription>Кликайте по отделу или агенту: схема показывает иерархию, а панель раскрывает ответственность, маршруты и инструменты.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="min-w-0 rounded-xl border bg-background p-4">
              <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_1.15fr_1fr]">
                <OfficeNode
                  active={false}
                  icon={UserRoundIcon}
                  kicker="владелец"
                  onClick={() => selectDepartment("management")}
                  subtitle="ставит задачу, принимает результат"
                  title="Александр"
                />
                <OfficeNode
                  active={selectedDepartmentId === "management"}
                  icon={CrownIcon}
                  kicker="центр управления"
                  onClick={() => selectDepartment("management")}
                  subtitle="Owner Assistant + Orchestrator"
                  title="Management"
                />
                <OfficeNode
                  active={false}
                  icon={TargetIcon}
                  kicker="выход"
                  onClick={() => selectDepartment("quality-control")}
                  subtitle="готовый результат, отчет или артефакт"
                  title="Value Delivery"
                />
              </div>

              <div className="relative">
                <OrgConnectors />
                <div className="relative grid gap-3 lg:grid-cols-3">
                  {departments.map((department) => {
                    const visual = departmentVisuals[department.id] ?? {
                      icon: BoxesIcon,
                      role: "отдел",
                      position: "",
                    };
                    return (
                      <DepartmentNode
                        active={selectedDepartment?.id === department.id}
                        activeAgents={activeAgentCountByDepartment.get(department.id) ?? 0}
                        agentCount={department.agentIds.length}
                        department={department}
                        icon={visual.icon}
                        key={department.id}
                        onClick={() => selectDepartment(department.id)}
                        role={visual.role}
                        className={visual.position}
                      />
                    );
                  })}
                </div>
              </div>
            </section>

            <aside className="min-w-0 rounded-xl border bg-background">
              {selectedAgent ? (
                <AgentDetail
                  agent={selectedAgent}
                  department={selectedDepartment}
                  onBack={() => setSelectedAgentId(null)}
                  routes={routes.filter((route) => route.primaryAgent === selectedAgent.id || route.department === selectedAgent.department)}
                />
              ) : selectedDepartment ? (
                <DepartmentDetail
                  agents={selectedDepartmentAgents}
                  department={selectedDepartment}
                  onSelectAgent={setSelectedAgentId}
                  routes={selectedDepartmentRoutes}
                />
              ) : null}
            </aside>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OfficeNode({
  active,
  icon: Icon,
  kicker,
  onClick,
  subtitle,
  title,
}: {
  active: boolean;
  icon: typeof NetworkIcon;
  kicker: string;
  onClick: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <button
      className={`min-h-28 rounded-xl border p-4 text-left transition ${active ? "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background" : "bg-background hover:border-foreground/25 hover:bg-muted/40"}`}
      onClick={onClick}
      type="button"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={`text-xs font-medium uppercase tracking-wide ${active ? "text-background/65" : "text-muted-foreground"}`}>{kicker}</span>
        <Icon className="size-4" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className={`mt-1 text-sm ${active ? "text-background/70" : "text-muted-foreground"}`}>{subtitle}</p>
    </button>
  );
}

function DepartmentNode({
  active,
  activeAgents,
  agentCount,
  className,
  department,
  icon: Icon,
  onClick,
  role,
}: {
  active: boolean;
  activeAgents: number;
  agentCount: number;
  className: string;
  department: DepartmentState;
  icon: typeof NetworkIcon;
  onClick: () => void;
  role: string;
}) {
  return (
    <button
      className={`min-h-40 rounded-xl border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-foreground/25 hover:bg-muted/20 hover:shadow-sm ${active ? "border-foreground shadow-sm hover:bg-background" : ""} ${className}`}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex size-10 items-center justify-center rounded-lg border ${active ? "bg-foreground text-background" : "bg-muted"}`}>
          <Icon className="size-5" />
        </span>
        <Badge className={activeAgents === agentCount ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"} variant="outline">
          {activeAgents}/{agentCount}
        </Badge>
      </div>
      <p className="mt-4 text-base font-semibold">{department.name}</p>
      <p className="mt-1 text-sm text-muted-foreground">{role}</p>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{department.mission}</p>
    </button>
  );
}

function OrgConnectors() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden h-full w-full text-border lg:block"
      preserveAspectRatio="none"
      viewBox="0 0 1200 560"
    >
      <path d="M600 0 V72" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M200 128 H1000" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M200 128 V238" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M600 72 V238" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M1000 128 V238" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M200 360 V474" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M1000 360 V474" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M200 474 H1000" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="600" cy="72" fill="currentColor" r="4" />
      <circle cx="200" cy="128" fill="currentColor" r="4" />
      <circle cx="1000" cy="128" fill="currentColor" r="4" />
    </svg>
  );
}

function DepartmentDetail({
  agents,
  department,
  onSelectAgent,
  routes,
}: {
  agents: AgentState[];
  department: DepartmentState;
  onSelectAgent: (agentId: string) => void;
  routes: RouteRuleState[];
}) {
  const LeadIcon = departmentVisuals[department.id]?.icon ?? BoxesIcon;

  return (
    <div className="grid gap-4 p-4">
      <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-foreground text-background">
            <LeadIcon className="size-5" />
          </span>
          <Badge variant="outline">lead: {department.lead}</Badge>
        </div>
        <h2 className="text-lg font-semibold">{department.name}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{department.mission}</p>
      </div>

      <DetailSection icon={BotIcon} title="Агенты отдела">
        <div className="grid gap-2">
          {agents.map((agent) => (
            <button
              className="flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition hover:border-foreground/25 hover:bg-muted/40"
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              type="button"
            >
              <span className={`size-2 rounded-full ${agent.status === "active" ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{agent.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{agentRole(agent.id)}</span>
              </span>
              <Badge className={toneClass(agent.status)} variant="outline">{label(agent.status)}</Badge>
            </button>
          ))}
        </div>
      </DetailSection>

      <DetailSection icon={RouteIcon} title="Маршруты">
        <div className="grid gap-2">
          {routes.map((route) => (
            <div className="rounded-lg border px-3 py-2" key={route.routeType}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{route.name}</p>
                <Badge variant="outline">{route.primaryAgent}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{route.routeType} · {route.qcRequired ? "QC обязателен" : "без QC"}</p>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection icon={TargetIcon} title="Ответственность">
        <ChipList items={department.responsibilities} />
      </DetailSection>

      <DetailSection icon={SparklesIcon} title="Инструменты и навыки">
        <ChipList items={department.tools} />
      </DetailSection>

      <DetailSection icon={BoxesIcon} title="Выходные продукты">
        <ChipList items={department.products} />
      </DetailSection>
    </div>
  );
}

function AgentDetail({
  agent,
  department,
  onBack,
  routes,
}: {
  agent: AgentState;
  department?: DepartmentState;
  onBack: () => void;
  routes: RouteRuleState[];
}) {
  const agentRoutes = routes.filter((route) => route.primaryAgent === agent.id);
  const fallbackRoutes = agentRoutes.length > 0 ? agentRoutes : routes.slice(0, 4);

  return (
    <div className="grid gap-4 p-4">
      <div>
        <Button onClick={onBack} size="sm" type="button" variant="outline">Назад к отделу</Button>
        <div className="mt-4 flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <BotIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{agent.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{agentRole(agent.id)}</p>
          </div>
          <Badge className={toneClass(agent.status)} variant="outline">{label(agent.status)}</Badge>
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border p-3 text-sm">
        <InfoRow label="Профиль" value={agent.id} />
        <InfoRow label="Отдел" value={department?.name ?? agent.department} />
        <InfoRow label="Gateway" value={agent.service} />
        <InfoRow label="PID" value={agent.pid ?? "нет данных"} />
      </div>

      <DetailSection icon={RouteIcon} title="Где участвует">
        <div className="grid gap-2">
          {fallbackRoutes.map((route) => (
            <div className="rounded-lg border px-3 py-2" key={route.routeType}>
              <p className="text-sm font-medium">{route.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{route.routeType} · {route.department}</p>
            </div>
          ))}
        </div>
      </DetailSection>
    </div>
  );
}

function DetailSection({
  children,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  icon: typeof NetworkIcon;
  title: string;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words font-medium">{value}</span>
    </div>
  );
}
