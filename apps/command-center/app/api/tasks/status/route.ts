import { updateTaskStatus } from "@/app/lib/office";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { taskId?: unknown; status?: unknown };
    const taskId = typeof body.taskId === "string" ? body.taskId : "";
    const status = typeof body.status === "string" ? body.status : "";

    if (!taskId || !status) {
      return Response.json({ ok: false, error: "taskId and status are required" }, { status: 400 });
    }

    await updateTaskStatus({ taskId, status });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update task status";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
