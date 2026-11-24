import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/supabase/admin";
import { getSmtpConfig } from "@/lib/smtp";
import { workerStatus } from "@/lib/whatsapp/worker";
import { fail, internalError } from "@/lib/http";

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const head = (t: string) => db().from(t).select("id", { count: "exact", head: true });
    const [users, pending, projects, keys, otp, failed, pendingList] = await Promise.all([
      head("admin_profiles"), head("admin_profiles").eq("status", "pending"), head("projects"), head("api_keys").eq("status", "active"),
      head("otp_requests").gte("created_at", since), head("otp_requests").gte("created_at", since).eq("status", "failed"),
      db().from("admin_profiles").select("id,email,display_name,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
    ]);
    return NextResponse.json({
      success: true, users: users.count ?? 0, pending: pending.count ?? 0, projects: projects.count ?? 0, keys: keys.count ?? 0,
      otp7d: otp.count ?? 0, failed7d: failed.count ?? 0, pendingUsers: pendingList.data ?? [],
      email: !!(await getSmtpConfig()), worker: await workerStatus(),
    });
  } catch (e) { return internalError(e); }
}
