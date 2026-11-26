import { NextResponse } from "next/server";
import { z } from "zod";
import { adminConfigured, adminPasswordHash, adminUsername, auditAdmin, loginAllowed, makeSessionToken, recordLogin, safeEq, sameOrigin, sessionCookie, verifyPassword } from "@/lib/admin-auth";
import { clientIp, fail, internalError } from "@/lib/http";

const schema = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return fail(403, "FORBIDDEN", "Forbidden");
    if (!(await adminConfigured())) return fail(503, "NOT_CONFIGURED", "Admin login is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET.");
    const ip = clientIp(req);
    if (!(await loginAllowed(ip))) return fail(429, "TOO_MANY_ATTEMPTS", "Too many failed attempts. Try again in 15 minutes.");
    const b = schema.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail(400, "INVALID_REQUEST", "Enter username and password.");
    // Always check both so timing does not reveal which one was wrong.
    const userOk = safeEq(b.data.username, adminUsername());
    const passOk = verifyPassword(b.data.password, await adminPasswordHash());
    if (!userOk || !passOk) { await recordLogin(ip, false); return fail(401, "INVALID_CREDENTIALS", "Wrong username or password."); }
    await recordLogin(ip, true);
    await auditAdmin("admin.login", "session", "admin");
    const res = NextResponse.json({ success: true });
    res.headers.append("Set-Cookie", sessionCookie(makeSessionToken(adminUsername())));
    return res;
  } catch (e) { return internalError(e); }
}
