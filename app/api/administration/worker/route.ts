import { NextResponse } from "next/server";
import { z } from "zod";
import { auditAdmin, requireAdmin } from "@/lib/admin-auth";
import { loadStored, saveStored } from "@/lib/providers/config";
import { enqueue, revealWorkerToken, rotateWorkerToken, waitJob, workerStatus } from "@/lib/whatsapp/worker";
import { fail, internalError } from "@/lib/http";

export const maxDuration = 30;
const endpoint = (req: Request) => `${(process.env.APP_URL || new URL(req.url).origin).replace(/\/+$/, "")}/api/worker`;
const actSchema = z.object({ action: z.enum(["token", "reveal", "qr", "code", "logout", "test"]), phone: z.string().regex(/^\+?\d{8,15}$/).optional() });

export async function GET(req: Request) {
  try {
    if (!(await requireAdmin(req))) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const [status, s] = await Promise.all([workerStatus(), loadStored("whatsapp")]);
    const enabled = s && s.settings.mode === "qr" ? s.enabled : !s && status.hasToken;
    return NextResponse.json({ success: true, endpoint: endpoint(req), status, enabled, officialStored: !!s && s.settings.mode !== "qr" });
  } catch (e) { return internalError(e); }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const b = z.object({ enabled: z.boolean() }).safeParse(await req.json().catch(() => null));
    if (!b.success) return fail(400, "INVALID_REQUEST", "Invalid request");
    await saveStored("whatsapp", b.data.enabled, { mode: "qr" }, {});
    await auditAdmin("worker.enable", "provider", "whatsapp", { enabled: b.data.enabled });
    return NextResponse.json({ success: true });
  } catch (e) { return internalError(e); }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = actSchema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Invalid request");
    const { action, phone } = p.data;
    if (action === "token") {
      const token = await rotateWorkerToken();
      await auditAdmin("worker.token.rotate", "provider", "whatsapp");
      return NextResponse.json({ success: true, token });
    }
    if (action === "reveal") {
      const token = await revealWorkerToken();
      if (!token) return fail(404, "NOT_FOUND", "Generate a token first.");
      await auditAdmin("worker.token.reveal", "provider", "whatsapp");
      return NextResponse.json({ success: true, token });
    }
    if ((action === "code" || action === "test") && !phone) return fail(400, "INVALID_REQUEST", "Enter the WhatsApp number with country code.");
    const st = await workerStatus();
    if (!st.hasToken) return fail(400, "PROVIDER_NOT_CONFIGURED", "Generate a worker token first.");
    if (!st.online) return fail(400, "WORKER_OFFLINE", "The worker is offline. Start it first (see the command above).");
    const id = await enqueue(action === "test" ? "send" : action, action === "code" ? { phone } : action === "test" ? { to: phone, text: "CWP OTP Services: this is a test message. Your WhatsApp is connected." } : undefined);
    const job = await waitJob(id, action === "qr" || action === "code" ? 24000 : 15000);
    if (!job) return fail(504, "WORKER_TIMEOUT", "The worker did not answer in time. Try again.");
    if (job.status !== "done" || job.result?.error) {
      const m: Record<string, string> = { NOT_LINKED: "WhatsApp is not linked yet.", NOT_ON_WHATSAPP: "That number is not on WhatsApp.", RATE_LIMITED: "Send limit reached. Try again shortly.", ALREADY_LINKED: "A number is already linked. Unlink it first.", NOT_READY: "Worker is not ready yet. Try again in a few seconds.", INVALID_PHONE: "Invalid phone number." };
      return fail(502, "WORKER_ERROR", m[job.result?.error] ?? "The worker could not complete the request.");
    }
    await auditAdmin(`worker.${action}`, "provider", "whatsapp");
    return NextResponse.json({ success: true, code: job.result?.code, state: job.result?.state });
  } catch (e) { return internalError(e); }
}
