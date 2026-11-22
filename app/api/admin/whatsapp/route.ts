import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, requireAdmin } from "@/lib/auth/admin";
import { loadStored, saveStored } from "@/lib/providers/config";
import { getWorkerConfig, workerCall } from "@/lib/whatsapp/worker";
import { fail, internalError } from "@/lib/http";

const putSchema = z.object({ enabled: z.boolean(), workerUrl: z.string().url().max(300), workerSecret: z.string().min(16).max(200).optional() });
const actSchema = z.object({ action: z.enum(["qr", "code", "logout"]), phone: z.string().regex(/^\+?\d{8,15}$/).optional() });

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const s = await loadStored("whatsapp");
    const cfg = await getWorkerConfig();
    let worker: any = null, error = "";
    if (cfg) {
      try {
        const r = await workerCall(cfg, "/status");
        if (r.ok) worker = r.data; else error = r.status === 401 ? "Worker rejected the secret. Make sure it matches WORKER_SECRET." : "Worker returned an error.";
      } catch { error = "Cannot reach the worker. Check the URL and that it is running."; }
    }
    return NextResponse.json({
      success: true, mode: s ? (s.settings.mode === "qr" ? "qr" : "official") : cfg ? "qr" : "none",
      enabled: cfg?.enabled ?? false, workerUrl: cfg?.url ?? "", hasSecret: !!cfg, worker, error,
    });
  } catch (e) { return internalError(e); }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = putSchema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Enter a valid worker URL and a secret of 16+ characters.");
    const existing = await loadStored("whatsapp");
    if (!p.data.workerSecret && !(existing?.settings.mode === "qr" && existing.secrets.workerSecret))
      return fail(400, "INVALID_REQUEST", "Worker secret is required the first time.");
    await saveStored("whatsapp", p.data.enabled, { mode: "qr", workerUrl: p.data.workerUrl }, { workerSecret: p.data.workerSecret });
    await audit(admin.id, "provider.whatsapp_qr.update", "provider", "whatsapp", { enabled: p.data.enabled });
    return NextResponse.json({ success: true });
  } catch (e) { return internalError(e); }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = actSchema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Invalid request");
    const cfg = await getWorkerConfig();
    if (!cfg) return fail(400, "PROVIDER_NOT_CONFIGURED", "Save the worker URL and secret first.");
    const { action, phone } = p.data;
    if (action === "code" && !phone) return fail(400, "INVALID_REQUEST", "Enter the WhatsApp number with country code.");
    const path = action === "qr" ? "/link/qr" : action === "code" ? "/link/code" : "/logout";
    let r;
    try { r = await workerCall(cfg, path, "POST", action === "code" ? { phone } : {}); }
    catch { return fail(502, "WORKER_UNREACHABLE", "Cannot reach the worker."); }
    if (!r.ok) {
      const m: Record<string, string> = { ALREADY_LINKED: "A number is already linked. Unlink it first.", NOT_READY: "Worker is not ready yet. Try again in a few seconds.", INVALID_PHONE: "Invalid phone number.", UNAUTHORIZED: "Worker rejected the secret." };
      await audit(admin.id, `provider.whatsapp_qr.${action}`, "provider", "whatsapp", { ok: false });
      return fail(502, "WORKER_ERROR", m[r.data?.error] ?? "Worker could not complete the request.");
    }
    await audit(admin.id, `provider.whatsapp_qr.${action}`, "provider", "whatsapp", { ok: true });
    return NextResponse.json({ success: true, ...r.data });
  } catch (e) { return internalError(e); }
}
