import { NextResponse } from "next/server";
import { createTask } from "@/app/lib/office";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const ownerRequest = String(form.get("ownerRequest") ?? "").trim();
  const routeType = String(form.get("routeType") ?? "feature_development").trim();
  const assignedDepartment = String(form.get("assignedDepartment") ?? "development").trim();
  const assignedAgent = String(form.get("assignedAgent") ?? "dev-builder").trim();
  const priority = String(form.get("priority") ?? "normal").trim();
  const riskLevel = String(form.get("riskLevel") ?? "medium").trim();

  if (!ownerRequest) {
    return NextResponse.redirect(new URL("/?error=empty-task", request.url));
  }

  await createTask({ ownerRequest, routeType, assignedDepartment, assignedAgent, priority, riskLevel });
  return NextResponse.redirect(new URL("/", request.url));
}
