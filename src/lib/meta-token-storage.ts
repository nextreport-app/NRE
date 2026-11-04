import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { ServiceError } from "./service-error";
const PREFIX = "nre-meta-v1:";
function keys(): Buffer[] {
  const secrets = [
    process.env.META_TOKEN_ENCRYPTION_KEY,
    process.env.AUTH_SECRET,
    process.env.NEXTAUTH_SECRET,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => !!value && value.length >= 32);
  if (!secrets.length)
    throw new ServiceError(
      "Meta token protection is not configured. Contact support.",
      503,
    );
  return [...new Set(secrets)].map((secret) =>
    createHash("sha256")
      .update("nextreport:meta-token:v1\0")
      .update(secret)
      .digest(),
  );
}
export function isEncryptedMetaToken(value: string): boolean {
  return value.startsWith(PREFIX);
}
/** AES-256-GCM: random nonce and authenticated ciphertext, never a browser-readable token. */
export function encryptMetaToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys()[0], iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return (
    PREFIX +
    [iv, cipher.getAuthTag(), encrypted]
      .map((value) => value.toString("base64url"))
      .join(".")
  );
}
export function decryptMetaToken(stored: string): string {
  // Existing records are upgraded on the next successful account read/sync.
  if (!isEncryptedMetaToken(stored)) return stored;
  const [nonce, tag, ciphertext, extra] = stored
    .slice(PREFIX.length)
    .split(".");
  if (!nonce || !tag || !ciphertext || extra)
    throw new ServiceError("Reconnect Meta Ads to continue.", 409);
  for (const key of keys())
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(nonce, "base64url"),
      );
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      /* Try the existing auth key when introducing a dedicated key. */
    }
  throw new ServiceError("Reconnect Meta Ads to continue.", 409);
}
