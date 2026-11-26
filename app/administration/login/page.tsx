"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Btn, ErrorBox, Field, inputCls, Logo } from "@/components/ui";

export default function AdminLogin() {
  const router = useRouter();
  const [u, setU] = useState(""), [p, setP] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/administration/session", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (d.authenticated) router.replace("/administration"); else setConfigured(d.configured);
    }).catch(() => setConfigured(true));
  }, [router]);
  async function submit() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/administration/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u.trim(), password: p }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error?.message || "Login failed");
      router.replace("/administration");
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <div data-panel="admin" className="app-bg fixed inset-0 overflow-y-auto">
      <main className="flex min-h-full items-center justify-center p-4">
        <div className="liquid w-full max-w-sm space-y-4 rounded-3xl p-6">
          <div className="relative text-center">
            <Logo size={88} className="mx-auto" />
            <div className="glow-text mt-2 text-xl font-bold">Administration</div>
            <div className="text-sm text-slate-400">Platform administrator sign in</div>
          </div>
          <div className="relative space-y-4">
            {configured === false && <ErrorBox text="Admin login is not configured yet. Set ADMIN_USERNAME, ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET in the environment variables, then redeploy. See Documentation > Admin setup." />}
            <Field label="Admin username"><input className={inputCls} autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} /></Field>
            <Field label="Admin password"><input className={inputCls} type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === "Enter" && u && p && submit()} /></Field>
            <ErrorBox text={err} />
            <Btn className="w-full" onClick={submit} disabled={busy || !u || !p || configured === false}>{busy ? "Signing in…" : "Sign in"}</Btn>
            <div className="text-center text-xs text-slate-500">Not the administrator? <Link href="/login" className="text-slate-300 hover:text-white">Go to user sign in</Link></div>
          </div>
        </div>
      </main>
    </div>
  );
}
