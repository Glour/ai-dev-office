import { NextResponse } from "next/server";
import { createMaterial } from "@/app/lib/office";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const materialType = String(form.get("materialType") ?? "instruction").trim();
  const status = String(form.get("status") ?? "draft").trim();
  const storageUri = String(form.get("storageUri") ?? "").trim();
  const sourceSummary = String(form.get("sourceSummary") ?? "").trim();

  if (!title || !storageUri) {
    return NextResponse.redirect(new URL("/?error=empty-material", request.url));
  }

  await createMaterial({ title, materialType, status, storageUri, sourceSummary });
  return NextResponse.redirect(new URL("/", request.url));
}
