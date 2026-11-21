import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { ownedProjects } from "@/lib/auth/scope";
import { db } from "@/lib/supabase/admin";
import { fail, internalError } from "@/lib/http";

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const csvCell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s; // block spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const q = new URL(req.url).searchParams;
    const csv = q.get("format") === "csv";
    const page = Math.max(1, parseInt(q.get("page") ?? "1") || 1);
    const size = csv ? 5000 : 25;

    const projects = await ownedProjects(admin.id);
    let ids = projects.map((p) => p.id);
    const pf = q.get("project");
    if (pf) ids = ids.filter((i) => i === pf);
    if (!ids.length) return NextResponse.json({ success: true, rows: [], total: 0, page, size });

    let query = db().from("otp_requests")
      .select("id,channel,status,masked_recipient,attempts,created_at,expires_at,consumed_at,projects(name),delivery_logs(provider,status,error_code)", { count: "exact" })
      .in("project_id", ids);
    const ch = q.get("channel"); if (ch === "email" || ch === "whatsapp") query = query.eq("channel", ch);
    const st = q.get("status");
    if (st === "expired") query = query.lt("expires_at", new Date().toISOString()).is("consumed_at", null).in("status", ["pending", "sent", "expired"]);
    else if (st && ["pending", "sent", "failed", "verified", "locked"].includes(st)) query = query.eq("status", st);
    const from = q.get("from"), to = q.get("to");
    if (from && DATE.test(from)) query = query.gte("created_at", `${from}T00:00:00Z`);
    if (to && DATE.test(to)) query = query.lte("created_at", `${to}T23:59:59Z`);
    const s = q.get("q")?.trim(); if (s && UUID.test(s)) query = query.eq("id", s);

    const { data, count, error } = await query.order("created_at", { ascending: q.get("sort") === "asc" }).range((page - 1) * size, page * size - 1);
    if (error) throw error;
    const now = Date.now();
    const rows = (data ?? []).map((r: any) => ({
      ...r, status: !r.consumed_at && ["pending", "sent"].includes(r.status) && new Date(r.expires_at).getTime() < now ? "expired" : r.status,
    }));

    if (csv) {
      const head = "request_id,project,recipient,channel,status,attempts,created_at,expires_at,provider_status";
      const body = rows.map((r: any) => [r.id, r.projects?.name, r.masked_recipient, r.channel, r.status, r.attempts, r.created_at, r.expires_at, r.delivery_logs?.[0]?.status].map(csvCell).join(","));
      return new Response([head, ...body].join("\n"), { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=otp-logs.csv" } });
    }
    return NextResponse.json({ success: true, rows, total: count ?? 0, page, size, projects });
  } catch (e) { return internalError(e); }
}
