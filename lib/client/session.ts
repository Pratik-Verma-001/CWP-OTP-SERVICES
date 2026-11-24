"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { api } from "./api";

export type Me = {
  id: string; email: string; name: string | null; role: "owner" | "admin" | "user"; status: string;
  features: Record<string, boolean>; limits: Record<string, number>; announcement: string; maintenance: boolean;
};
export function useSession() {
  const router = useRouter();
  const [s, setS] = useState<{ state: "loading" | "ok" | "denied"; me: Me | null; why: string }>({ state: "loading", me: null, why: "" });
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) { router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    try { setS({ state: "ok", me: await api<Me>("/api/admin/me"), why: "" }); }
    catch (e: any) { setS({ state: "denied", me: null, why: e.message }); }
  }), [router]);
  return s;
}
