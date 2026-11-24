import { firebaseAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/supabase/admin";
import { DEFAULT_LIMITS, getSetting, loadFeatures, type Limits } from "@/lib/platform";

export type Role = "owner" | "admin" | "user";
export type User = { id: string; email: string; role: Role; status: string; name: string | null; features: Record<string, boolean>; limits: Limits };
export type Admin = User;
export type UserRow = { id: string; email: string; role: Role; status: string; display_name: string | null; features?: Record<string, boolean> | null; limits?: Partial<Limits> | null };
export type Reason = "no_token" | "token_invalid" | "email_not_verified" | "pending" | "suspended" | "registration_closed" | "database_error";
export type AdminCheck = { user: User } | { reason: Reason };

export const REASON_TEXT: Record<Reason, string> = {
  no_token: "Not signed in.",
  token_invalid: "Server could not verify your login. Check the Firebase Admin settings and restart the server.",
  email_not_verified: "Your email is not verified in Firebase. Verify it, then sign in again.",
  pending: "Your account is waiting for approval by the administrator.",
  suspended: "This account has been suspended. Contact the administrator.",
  registration_closed: "Registration is closed. Ask the administrator to add you.",
  database_error: "Database error. Make sure the SQL migrations 0001, 0002 and 0003 were run in Supabase.",
};

// Profile cache (20s): most requests then need no database lookup to authenticate. Suspensions apply within 20s.
const PROFILE_TTL = 20_000;
const profiles = new Map<string, { at: number; p: any }>();
const cacheOn = process.env.NODE_ENV !== "test";

const allowlist = () => (process.env.ADMIN_ALLOWLIST ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
export const isBootstrapAdmin = (email: string) => allowlist().includes(email.toLowerCase());
export const isPlatformAdmin = (u: { role: Role }) => u.role === "owner" || u.role === "admin";

// Effective features/limits: global switch AND (per-user override ?? default). Platform admins are not limited.
export async function buildUser(p: UserRow): Promise<User> {
  const [cat, defLimits] = await Promise.all([loadFeatures(), getSetting<Partial<Limits>>("limits", {})]);
  const platform = p.role === "owner" || p.role === "admin";
  const features: Record<string, boolean> = {};
  for (const f of cat) features[f.key] = f.enabled && (platform ? true : (p.features?.[f.key] ?? f.default_enabled));
  const limits: Limits = platform
    ? { maxProjects: 1e9, maxKeysPerProject: 1e9, dailyOtpLimit: 1e9 }
    : { ...DEFAULT_LIMITS, ...defLimits, ...(p.limits ?? {}) };
  return { id: p.id, email: p.email, role: p.role, status: p.status, name: p.display_name, features, limits };
}

export async function checkUser(req: Request): Promise<AdminCheck> {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return { reason: "no_token" };
  let decoded;
  try { decoded = await firebaseAuth().verifyIdToken(token); }
  catch (e) { console.error("auth: token check failed:", e instanceof Error ? e.message : "unknown"); return { reason: "token_invalid" }; }
  const email = decoded.email?.toLowerCase();
  if (!email) return { reason: "token_invalid" };
  if (!decoded.email_verified) return { reason: "email_not_verified" };
  const boot = isBootstrapAdmin(email);
  const now = new Date().toISOString();

  const hit = cacheOn ? profiles.get(decoded.uid) : undefined;
  if (hit && Date.now() - hit.at < PROFILE_TTL && hit.p.email === email) {
    if (hit.p.status === "pending") return { reason: "pending" };
    if (hit.p.status === "suspended") return { reason: "suspended" };
    return { user: await buildUser(hit.p) };
  }

  const { data: existing, error: readErr } = await db().from("admin_profiles").select("*").eq("firebase_uid", decoded.uid).maybeSingle();
  if (readErr) { console.error("auth: database error:", readErr.message); return { reason: "database_error" }; }
  let p: any = existing;
  if (!p) {
    const mode = await getSetting<string>("registration", "approval");
    if (!boot && mode === "closed") return { reason: "registration_closed" };
    const { data, error } = await db().from("admin_profiles").insert({
      firebase_uid: decoded.uid, email, role: boot ? "owner" : "user", status: boot || mode === "open" ? "active" : "pending",
      display_name: decoded.name ?? null, last_login_at: now,
    }).select("*").single();
    if (error || !data) { console.error("auth: create profile failed:", error?.message); return { reason: "database_error" }; }
    p = data;
  } else {
    const patch: Record<string, any> = {};
    // Only touch the row when something changed or the last-login stamp is older than 10 minutes.
    if (!p.last_login_at || Date.now() - new Date(p.last_login_at).getTime() > 600_000) patch.last_login_at = now;
    if (p.email !== email) patch.email = email;
    // The ADMIN_ALLOWLIST env var is the root of trust: listed emails are always active platform owners.
    if (boot && (p.role === "user" || p.status !== "active")) { patch.role = p.role === "user" ? "owner" : p.role; patch.status = "active"; }
    if (Object.keys(patch).length) await db().from("admin_profiles").update(patch).eq("id", p.id);
    p = { ...p, ...patch };
  }
  if (cacheOn) profiles.set(decoded.uid, { at: Date.now(), p });
  if (p.status === "pending") return { reason: "pending" };
  if (p.status === "suspended") return { reason: "suspended" };
  return { user: await buildUser(p) };
}

export async function requireUser(req: Request): Promise<User | null> {
  const r = await checkUser(req);
  return "user" in r ? r.user : null;
}
export async function requireAdmin(req: Request): Promise<User | null> {
  const u = await requireUser(req);
  return u && isPlatformAdmin(u) ? u : null;
}

export async function audit(adminId: string, action: string, entityType: string, entityId: string, metadata: object = {}) {
  await db().from("audit_logs").insert({ admin_id: adminId, action, entity_type: entityType, entity_id: entityId, metadata });
}

// At most 10 test emails per hour (prevents using the test button to spam).
export async function testMailAllowed(adminId: string) {
  const { count } = await db().from("audit_logs").select("id", { count: "exact", head: true })
    .eq("admin_id", adminId).eq("action", "provider.smtp.test_email").gte("created_at", new Date(Date.now() - 3600000).toISOString());
  return (count ?? 0) < 10;
}
