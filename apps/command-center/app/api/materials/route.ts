import { createArtifact, createMaterial } from "@/app/lib/office";
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
  const title = String(form.get("title") ?? "").trim();
  const materialType = String(form.get("materialType") ?? "instruction").trim();
  const status = String(form.get("status") ?? "draft").trim();
  const storageUri = String(form.get("storageUri") ?? "").trim();
  const sourceSummary = String(form.get("sourceSummary") ?? "").trim();
  const files = form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);

  if (!title && !storageUri && files.length === 0) {
    return redirectTo("/?view=materials&error=empty-material");
  }

  const uploads = await storeUploads(files, "materials");
  if (uploads.length === 0) {
    await createMaterial({ title: title || storageUri, materialType, status, storageUri, sourceSummary });
  } else {
    for (const [index, upload] of uploads.entries()) {
      const material = await createMaterial({
        title: uploads.length === 1 ? title || upload.originalName : `${title || "Материал"} · ${upload.originalName}`,
        materialType,
        status,
        storageUri: upload.uri,
        sourceSummary,
      });
      if (material?.id) {
        await createArtifact({
          materialId: material.id,
          artifactType: "material_upload",
          title: upload.originalName,
          uri: upload.uri,
          checksum: upload.checksum,
          metadata: {
            content_type: upload.contentType,
            size: upload.size,
            original_name: upload.originalName,
            batch_index: index,
          },
        });
      }
    }
  }
  return redirectTo("/?view=materials&created=1");
}
