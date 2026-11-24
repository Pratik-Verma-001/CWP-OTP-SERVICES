import { db } from "@/lib/supabase/admin";

export type Limits = { maxProjects: number; maxKeysPerProject: number; dailyOtpLimit: number };
export const DEFAULT_LIMITS: Limits = { maxProjects: 5, maxKeysPerProject: 5, dailyOtpLimit: 200 };
export type Feature = { key: string; name: string; description: string; enabled: boolean; default_enabled: boolean; builtin: boolean };

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await db().from("platform_settings").select("value").eq("key", key).maybeSingle();
  return data && data.value !== null && data.value !== undefined ? (data.value as T) : fallback;
}
export async function setSetting(key: string, value: unknown) {
  const { error } = await db().from("platform_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}
export async function loadFeatures(): Promise<Feature[]> {
  const { data } = await db().from("features").select("*").order("builtin", { ascending: false }).order("key");
  return (data ?? []) as Feature[];
}
