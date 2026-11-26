import { NextResponse } from "next/server";
import { z } from "zod";
import { auditAdmin, requireAdmin } from "@/lib/admin-auth";
import { DEFAULT_LIMITS, getSetting, setSetting, type Limits } from "@/lib/platform";
import { fail, internalError } from "@/lib/http";

const n = z.number().int().min(0).max(1000000);
const schema = z.object({
  registration: z.enum(["open", "approval", "closed"]), maintenance: z.boolean(), announcement: z.string().max(300),
  limits: z.object({ maxProjects: n, maxKeysPerProject: n, dailyOtpLimit: n }),
});

export async function GET(req: Request) {
  try {
    if (!(await requireAdmin(req))) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const [registration, maintenance, announcement, limits] = await Promise.all([
      getSetting<string>("registration", "approval"), getSetting<boolean>("maintenance", false), getSetting<string>("announcement", ""), getSetting<Partial<Limits>>("limits", {}),
    ]);
    return NextResponse.json({ success: true, registration, maintenance, announcement, limits: { ...DEFAULT_LIMITS, ...limits } });
  } catch (e) { return internalError(e); }
}
export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = schema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Invalid settings");
    await Promise.all([setSetting("registration", p.data.registration), setSetting("maintenance", p.data.maintenance), setSetting("announcement", p.data.announcement), setSetting("limits", p.data.limits)]);
    await auditAdmin("settings.update", "settings", "platform", { registration: p.data.registration, maintenance: p.data.maintenance });
    return NextResponse.json({ success: true });
  } catch (e) { return internalError(e); }
}
