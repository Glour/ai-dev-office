import { deleteCapability, upsertCapability } from "@/app/lib/office";

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
      if (!id) return redirectTo("/?view=capabilities&error=missing-id");
      await deleteCapability(id);
      return redirectTo("/?view=capabilities&deleted=1");
    }

    const name = String(form.get("name") ?? "").trim();
    const slug = String(form.get("slug") ?? "").trim();
    const capabilityType = String(form.get("capabilityType") ?? "skill").trim();
    const status = String(form.get("status") ?? "active").trim();
    const scopeDepartment = String(form.get("scopeDepartment") ?? "").trim();
    const scopeAgent = String(form.get("scopeAgent") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const instructions = String(form.get("instructions") ?? "").trim();
    const config = String(form.get("config") ?? "{}").trim() || "{}";

    if (!name || !slug) return redirectTo("/?view=capabilities&error=empty-capability");

    await upsertCapability({
      id: id || undefined,
      capabilityType,
      name,
      slug,
      status,
      scopeDepartment,
      scopeAgent,
      description,
      instructions,
      config,
    });
    return redirectTo("/?view=capabilities&saved=1");
  } catch (error) {
    const message = error instanceof Error ? error.message : "capability-save-failed";
    return redirectTo(`/?view=capabilities&error=${encodeURIComponent(message.slice(0, 120))}`);
  }
}
