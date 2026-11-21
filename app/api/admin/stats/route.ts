import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { ownedProjects } from "@/lib/auth/scope";
import { db } from "@/lib/supabase/admin";
import { fail, internalError } from "@/lib/http";

const day = (iso: string) => iso.slice(0, 10);

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get("days") ?? "7") || 7));
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const todayStart = new Date(new Date().toISOString().slice(0, 10)).toISOString();

    const projects = await ownedProjects(admin.id);
    const { count: activeProjects } = await db().from("projects").select("id", { count: "exact", head: true }).eq("owner_id", admin.id).eq("status", "active");
    const ids = projects.map((p) => p.id);
    if (!ids.length) return NextResponse.json({ success: true, empty: true, totals: {}, daily: [], byProject: [], recent: [] });

    const [otp, verify, keys, recent] = await Promise.all([
      db().from("otp_requests").select("project_id,channel,status,created_at").in("project_id", ids).gte("created_at", since).limit(20000),
      db().from("api_usage").select("status_code").in("project_id", ids).eq("endpoint", "otp/verify").gte("created_at", since).limit(20000),
      db().from("api_keys").select("id", { count: "exact", head: true }).in("project_id", ids).eq("status", "active"),
      db().from("otp_requests").select("id,channel,status,masked_recipient,created_at,projects(name)").in("project_id", ids).order("created_at", { ascending: false }).limit(10),
    ]);
    const rows = otp.data ?? [];
    const names = Object.fromEntries(projects.map((p) => [p.id, p.name]));
    const daily: Record<string, { email: number; whatsapp: number; failed: number }> = {};
    const byProject: Record<string, number> = {};
    for (const r of rows) {
      const d = (daily[day(r.created_at)] ??= { email: 0, whatsapp: 0, failed: 0 });
      d[r.channel as "email" | "whatsapp"]++;
      if (r.status === "failed") d.failed++;
      byProject[names[r.project_id]] = (byProject[names[r.project_id]] ?? 0) + 1;
    }
    const v = verify.data ?? [];
    return NextResponse.json({
      success: true,
      totals: {
        total: rows.length, today: rows.filter((r) => r.created_at >= todayStart).length,
        email: rows.filter((r) => r.channel === "email").length, whatsapp: rows.filter((r) => r.channel === "whatsapp").length,
        verifyOk: v.filter((x) => x.status_code === 200).length, verifyFail: v.filter((x) => x.status_code === 400).length,
        deliveryFailed: rows.filter((r) => r.status === "failed").length,
        activeKeys: keys.count ?? 0, activeProjects: activeProjects ?? 0,
      },
      daily: Object.entries(daily).sort().map(([date, x]) => ({ date, ...x })),
      byProject: Object.entries(byProject).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      recent: recent.data ?? [],
    });
  } catch (e) { return internalError(e); }
}
