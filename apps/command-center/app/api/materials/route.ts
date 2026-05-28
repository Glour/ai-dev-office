import { createMaterial } from "@/app/lib/office";

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

  if (!title || !storageUri) {
    return redirectTo("/?view=materials&error=empty-material");
  }

  await createMaterial({ title, materialType, status, storageUri, sourceSummary });
  return redirectTo("/?view=materials&created=1");
}
