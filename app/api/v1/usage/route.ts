import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { db } from "@/lib/supabase/admin";
import { fail, internalError } from "@/lib/http";

// Scoped to the project that owns the calling API key.
export async function GET(req: Request) {
  try {
    const k = await authenticateApiKey(req);
    if (k === "paused") return fail(403, "PROJECT_PAUSED", "Project is paused");
    if (!k) return fail(401, "INVALID_API_KEY", "Invalid API key");
    const todayStart = new Date(new Date().toISOString().slice(0, 10)).toISOString();
    const cnt = async (f: (q: any) => any) => {
      const { count } = await f(db().from("otp_requests").select("id", { count: "exact", head: true }).eq("project_id", k.projectId));
      return count ?? 0;
    };
    const vcnt = async (code: number) => {
      const { count } = await db().from("api_usage").select("id", { count: "exact", head: true }).eq("project_id", k.projectId).eq("endpoint", "otp/verify").eq("status_code", code);
      return count ?? 0;
    };
    const [total, today, email, whatsapp, ok, bad] = await Promise.all([
      cnt((q) => q), cnt((q) => q.gte("created_at", todayStart)), cnt((q) => q.eq("channel", "email")), cnt((q) => q.eq("channel", "whatsapp")), vcnt(200), vcnt(400),
    ]);
    return NextResponse.json({ success: true, totalRequests: total, requestsToday: today, emailOtp: email, whatsappOtp: whatsapp,
      successfulVerifications: ok, failedVerifications: bad, perProject: [{ project: k.projectName, totalRequests: total }] });
  } catch (e) { return internalError(e); }
}
