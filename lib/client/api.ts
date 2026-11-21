"use client";
import { useCallback, useEffect, useState } from "react";
import { auth } from "./firebase";

async function raw(path: string, init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers } });
}
export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await raw(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || "Request failed");
  return body;
}
export async function download(path: string, filename: string) {
  const res = await raw(path);
  if (!res.ok) throw new Error("Export failed");
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click(); URL.revokeObjectURL(url);
}
export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true); setError("");
    try { setData(await api<T>(path)); } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load };
}
