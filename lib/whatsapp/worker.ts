import { createCipheriv, createHash, randomBytes } from "crypto";
import { db } from "@/lib/supabase/admin";
import { decrypt, encrypt, hmac, safeEqualHex } from "@/lib/security/crypto";
import { loadStored } from "@/lib/providers/config";
import type { Result } from "@/lib/smtp";

// The worker connects OUT to the app (polling /api/worker/*), so no tunnel and no changing URL.
// Job payloads (which contain OTP text) are AES-GCM encrypted with a key derived from the worker token,
// are cleared as soon as the job finishes, and are never stored in plaintext.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ONLINE_MS = 30000;
const now = () => new Date().toISOString();

const jobKey = (t: string) => createHash("sha256").update("cwp-wa-job:" + t).digest();
export function sealJob(token: string, obj: object): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", jobKey(token), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
export const tokenHash = (t: string) => hmac("API_KEY_PEPPER", "wa-worker:" + t);

export async function rotateWorkerToken(): Promise<string> {
  const token = "cwpw_" + randomBytes(24).toString("base64url");
  const { error } = await db().from("wa_worker").update({ token_hash: tokenHash(token), token_enc: encrypt(token), state: "offline", qr: null, phone: null, last_seen: null, updated_at: now() }).eq("id", 1);
  if (error) throw error;
  return token;
}
export async function revealWorkerToken(): Promise<string | null> {
  const { data } = await db().from("wa_worker").select("token_enc").eq("id", 1).maybeSingle();
  try { return data?.token_enc ? decrypt(data.token_enc) : null; } catch { return null; }
}
export async function authWorker(req: Request): Promise<boolean> {
  const t = req.headers.get("x-worker-token");
  if (!t || t.length > 100) return false;
  const { data } = await db().from("wa_worker").select("token_hash").eq("id", 1).maybeSingle();
  return !!data?.token_hash && safeEqualHex(tokenHash(t), data.token_hash);
}
export async function workerStatus() {
  const { data } = await db().from("wa_worker").select("state,qr,phone,last_seen,token_hash,last_error,qr_at,worker_version").eq("id", 1).maybeSingle();
  const online = !!data?.last_seen && Date.now() - new Date(data.last_seen).getTime() < ONLINE_MS;
  return {
    hasToken: !!data?.token_hash, online, state: online ? (data?.state ?? "disconnected") : "offline",
    qr: online ? data?.qr ?? null : null, phone: online ? data?.phone ?? null : null, lastSeen: data?.last_seen ?? null,
    qrAt: online && data?.qr ? data?.qr_at ?? null : null, lastError: online ? data?.last_error ?? null : null, version: data?.worker_version ?? null,
  };
}
export async function workerMode(): Promise<"none" | "disabled" | "enabled"> {
  const s = await loadStored("whatsapp");
  if (s && s.settings.mode !== "qr") return "none"; // official Cloud API settings are stored instead
  const { data } = await db().from("wa_worker").select("token_hash").eq("id", 1).maybeSingle();
  if (!data?.token_hash) return "none";
  return s ? (s.enabled ? "enabled" : "disabled") : "enabled";
}

export async function enqueue(kind: "send" | "qr" | "code" | "logout", payload?: object): Promise<string> {
  const token = await revealWorkerToken();
  if (!token) throw new Error("no_worker_token");
  const { data, error } = await db().from("wa_jobs").insert({ kind, payload: payload ? sealJob(token, payload) : null }).select("id").single();
  if (error || !data) throw new Error("enqueue_failed");
  return data.id;
}
export async function waitJob(id: string, ms: number): Promise<{ status: string; result: any } | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const { data } = await db().from("wa_jobs").select("status,result").eq("id", id).maybeSingle();
    if (data && (data.status === "done" || data.status === "failed")) return data as any;
    await sleep(500);
  }
  await db().from("wa_jobs").update({ status: "failed", result: { error: "TIMEOUT" }, payload: null, finished_at: now() }).eq("id", id).eq("status", "queued");
  return null;
}

export async function sendViaWorker(to: string, code: string, ttlSeconds = 300): Promise<Result> {
  const st = await workerStatus();
  if (!st.online) return { ok: false, code: "WHATSAPP_WORKER_UNREACHABLE", message: "WhatsApp worker is offline." };
  if (st.state !== "connected") return { ok: false, code: "WHATSAPP_NOT_LINKED", message: "WhatsApp device is not linked." };
  const text = `Your CWP OTP code is *${code}*. It expires in ${Math.round(ttlSeconds / 60)} minutes. Do not share this code with anyone. If you did not request it, ignore this message.`;
  try {
    const id = await enqueue("send", { to, text });
    const job = await waitJob(id, 12000);
    if (!job) return { ok: false, code: "WHATSAPP_TIMEOUT", message: "WhatsApp worker did not respond in time." };
    if (job.status === "done" && !job.result?.error) return { ok: true, messageId: job.result?.messageId };
    const e = job.result?.error;
    if (e === "NOT_LINKED") return { ok: false, code: "WHATSAPP_NOT_LINKED", message: "WhatsApp device is not linked." };
    if (e === "NOT_ON_WHATSAPP") return { ok: false, code: "WHATSAPP_RECIPIENT_NOT_FOUND", message: "Recipient is not on WhatsApp." };
    if (e === "RATE_LIMITED") return { ok: false, code: "WHATSAPP_RATE_LIMITED", message: "WhatsApp send limit reached. Try again shortly." };
    return { ok: false, code: "WHATSAPP_SEND_FAILED", message: "WhatsApp delivery failed." };
  } catch {
    return { ok: false, code: "WHATSAPP_WORKER_UNREACHABLE", message: "WhatsApp worker is not set up." };
  }
}

// Sanitise what the worker reports about itself.
const STATES = ["disconnected", "connecting", "qr", "connected"];
export const cleanReport = (b: any) => ({
  state: STATES.includes(b?.state) ? (b.state as string) : "disconnected",
  qr: typeof b?.qr === "string" && b.qr.startsWith("data:image/png;base64,") && b.qr.length < 40000 ? (b.qr as string) : null,
  phone: typeof b?.phone === "string" && /^\d{6,16}$/.test(b.phone) ? (b.phone as string) : null,
  last_error: typeof b?.error === "string" && b.error ? b.error.replace(/[^\x20-\x7E]/g, "").slice(0, 160) : null,
  worker_version: typeof b?.version === "string" ? b.version.replace(/[^\w.\-]/g, "").slice(0, 20) : null,
});
