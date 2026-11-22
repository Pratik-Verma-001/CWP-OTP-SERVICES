import { loadStored } from "@/lib/providers/config";
import type { Result } from "@/lib/smtp";

export type WorkerCfg = { url: string; secret: string; enabled: boolean };

// QR/pairing mode config: dashboard settings first, env vars as fallback.
export async function getWorkerConfig(): Promise<WorkerCfg | null> {
  const s = await loadStored("whatsapp");
  if (s) {
    if (s.settings.mode !== "qr" || !s.settings.workerUrl || !s.secrets.workerSecret) return null;
    return { url: String(s.settings.workerUrl).replace(/\/+$/, ""), secret: s.secrets.workerSecret, enabled: s.enabled };
  }
  const u = process.env.WHATSAPP_WORKER_URL, k = process.env.WHATSAPP_WORKER_SECRET;
  return u && k ? { url: u.replace(/\/+$/, ""), secret: k, enabled: true } : null;
}

export async function workerCall(c: WorkerCfg, path: string, method = "GET", body?: object) {
  const res = await fetch(c.url + path, {
    method, cache: "no-store", signal: AbortSignal.timeout(25000),
    headers: { "x-worker-secret": c.secret, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function sendViaWorker(c: WorkerCfg, to: string, code: string, ttlSeconds = 300): Promise<Result> {
  const text = `Your CWP OTP code is *${code}*. It expires in ${Math.round(ttlSeconds / 60)} minutes. Do not share this code with anyone. If you did not request it, ignore this message.`;
  try {
    const r = await workerCall(c, "/send", "POST", { to, text });
    if (r.ok) return { ok: true, messageId: r.data?.messageId };
    const e = r.data?.error;
    if (e === "NOT_LINKED") return { ok: false, code: "WHATSAPP_NOT_LINKED", message: "WhatsApp device is not linked. Scan the QR in Providers." };
    if (e === "NOT_ON_WHATSAPP") return { ok: false, code: "WHATSAPP_RECIPIENT_NOT_FOUND", message: "Recipient is not on WhatsApp." };
    if (e === "RATE_LIMITED" || r.status === 429) return { ok: false, code: "WHATSAPP_RATE_LIMITED", message: "WhatsApp send limit reached. Try again shortly." };
    if (r.status === 401) return { ok: false, code: "WHATSAPP_WORKER_AUTH", message: "Worker secret does not match." };
    return { ok: false, code: "WHATSAPP_SEND_FAILED", message: "WhatsApp delivery failed." };
  } catch {
    return { ok: false, code: "WHATSAPP_WORKER_UNREACHABLE", message: "Cannot reach the WhatsApp worker." };
  }
}
