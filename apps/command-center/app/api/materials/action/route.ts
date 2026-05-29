import { updateMaterial } from "@/app/lib/office";

export const dynamic = "force-dynamic";

function redirectTo(location: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: location },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const status = String(form.get("status") ?? "draft").trim();
  const sourceSummary = String(form.get("sourceSummary") ?? "").trim();
  const content = form.has("content") ? String(form.get("content") ?? "") : undefined;

  if (!id || !title) return redirectTo("/?view=materials&error=missing-material");

  try {
    await updateMaterial({ id, title, status, sourceSummary, content });
    return redirectTo("/?view=materials&updated=1");
  } catch (error) {
    const message = error instanceof Error ? error.message : "material-update-failed";
    return redirectTo(`/?view=materials&error=${encodeURIComponent(message.slice(0, 120))}`);
  }
}
