import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const artifactRoot = process.env.COMMAND_CENTER_ARTIFACT_DIR ?? "/root/home/ai-dev-office/artifacts";

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if ([".jpg", ".jpeg"].includes(ext)) return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".avif") return "image/avif";
  if ([".md", ".markdown"].includes(ext)) return "text/markdown; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if ([".txt", ".log"].includes(ext)) return "text/plain; charset=utf-8";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawPath = url.searchParams.get("path");
  if (!rawPath) return new Response("Missing artifact path", { status: 400 });

  const filePath = path.resolve(rawPath);
  const root = path.resolve(artifactRoot);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    return new Response("Artifact path is outside allowed root", { status: 403 });
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new Response("Artifact is not a file", { status: 404 });
    const body = await readFile(filePath);
    return new Response(body, {
      headers: {
        "Content-Type": contentTypeFor(filePath),
        "Content-Length": String(info.size),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return new Response("Artifact not found", { status: 404 });
  }
}
