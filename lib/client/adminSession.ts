"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Checks the dedicated admin cookie (no Firebase involved). Redirects to the admin login when there is no valid session.
export function useAdminSession(enabled = true) {
  const router = useRouter();
  const [s, setS] = useState<{ state: "loading" | "ok" | "out"; username: string }>({ state: "loading", username: "" });
  useEffect(() => {
    if (!enabled) return;
    let on = true;
    fetch("/api/administration/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!on) return;
        if (d.authenticated) setS({ state: "ok", username: d.username });
        else { setS({ state: "out", username: "" }); router.replace("/administration/login"); }
      })
      .catch(() => on && setS({ state: "out", username: "" }));
    return () => { on = false; };
  }, [enabled, router]);
  return s;
}
