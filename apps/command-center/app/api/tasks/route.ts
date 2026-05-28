import { createArtifact, createTask, queryRows } from "@/app/lib/office";
import { storeUploads } from "@/app/lib/uploads";

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
  const routeType = String(form.get("routeType") ?? "owner_request").trim();
  const assignedDepartment = String(form.get("assignedDepartment") ?? "management").trim();
  const assignedAgent = String(form.get("assignedAgent") ?? "owner-assistant").trim();
  const priority = String(form.get("priority") ?? "normal").trim();
  const riskLevel = String(form.get("riskLevel") ?? "medium").trim();
  const files = form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);

  if (!ownerRequest) {
    return redirectTo("/?view=tasks&error=empty-task");
  }

  const uploads = await storeUploads(files, "tasks");
  const ownerRequestWithFiles = uploads.length > 0
    ? `${ownerRequest}\n\nВложения:\n${uploads.map((upload) => `- ${upload.originalName}: ${upload.uri}`).join("\n")}`
    : ownerRequest;
  const task = await createTask({ ownerRequest: ownerRequestWithFiles, routeType, assignedDepartment, assignedAgent, priority, riskLevel });
  for (const upload of uploads) {
    await createArtifact({
      taskId: task.id,
      artifactType: "upload",
      title: upload.originalName,
      uri: upload.uri,
      checksum: upload.checksum,
      metadata: {
        content_type: upload.contentType,
        size: upload.size,
        original_name: upload.originalName,
      },
    });
  }
  if (uploads.length > 0) {
    await queryRows(`
      UPDATE tasks
      SET metadata = metadata || jsonb_build_object('uploaded_files', $2::jsonb),
          updated_at = now()
      WHERE id = $1::uuid
    `, [task.id, JSON.stringify(uploads)]);
    await queryRows(`
      INSERT INTO events (task_id, event_type, actor, severity, message, payload)
      VALUES ($1::uuid, 'task.files.uploaded', 'command-center', 'info', 'К задаче прикреплены файлы', jsonb_build_object('files', $2::jsonb))
    `, [task.id, JSON.stringify(uploads.map((upload) => ({ name: upload.originalName, uri: upload.uri, size: upload.size })))]);
  }
  return redirectTo("/?view=tasks&created=1");
}
