import { db } from "@/lib/supabase/admin";
import { buildUser, type UserRow } from "@/lib/auth/admin";
import { getSetting } from "@/lib/platform";

export type Block = { status: number; code: string; message: string };

// Per-account rules applied when OTPs are sent: suspension, feature switches, daily quota.
export async function ownerPolicy(ownerId: string, channel: "email" | "whatsapp"): Promise<Block | null> {
  const { data: p } = await db().from("admin_profiles").select("id,email,role,status,display_name,features,limits").eq("id", ownerId).maybeSingle();
  if (!p) return null;
  if (p.status !== "active") return { status: 403, code: "ACCOUNT_SUSPENDED", message: "This account is suspended." };
  const u = await buildUser(p as UserRow);
  const feature = channel === "email" ? "email_otp" : "whatsapp_otp";
  if (u.features[feature] === false) return { status: 403, code: "FEATURE_DISABLED", message: `${channel === "email" ? "Email" : "WhatsApp"} OTP is disabled for this account.` };
  if (u.limits.dailyOtpLimit < 1e8) {
    const { data: ps } = await db().from("projects").select("id").eq("owner_id", ownerId);
    const ids = (ps ?? []).map((x: any) => x.id);
    if (ids.length) {
      const day = new Date(new Date().toISOString().slice(0, 10)).toISOString();
      const { count } = await db().from("otp_requests").select("id", { count: "exact", head: true }).in("project_id", ids).gte("created_at", day);
      if ((count ?? 0) >= u.limits.dailyOtpLimit) return { status: 429, code: "DAILY_LIMIT", message: "Daily OTP limit reached for this account." };
    }
  }
  return null;
}
export const isMaintenance = async () => (await getSetting<boolean>("maintenance", false)) === true;
