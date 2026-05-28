import { createTask } from "@/app/lib/office";

export const dynamic = "force-dynamic";

function redirectTo(location: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: location },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const ownerRequest = String(form.get("ownerRequest") ?? "").trim();
  const routeType = String(form.get("routeType") ?? "feature_development").trim();
  const assignedDepartment = String(form.get("assignedDepartment") ?? "development").trim();
  const assignedAgent = String(form.get("assignedAgent") ?? "dev-builder").trim();
  const priority = String(form.get("priority") ?? "normal").trim();
  const riskLevel = String(form.get("riskLevel") ?? "medium").trim();

  if (!ownerRequest) {
    return redirectTo("/?view=tasks&error=empty-task");
  }

  await createTask({ ownerRequest, routeType, assignedDepartment, assignedAgent, priority, riskLevel });
  return redirectTo("/?view=tasks&created=1");
}
