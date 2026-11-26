import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "@/lib/supabase/admin";
import { getSetting, setSetting } from "@/lib/platform";
import { hashIp } from "@/lib/security/crypto";

// ONE platform administrator with dedicated credentials (env vars, optionally changed in the panel).
// This is completely separate from the Firebase accounts used by regular users: a user account can never reach /administration.
export const COOKIE = "cwp_admin";
const SESSION_HOURS = 8;
const N = 16384;

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return ["scrypt", N, salt.toString("base64url"), scryptSync(pw, salt, 64, { N }).toString("base64url")].join(".");
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, n, s, h] = (stored || "").split(".");
  if (alg !== "scrypt" || !n || !s || !h) return false;
  const expected = Buffer.from(h, "base64url");
  const got = scryptSync(pw, Buffer.from(s, "base64url"), expected.length, { N: Number(n) });
  return got.length === expected.length && timingSafeEqual(got, expected);
}
export const safeEq = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

const secret = () => process.env.ADMIN_SESSION_SECRET || process.env.ENCRYPTION_KEY || "";
export const adminUsername = () => process.env.ADMIN_USERNAME || "";
export async function adminPasswordHash(): Promise<string> {
  return (await getSetting<string>("admin_password", "")) || process.env.ADMIN_PASSWORD_HASH || "";
}
export async function adminConfigured() { return !!adminUsername() && !!secret() && !!(await adminPasswordHash()); }

const sign = (payload: string) => createHmac("sha256", secret()).update("admin-session:" + payload).digest("base64url");
export function makeSessionToken(username: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: username, iat: now, exp: now + SESSION_HOURS * 3600_000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export async function parseSessionToken(token: string | undefined, now = Date.now()): Promise<{ username: string } | null> {
  if (!token || !secret()) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let d: any;
  try { d = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { return null; }
  if (typeof d?.exp !== "number" || d.exp < now || typeof d?.iat !== "number" || d.u !== adminUsername()) return null;
  if (d.iat < (await getSetting<number>("admin_epoch", 0))) return null; // password changed: older sessions are dead
  return { username: d.u };
}

const cookieOf = (req: Request, name: string) =>
  (req.headers.get("cookie") ?? "").split(/;\s*/).map((c) => c.split("=")).find(([k]) => k === name)?.[1];
// State-changing calls must come from this site (the cookie is also SameSite=Strict).
export function sameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const o = req.headers.get("origin");
  if (!o) return true;
  try { return new URL(o).host === req.headers.get("host"); } catch { return false; }
}
// Backend authorization for every /api/administration/* route.
export async function requireAdmin(req: Request): Promise<{ username: string } | null> {
  if (!sameOrigin(req)) return null;
  return parseSessionToken(cookieOf(req, COOKIE));
}
export const sessionCookie = (token: string, maxAge = SESSION_HOURS * 3600) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;

// Brute-force protection: 5 failures per IP / 30 failures overall per 15 minutes.
export async function loginAllowed(ip: string) {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const q = () => db().from("admin_login_attempts").select("id", { count: "exact", head: true }).eq("ok", false).gte("created_at", since);
  const [a, b] = await Promise.all([q().eq("ip_hash", hashIp(ip)), q()]);
  return (a.count ?? 0) < 5 && (b.count ?? 0) < 30;
}
export const recordLogin = (ip: string, ok: boolean) => db().from("admin_login_attempts").insert({ ip_hash: hashIp(ip), ok });
export async function setAdminPassword(pw: string) {
  await setSetting("admin_password", hashPassword(pw));
  await setSetting("admin_epoch", Date.now());
}

export async function auditAdmin(action: string, entityType: string, entityId: string, metadata: object = {}) {
  await db().from("audit_logs").insert({ admin_id: null, action, entity_type: entityType, entity_id: entityId, metadata: { ...metadata, actor: "admin" } });
}
export async function testMailAllowedAdmin() {
  const { count } = await db().from("audit_logs").select("id", { count: "exact", head: true })
    .is("admin_id", null).eq("action", "provider.smtp.test_email").gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  return (count ?? 0) < 10;
}
