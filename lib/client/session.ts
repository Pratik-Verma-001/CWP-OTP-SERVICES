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
// Shows the shell immediately from the last known profile (UI only; the server still checks every request), then re-verifies.
export function useSession() {
  const router = useRouter();
  const [s, setS] = useState<{ state: "loading" | "ok" | "denied"; me: Me | null; why: string }>({ state: "loading", me: null, why: "" });
  useEffect(() => {
    try { const c = sessionStorage.getItem("cwp_me"); if (c) setS({ state: "ok", me: JSON.parse(c), why: "" }); } catch {}
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
      try {
        const me = await api<Me>("/api/admin/me");
        try { sessionStorage.setItem("cwp_me", JSON.stringify(me)); } catch {}
        setS({ state: "ok", me, why: "" });
      } catch (e: any) {
        try { sessionStorage.removeItem("cwp_me"); } catch {}
        setS({ state: "denied", me: null, why: e.message });
      }
    });
  }, [router]);
  return s;
}
