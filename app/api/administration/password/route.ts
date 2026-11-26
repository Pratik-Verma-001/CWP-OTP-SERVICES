import { NextResponse } from "next/server";
import { z } from "zod";
import { adminPasswordHash, adminUsername, auditAdmin, makeSessionToken, requireAdmin, sessionCookie, setAdminPassword, verifyPassword } from "@/lib/admin-auth";
import { fail, internalError } from "@/lib/http";

const schema = z.object({ current: z.string().min(1).max(200), next: z.string().min(10, "Use at least 10 characters.").max(200) });

export async function POST(req: Request) {
  try {
    if (!(await requireAdmin(req))) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const b = schema.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail(400, "INVALID_REQUEST", "The new password needs at least 10 characters.");
    if (!verifyPassword(b.data.current, await adminPasswordHash())) return fail(403, "INVALID_CREDENTIALS", "Current password is wrong.");
    await setAdminPassword(b.data.next);
    await auditAdmin("admin.password.change", "session", "admin");
    const res = NextResponse.json({ success: true });
    res.headers.append("Set-Cookie", sessionCookie(makeSessionToken(adminUsername()))); // keep this session, end all others
    return res;
  } catch (e) { return internalError(e); }
}
