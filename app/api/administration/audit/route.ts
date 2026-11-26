import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/supabase/admin";
import { fail, internalError } from "@/lib/http";

export async function GET(req: Request) {
  try {
    if (!(await requireAdmin(req))) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const page = Math.max(1, parseInt(new URL(req.url).searchParams.get("page") ?? "1") || 1);
    const { data, count, error } = await db().from("audit_logs").select("id,action,entity_type,entity_id,metadata,created_at,admin_profiles(email)", { count: "exact" })
      .order("created_at", { ascending: false }).range((page - 1) * 30, page * 30 - 1);
    if (error) throw error;
    return NextResponse.json({ success: true, rows: data ?? [], total: count ?? 0, page, size: 30 });
  } catch (e) { return internalError(e); }
}
