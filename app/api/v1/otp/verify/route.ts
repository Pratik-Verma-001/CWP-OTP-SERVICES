import { NextResponse } from "next/server";
import { authenticateApiKey, logUsage, type AuthedKey } from "@/lib/api-keys";
import { verifySchema } from "@/lib/validation/schemas";
import { verifyOtp } from "@/lib/otp/engine";
import { fail, internalError } from "@/lib/http";
import { db } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  let key: AuthedKey | null = null;
  try {
    const auth = await authenticateApiKey(req);
    if (auth === "paused") return fail(403, "PROJECT_PAUSED", "Project is paused");
    if (!auth) return fail(401, "INVALID_API_KEY", "Invalid API key");
    key = auth;

    // Per-key verify throttle on top of the per-code attempt limit.
    const { count } = await db().from("api_usage").select("id", { count: "exact", head: true })
      .eq("api_key_id", key.keyId).eq("endpoint", "otp/verify").gte("created_at", new Date(Date.now() - 60000).toISOString());
    if ((count ?? 0) >= 120) return fail(429, "RATE_LIMITED", "Too many verification requests");

    const parsed = verifySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(400, "INVALID_REQUEST", "Invalid request");

    const ok = await verifyOtp(key, parsed.data.requestId, parsed.data.code);
    await logUsage(key, "otp/verify", ok ? 200 : 400);
    if (ok) return NextResponse.json({ success: true, verified: true });
    return fail(400, "INVALID_OTP", "Verification failed", { verified: false });
  } catch (e) {
    await logUsage(key, "otp/verify", 500).catch(() => {});
    return internalError(e);
  }
}
