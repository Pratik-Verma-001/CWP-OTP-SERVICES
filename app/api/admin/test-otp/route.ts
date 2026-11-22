import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/supabase/admin";
import { sendOtp, verifyOtp } from "@/lib/otp/engine";
import { sendSchema } from "@/lib/validation/schemas";
import { clientIp, fail, internalError } from "@/lib/http";

const schema = z.object({
  action: z.enum(["send", "verify"]), projectId: z.string().uuid(),
  channel: z.enum(["email", "whatsapp"]).optional(), recipient: z.string().max(254).optional(),
  requestId: z.string().uuid().optional(), code: z.string().regex(/^\d{4,10}$/).optional(),
});

// Runs the REAL send/verify engine (real email/WhatsApp, same limits) for an admin's own project.
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = schema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Invalid request");
    const { data: project } = await db().from("projects").select("id,name").eq("id", p.data.projectId).eq("owner_id", admin.id).maybeSingle();
    if (!project) return fail(404, "NOT_FOUND", "Project not found");
    const { data: k } = await db().from("api_keys").select("id").eq("project_id", project.id).eq("status", "active").limit(1).maybeSingle();
    if (!k) return fail(400, "NO_API_KEY", "Create an API key for this project first.");
    const key = { keyId: k.id, projectId: project.id, projectName: project.name, allowedOrigins: [] as string[] };

    if (p.data.action === "send") {
      const v = sendSchema.safeParse({ channel: p.data.channel, recipient: p.data.recipient, project: project.name });
      if (!v.success) return fail(400, "INVALID_REQUEST", p.data.channel === "whatsapp" ? "Use the number with country code, e.g. +919876543210." : "Enter a valid email address.");
      const out = await sendOtp(key, { channel: v.data.channel, recipient: v.data.recipient, ip: clientIp(req) });
      if (!out.ok) return fail(out.status, out.code, out.message);
      return NextResponse.json({ success: true, requestId: out.requestId, expiresIn: out.expiresIn });
    }
    if (!p.data.requestId || !p.data.code) return fail(400, "INVALID_REQUEST", "Enter the code you received.");
    return NextResponse.json({ success: true, verified: await verifyOtp(key, p.data.requestId, p.data.code) });
  } catch (e) { return internalError(e); }
}
