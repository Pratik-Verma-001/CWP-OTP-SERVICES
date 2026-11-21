import { db } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/security/crypto";

export type ProviderName = "smtp" | "whatsapp";
export type Stored = { enabled: boolean; settings: Record<string, any>; secrets: Record<string, string> };

export async function loadStored(name: ProviderName): Promise<Stored | null> {
  const { data } = await db().from("provider_settings").select("enabled,settings,encrypted_credentials").eq("provider_name", name).maybeSingle();
  if (!data) return null;
  let secrets: Record<string, string> = {};
  if (data.encrypted_credentials) {
    try { secrets = JSON.parse(decrypt(data.encrypted_credentials)); } catch { secrets = {}; }
  }
  return { enabled: data.enabled, settings: data.settings ?? {}, secrets };
}

// Blank secret fields keep the existing value (secrets are write-only).
export async function saveStored(name: ProviderName, enabled: boolean, settings: object, newSecrets: Record<string, string | undefined>) {
  const current = (await loadStored(name))?.secrets ?? {};
  const merged = { ...current };
  for (const [k, v] of Object.entries(newSecrets)) if (v) merged[k] = v;
  const { error } = await db().from("provider_settings").upsert({
    provider_name: name, enabled, settings, encrypted_credentials: encrypt(JSON.stringify(merged)),
    updated_at: new Date().toISOString(),
  }, { onConflict: "provider_name" });
  if (error) throw error;
}
