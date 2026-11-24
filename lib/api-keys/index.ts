import { randomBytes } from "crypto";
import { hmac } from "@/lib/security/crypto";
import { db } from "@/lib/supabase/admin";

export const hashApiKey = (raw: string) => hmac("API_KEY_PEPPER", raw);

export function generateApiKey() {
  const raw = `cwp_live_${randomBytes(32).toString("base64url")}`;
  return { raw, hash: hashApiKey(raw), prefix: raw.slice(0, 14) };
}

export type AuthedKey = {
  keyId: string;
  projectId: string;
  projectName: string;
  allowedOrigins: string[];
  ownerId?: string;
};

export async function authenticateApiKey(req: Request): Promise<AuthedKey | "paused" | null> {
  const raw = req.headers.get("x-api-key");
  if (!raw || !raw.startsWith("cwp_live_") || raw.length > 100) return null;
  const { data } = await db()
    .from("api_keys")
    .select("id,status,project_id,projects(name,status,allowed_origins,owner_id)")
    .eq("key_hash", hashApiKey(raw))
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  const p = data.projects as unknown as { name: string; status: string; allowed_origins: string[]; owner_id?: string };
  if (p.status !== "active") return "paused";
  void db().from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { keyId: data.id, projectId: data.project_id, projectName: p.name, allowedOrigins: p.allowed_origins, ownerId: p.owner_id };
}

export async function logUsage(k: AuthedKey | null, endpoint: string, status: number) {
  if (k) await db().from("api_usage").insert({ project_id: k.projectId, api_key_id: k.keyId, endpoint, status_code: status });
}
