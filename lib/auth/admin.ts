import { firebaseAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/supabase/admin";

export type Admin = { id: string; email: string; role: string };
export type Reason = "no_token" | "token_invalid" | "email_not_verified" | "not_allowlisted" | "database_error";
export type AdminCheck = { admin: Admin } | { reason: Reason };

export const REASON_TEXT: Record<Reason, string> = {
  no_token: "Not signed in.",
  token_invalid: "Server could not verify your login. Check the Firebase Admin settings in .env.local and restart the server.",
  email_not_verified: "Your email is not verified in Firebase. Verify it in the Firebase console, then sign in again.",
  not_allowlisted: "This account is not on the admin allowlist.",
  database_error: "Database error. Check the Supabase keys and that the SQL migration was run.",
};

// Verifies the Firebase ID token server-side, then checks the env allowlist.
// Roles come from our database only, never from client-supplied claims.
export async function checkAdmin(req: Request): Promise<AdminCheck> {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return { reason: "no_token" };
  let decoded;
  try {
    decoded = await firebaseAuth().verifyIdToken(token);
  } catch (e) {
    console.error("admin_auth: token check failed:", e instanceof Error ? e.message : "unknown");
    return { reason: "token_invalid" };
  }
  const email = decoded.email?.toLowerCase();
  const allow = (process.env.ADMIN_ALLOWLIST ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!email || !allow.includes(email)) return { reason: "not_allowlisted" };
  if (!decoded.email_verified) return { reason: "email_not_verified" };
  const { data, error } = await db()
    .from("admin_profiles")
    .upsert({ firebase_uid: decoded.uid, email, updated_at: new Date().toISOString() }, { onConflict: "firebase_uid" })
    .select("id,email,role")
    .single();
  if (error || !data) {
    console.error("admin_auth: database error:", error?.message);
    return { reason: "database_error" };
  }
  return { admin: data };
}

export async function requireAdmin(req: Request): Promise<Admin | null> {
  const r = await checkAdmin(req);
  return "admin" in r ? r.admin : null;
}

export async function audit(adminId: string, action: string, entityType: string, entityId: string, metadata: object = {}) {
  await db().from("audit_logs").insert({ admin_id: adminId, action, entity_type: entityType, entity_id: entityId, metadata });
}
