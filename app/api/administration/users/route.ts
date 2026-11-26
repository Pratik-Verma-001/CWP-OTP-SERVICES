import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { auditAdmin, requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/supabase/admin";
import { firebaseAuth } from "@/lib/firebase/admin";
import { fail, internalError } from "@/lib/http";

const SIZE = 20;
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const q = new URL(req.url).searchParams;
    const page = Math.max(1, parseInt(q.get("page") ?? "1") || 1);
    let query = db().from("admin_profiles").select("id,email,display_name,role,status,created_at,last_login_at", { count: "exact" });
    const s = (q.get("q") ?? "").replace(/[^a-zA-Z0-9@._ -]/g, "").trim();
    if (s) query = query.or(`email.ilike.*${s}*,display_name.ilike.*${s}*`);
    const st = q.get("status");
    if (st && ["pending", "active", "suspended"].includes(st)) query = query.eq("status", st);
    const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * SIZE, page * SIZE - 1);
    if (error) throw error;
    const users = data ?? [];
    const ids = users.map((u: any) => u.id);
    const projCount: Record<string, number> = {}, otpCount: Record<string, number> = {}, owner: Record<string, string> = {};
    if (ids.length) {
      const { data: ps } = await db().from("projects").select("id,owner_id").in("owner_id", ids);
      for (const p of ps ?? []) { owner[p.id] = p.owner_id; projCount[p.owner_id] = (projCount[p.owner_id] ?? 0) + 1; }
      const pids = Object.keys(owner);
      if (pids.length) {
        const { data: o } = await db().from("otp_requests").select("project_id").in("project_id", pids).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()).limit(20000);
        for (const r of o ?? []) otpCount[owner[r.project_id]] = (otpCount[owner[r.project_id]] ?? 0) + 1;
      }
    }
    return NextResponse.json({ success: true, total: count ?? 0, page, size: SIZE,
      users: users.map((u: any) => ({ ...u, projects: projCount[u.id] ?? 0, otp30d: otpCount[u.id] ?? 0 })) });
  } catch (e) { return internalError(e); }
}

const createSchema = z.object({ email: z.string().email().max(254), name: z.string().max(80).optional() });

// Add a user: creates the Firebase login and returns a one-time password-reset link to hand to them.
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = createSchema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Enter a valid email address.");
    const email = p.data.email.toLowerCase();
    const auth = firebaseAuth();
    let uid: string;
    try { uid = (await auth.createUser({ email, emailVerified: true, password: randomBytes(16).toString("base64url"), displayName: p.data.name })).uid; }
    catch (e: any) {
      if (e?.code === "auth/email-already-exists") uid = (await auth.getUserByEmail(email)).uid; else throw e;
    }
    const { data, error } = await db().from("admin_profiles").insert({ firebase_uid: uid, email, role: "user", status: "active", display_name: p.data.name ?? null }).select("id").single();
    if (error?.code === "23505") return fail(409, "DUPLICATE", "A user with this email already exists.");
    if (error || !data) throw error;
    const resetLink = await auth.generatePasswordResetLink(email);
    await auditAdmin("user.create", "user", data.id);
    return NextResponse.json({ success: true, id: data.id, resetLink }, { status: 201 });
  } catch (e) { return internalError(e); }
}
