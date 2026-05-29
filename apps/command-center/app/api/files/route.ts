import { readAllowedFile } from "@/app/lib/file-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawPath = url.searchParams.get("path");
  if (!rawPath) return new Response("Missing file path", { status: 400 });

  try {
    const file = await readAllowedFile(rawPath);
    return new Response(file.body, {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.size),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File not found";
    return new Response(message, { status: message.includes("outside") ? 403 : 404 });
  }
}
