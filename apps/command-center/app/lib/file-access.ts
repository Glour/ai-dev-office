import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const artifactRoot = process.env.COMMAND_CENTER_ARTIFACT_DIR ?? "/root/home/ai-dev-office/artifacts";
export const materialsRoot = process.env.COMMAND_CENTER_MATERIALS_DIR ?? "/root/home/ai-dev-office/materials";
export const uploadRoot = process.env.COMMAND_CENTER_UPLOAD_DIR ?? path.join(process.cwd(), "public", "uploads");

const allowedRoots = [artifactRoot, materialsRoot, uploadRoot].map((root) => path.resolve(root));

export function contentTypeForFile(filePath: string) {
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

export function resolveAllowedFile(rawPath: string) {
  const filePath = path.resolve(rawPath);
  const allowed = allowedRoots.some((root) => filePath === root || filePath.startsWith(`${root}${path.sep}`));
  if (!allowed) throw new Error("File path is outside allowed roots");
  return filePath;
}

export function publicFileUri(uri: string) {
  if (uri.startsWith("/root/") || uri.startsWith(uploadRoot)) {
    return `/api/files?path=${encodeURIComponent(uri)}`;
  }
  return uri;
}

export function isEditableTextFile(filePath: string) {
  const type = contentTypeForFile(filePath);
  return type.startsWith("text/") || type.startsWith("application/json");
}

export async function readAllowedFile(rawPath: string) {
  const filePath = resolveAllowedFile(rawPath);
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error("Not a file");
  return {
    body: await readFile(filePath),
    contentType: contentTypeForFile(filePath),
    size: info.size,
  };
}

export async function writeAllowedTextFile(rawPath: string, content: string) {
  const filePath = resolveAllowedFile(rawPath);
  if (!isEditableTextFile(filePath)) throw new Error("Only text files can be edited");
  await writeFile(filePath, content, "utf8");
  return filePath;
}
