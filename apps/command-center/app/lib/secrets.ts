import { createCipheriv, createHash, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";

function decodeKey(raw: string) {
  const trimmed = raw.trim();
  const base64 = Buffer.from(trimmed, "base64");
  if (base64.length === 32) return base64;
  const hex = Buffer.from(trimmed, "hex");
  if (hex.length === 32) return hex;
  throw new Error("COMMAND_CENTER_SECRETS_KEY must be a 32-byte base64 or hex key");
}

export function getSecretsKeyStatus() {
  const raw = process.env.COMMAND_CENTER_SECRETS_KEY;
  if (!raw) return { configured: false, message: "COMMAND_CENTER_SECRETS_KEY не настроен" };
  try {
    decodeKey(raw);
    return { configured: true, message: "Vault key configured" };
  } catch (error) {
    return { configured: false, message: error instanceof Error ? error.message : "Invalid vault key" };
  }
}

export function encryptSecret(plaintext: string) {
  const raw = process.env.COMMAND_CENTER_SECRETS_KEY;
  if (!raw) throw new Error("COMMAND_CENTER_SECRETS_KEY не настроен");

  const key = decodeKey(raw);
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    algorithm,
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    fingerprint: createHash("sha256").update(plaintext).digest("hex").slice(0, 16),
  };
}
