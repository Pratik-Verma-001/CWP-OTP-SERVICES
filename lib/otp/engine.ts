import { randomInt, randomUUID } from "crypto";
import { db } from "@/lib/supabase/admin";
import { hmac, hashIp, hashRecipient, maskRecipient, safeEqualHex } from "@/lib/security/crypto";
import { deliver } from "@/lib/providers";
import type { AuthedKey } from "@/lib/api-keys";

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 300;
const LIMITS = { cooldownSec: 60, perRecipientHour: 5, perKeyMinute: 60, perIpHour: 20 };

export const generateCode = (len = OTP_LENGTH) => randomInt(0, 10 ** len).toString().padStart(len, "0");
export const hashOtp = (requestId: string, code: string) => hmac("OTP_HMAC_SECRET", `otp:${requestId}:${code}`);

const since = (sec: number) => new Date(Date.now() - sec * 1000).toISOString();
const count = async (col: string, val: string, sec: number) => {
  const { count } = await db().from("otp_requests").select("id", { count: "exact", head: true }).eq(col, val).gte("created_at", since(sec));
  return count ?? 0;
};

type SendInput = { channel: "email" | "whatsapp"; recipient: string; ip: string };
export type SendOutcome =
  | { ok: true; requestId: string; expiresIn: number }
  | { ok: false; status: number; code: string; message: string };

export async function sendOtp(key: AuthedKey, input: SendInput): Promise<SendOutcome> {
  const recipientHash = hashRecipient(input.channel, input.recipient);
  const ipHash = hashIp(input.ip);

  if ((await count("api_key_id", key.keyId, 60)) >= LIMITS.perKeyMinute)
    return { ok: false, status: 429, code: "RATE_LIMITED", message: "API key rate limit exceeded" };
  if ((await count("ip_hash", ipHash, 3600)) >= LIMITS.perIpHour)
    return { ok: false, status: 429, code: "RATE_LIMITED", message: "Too many requests from this IP" };
  if ((await count("recipient_hash", recipientHash, LIMITS.cooldownSec)) > 0)
    return { ok: false, status: 429, code: "RESEND_COOLDOWN", message: `Wait ${LIMITS.cooldownSec}s before requesting another code` };
  if ((await count("recipient_hash", recipientHash, 3600)) >= LIMITS.perRecipientHour)
    return { ok: false, status: 429, code: "RATE_LIMITED", message: "Too many codes for this recipient" };

  const requestId = randomUUID();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  const { error } = await db().from("otp_requests").insert({
    id: requestId, project_id: key.projectId, api_key_id: key.keyId,
    recipient_hash: recipientHash, masked_recipient: maskRecipient(input.channel, input.recipient),
    ip_hash: ipHash, channel: input.channel, otp_hash: hashOtp(requestId, code), expires_at: expiresAt,
  });
  if (error) throw new Error("db_insert_failed");

  const res = await deliver(input.channel, input.recipient, code, OTP_TTL_SECONDS, key.projectId);
  await db().from("delivery_logs").insert({
    otp_request_id: requestId, provider: input.channel === "email" ? "smtp" : "whatsapp",
    provider_message_id: res.ok ? res.messageId ?? null : null,
    status: res.ok ? "sent" : "failed", error_code: res.ok ? null : res.code, error_message: res.ok ? null : res.message,
  });
  await db().from("otp_requests").update({ status: res.ok ? "sent" : "failed" }).eq("id", requestId);

  if (!res.ok) return { ok: false, status: 503, code: res.code, message: res.message };
  return { ok: true, requestId, expiresIn: OTP_TTL_SECONDS };
}

// Every failure returns the same generic result so callers can't probe state.
export async function verifyOtp(key: AuthedKey, requestId: string, code: string): Promise<boolean> {
  const { data: r } = await db().from("otp_requests")
    .select("id,otp_hash,status,expires_at,attempts,max_attempts,consumed_at")
    .eq("id", requestId).eq("project_id", key.projectId).maybeSingle();
  if (!r || r.consumed_at || r.status !== "sent") return false;
  if (new Date(r.expires_at).getTime() < Date.now()) {
    await db().from("otp_requests").update({ status: "expired" }).eq("id", r.id);
    return false;
  }
  if (r.attempts >= r.max_attempts) return false;

  // Optimistic attempt increment: concurrent guesses can't skip the counter.
  const { data: bumped } = await db().from("otp_requests")
    .update({ attempts: r.attempts + 1, ...(r.attempts + 1 >= r.max_attempts ? { status: "locked" } : {}) })
    .eq("id", r.id).eq("attempts", r.attempts).select("id");
  if (!bumped?.length) return false;

  if (!safeEqualHex(hashOtp(r.id, code), r.otp_hash)) return false;

  // Atomic single-use consume.
  const { data: consumed } = await db().from("otp_requests")
    .update({ status: "verified", consumed_at: new Date().toISOString() })
    .eq("id", r.id).is("consumed_at", null).eq("status", "sent").select("id");
  return !!consumed?.length;
}
