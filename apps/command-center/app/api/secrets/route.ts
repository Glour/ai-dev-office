import { deleteSecret, upsertSecret } from "@/app/lib/office";

export const dynamic = "force-dynamic";

function redirectTo(location: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: location },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const action = String(form.get("action") ?? "save");
  const id = String(form.get("id") ?? "").trim();

  try {
    if (action === "delete") {
      if (!id) return redirectTo("/?view=secrets&error=missing-id");
      await deleteSecret(id);
      return redirectTo("/?view=secrets&deleted=1");
    }

    const name = String(form.get("name") ?? "").trim();
    const slug = String(form.get("slug") ?? "").trim();
    const secretType = String(form.get("secretType") ?? "generic").trim();
    const status = String(form.get("status") ?? "active").trim();
    const scopeDepartment = String(form.get("scopeDepartment") ?? "").trim();
    const scopeAgent = String(form.get("scopeAgent") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const secretValue = String(form.get("secretValue") ?? "");

    if (!name || !slug || !secretValue.trim()) return redirectTo("/?view=secrets&error=empty-secret");

    await upsertSecret({
      id: id || undefined,
      name,
      slug,
      secretType,
      status,
      scopeDepartment,
      scopeAgent,
      description,
      secretValue,
    });
    return redirectTo("/?view=secrets&saved=1");
  } catch (error) {
    const message = error instanceof Error ? error.message : "secret-save-failed";
    return redirectTo(`/?view=secrets&error=${encodeURIComponent(message.slice(0, 120))}`);
  }
}
