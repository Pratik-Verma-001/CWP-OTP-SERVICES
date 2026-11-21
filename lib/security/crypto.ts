import { createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from "crypto";
import { env } from "@/lib/env";

export const hmac = (secretName: string, value: string) =>
  createHmac("sha256", env(secretName)).update(value).digest("hex");

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

// AES-256-GCM for provider credentials stored in the database.
function key(): Buffer {
  const k = Buffer.from(env("ENCRYPTION_KEY"), "hex");
  if (k.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  return k;
}
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

export const hashRecipient = (channel: string, recipient: string) =>
  hmac("OTP_HMAC_SECRET", `recipient:${channel}:${recipient.toLowerCase()}`);
export const hashIp = (ip: string) => hmac("OTP_HMAC_SECRET", `ip:${ip}`);

export function maskRecipient(channel: string, r: string): string {
  if (channel === "email") {
    const [u, d] = r.split("@");
    return `${u.slice(0, 1)}***@${d}`;
  }
  return `${r.slice(0, 3)}******${r.slice(-2)}`;
}
