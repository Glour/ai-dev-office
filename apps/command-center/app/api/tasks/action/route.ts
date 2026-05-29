import { archiveTask, deleteTask, resumeTaskWithOwnerInput } from "@/app/lib/office";

export const dynamic = "force-dynamic";

function redirectTo(location: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: location },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const taskId = String(form.get("taskId") ?? "").trim();
  const action = String(form.get("action") ?? "").trim();
  const redirect = String(form.get("redirect") ?? "/?view=tasks").trim() || "/?view=tasks";

  if (!taskId) {
    return redirectTo(`${redirect}&error=missing-task`);
  }

  if (action === "archive") {
    await archiveTask(taskId);
    return redirectTo(`${redirect}&archived=1`);
  }

  if (action === "delete") {
    await deleteTask(taskId);
    return redirectTo(`${redirect}&deleted=1`);
  }

  if (action === "owner_followup") {
    const ownerInput = String(form.get("ownerInput") ?? "").trim();
    if (!ownerInput) return redirectTo(`${redirect}&error=empty-owner-input`);
    await resumeTaskWithOwnerInput({ taskId, ownerInput });
    return redirectTo(`${redirect}&resumed=1&task=${taskId}`);
  }

  return redirectTo(`${redirect}&error=unknown-action`);
}
