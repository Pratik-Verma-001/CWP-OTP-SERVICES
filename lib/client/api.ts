"use client";
import { useCallback, useEffect, useState } from "react";
import { auth } from "./firebase";

// In-memory cache: pages show the last result instantly and refresh it in the background.
const cache = new Map<string, unknown>();
export const clearApiCache = () => cache.clear();
if (typeof window !== "undefined") {
  auth.onAuthStateChanged((u) => { if (!u) { cache.clear(); try { sessionStorage.removeItem("cwp_me"); } catch {} } });
}

async function raw(path: string, init: RequestInit = {}) {
  await auth.authStateReady();
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers } });
}
export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await raw(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || "Request failed");
  return body;
}
// Warm the cache for pages the user is likely to open next.
export function prefetchApi(paths: string[]) {
  for (const p of paths) api(p).then((d) => cache.set(p, d)).catch(() => {});
}
export async function download(path: string, filename: string) {
  const res = await raw(path);
  if (!res.ok) throw new Error("Export failed");
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click(); URL.revokeObjectURL(url);
}

export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(() => (path ? ((cache.get(path) as T) ?? null) : null));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => !(path && cache.has(path)));
  const load = useCallback(async () => {
    if (!path) return;
    setError("");
    try { const d = await api<T>(path); cache.set(path, d); setData(d); } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [path]);
  useEffect(() => {
    if (!path) return;
    if (cache.has(path)) { setData(cache.get(path) as T); setLoading(false); } else setLoading(true);
    load();
  }, [load, path]);
  return { data, error, loading, reload: load };
}
