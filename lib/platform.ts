import { db } from "@/lib/supabase/admin";

export type Limits = { maxProjects: number; maxKeysPerProject: number; dailyOtpLimit: number };
export const DEFAULT_LIMITS: Limits = { maxProjects: 5, maxKeysPerProject: 5, dailyOtpLimit: 200 };
export type Feature = { key: string; name: string; description: string; enabled: boolean; default_enabled: boolean; builtin: boolean };

// Small per-instance cache: settings and the feature catalog change rarely but are read on every request.
const TTL = 30_000;
const useCache = process.env.NODE_ENV !== "test";
const memo = new Map<string, { at: number; v: unknown }>();
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (useCache && hit && Date.now() - hit.at < TTL) return hit.v as T;
  const v = await load();
  memo.set(key, { at: Date.now(), v });
  return v;
}
export const clearPlatformCache = () => memo.clear();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  return cached(`s:${key}`, async () => {
    const { data } = await db().from("platform_settings").select("value").eq("key", key).maybeSingle();
    return data && data.value !== null && data.value !== undefined ? (data.value as T) : fallback;
  });
}
export async function setSetting(key: string, value: unknown) {
  const { error } = await db().from("platform_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  clearPlatformCache();
}
export async function loadFeatures(): Promise<Feature[]> {
  return cached("features", async () => {
    const { data } = await db().from("features").select("*").order("builtin", { ascending: false }).order("key");
    return (data ?? []) as Feature[];
  });
}
