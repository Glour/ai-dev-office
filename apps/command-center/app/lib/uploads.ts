import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredUpload = {
  originalName: string;
  fileName: string;
  contentType: string;
  size: number;
  checksum: string;
  uri: string;
};

const uploadRoot = process.env.COMMAND_CENTER_UPLOAD_DIR
  ?? path.join(process.cwd(), "public", "uploads");

function safeName(name: string) {
  const ext = path.extname(name).slice(0, 16);
  const base = path.basename(name, ext).replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  return `${base || "file"}${ext}`;
}

export async function storeUploads(files: File[], namespace: string): Promise<StoredUpload[]> {
  const usableFiles = files.filter((file) => file.size > 0);
  if (usableFiles.length === 0) return [];

  const day = new Date().toISOString().slice(0, 10);
  const dir = path.join(uploadRoot, namespace, day);
  await mkdir(dir, { recursive: true });

  const stored: StoredUpload[] = [];
  for (const file of usableFiles) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash("sha256").update(buffer).digest("hex");
    const fileName = `${randomUUID()}-${safeName(file.name)}`;
    const filePath = path.join(dir, fileName);
    await writeFile(filePath, buffer);
    stored.push({
      originalName: file.name,
      fileName,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      checksum,
      uri: `/uploads/${namespace}/${day}/${fileName}`,
    });
  }

  return stored;
}
