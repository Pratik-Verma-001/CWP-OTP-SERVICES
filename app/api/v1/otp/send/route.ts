import { NextResponse } from "next/server";
import { authenticateApiKey, logUsage, type AuthedKey } from "@/lib/api-keys";
import { sendSchema } from "@/lib/validation/schemas";
import { sendOtp } from "@/lib/otp/engine";
import { clientIp, fail, internalError } from "@/lib/http";
import { isMaintenance, ownerPolicy } from "@/lib/policy";

export const maxDuration = 30;

export async function POST(req: Request) {
  let key: AuthedKey | null = null;
  try {
    const auth = await authenticateApiKey(req);
    if (auth === "paused") return fail(403, "PROJECT_PAUSED", "Project is paused");
    if (!auth) return fail(401, "INVALID_API_KEY", "Invalid API key");
    key = auth;

    const origin = req.headers.get("origin");
    if (origin && key.allowedOrigins.length && !key.allowedOrigins.includes(origin))
      return fail(403, "ORIGIN_NOT_ALLOWED", "Origin not allowed");

    const parsed = sendSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(400, "INVALID_REQUEST", "Invalid channel or recipient");
    if (parsed.data.project.toLowerCase() !== key.projectName.toLowerCase())
      return fail(403, "PROJECT_MISMATCH", "API key does not belong to this project");

    if (await isMaintenance()) return fail(503, "MAINTENANCE", "The service is under maintenance. Try again later.");
    if (key.ownerId) {
      const pol = await ownerPolicy(key.ownerId, parsed.data.channel);
      if (pol) { await logUsage(key, "otp/send", pol.status); return fail(pol.status, pol.code, pol.message); }
    }
    const out = await sendOtp(key, { channel: parsed.data.channel, recipient: parsed.data.recipient, ip: clientIp(req) });
    await logUsage(key, "otp/send", out.ok ? 200 : out.status);
    if (!out.ok) return fail(out.status, out.code, out.message);
    return NextResponse.json({ success: true, requestId: out.requestId, expiresIn: out.expiresIn, message: "OTP request accepted" });
  } catch (e) {
    await logUsage(key, "otp/send", 500).catch(() => {});
    return internalError(e);
  }
}
