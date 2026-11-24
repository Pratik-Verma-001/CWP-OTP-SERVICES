import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/admin";
import { ownedProjects } from "@/lib/auth/scope";
import { db } from "@/lib/supabase/admin";
import { getSmtpConfig } from "@/lib/smtp";
import { getWaConfig } from "@/lib/whatsapp";
import { workerMode, workerStatus } from "@/lib/whatsapp/worker";
import { fail, internalError } from "@/lib/http";

export async function GET(req: Request) {
  try {
    const admin = await requireUser(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const ids = (await ownedProjects(admin.id)).map((p) => p.id);
    let keys = 0, tested = 0, ownEmail = false;
    if (ids.length) {
      const [k, t, s] = await Promise.all([
        db().from("api_keys").select("id", { count: "exact", head: true }).in("project_id", ids).eq("status", "active"),
        db().from("otp_requests").select("id", { count: "exact", head: true }).in("project_id", ids),
        db().from("project_smtp").select("project_id").in("project_id", ids).eq("enabled", true).limit(1),
      ]);
      keys = k.count ?? 0; tested = t.count ?? 0; ownEmail = !!s.data?.length;
    }
    const mode = await workerMode();
    const whatsapp = mode === "enabled" ? (await workerStatus()).state === "connected" : mode === "none" ? !!(await getWaConfig()) : false;
    return NextResponse.json({ success: true, projects: ids.length, keys, tested, email: ownEmail || !!(await getSmtpConfig()), whatsapp });
  } catch (e) { return internalError(e); }
}
