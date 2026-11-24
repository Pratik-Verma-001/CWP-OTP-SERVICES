"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/client/firebase";
import { authError } from "@/lib/client/authError";
import { Backdrop, Btn, ErrorBox, Field, inputCls, Logo } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [err, setErr] = useState(""), [note, setNote] = useState(""), [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setErr(""); setNote("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    } catch (e) { setErr(authError(e)); }
    setBusy(false);
  }
  async function reset() {
    setErr(""); setNote("");
    if (!email) return setErr("Enter your email first.");
    try { await sendPasswordResetEmail(auth, email.trim()); setNote("Password reset email sent. Check your inbox and spam."); } catch (e) { setErr(authError(e)); }
  }
  return (
    <>
      <Backdrop />
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="liquid animate-fade-up relative w-full max-w-sm space-y-4 rounded-3xl p-6">
          <div className="relative text-center">
            <Logo size={104} className="mx-auto animate-bob drop-shadow-[0_0_30px_rgb(var(--a2)/.6)]" />
            <div className="glow-text mt-2 text-xl font-bold">CWP OTP Services</div>
            <div className="text-sm text-slate-400">Sign in to your account</div>
          </div>
          <div className="relative space-y-4">
            <Field label="Email"><input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Password"><input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></Field>
            <ErrorBox text={err} />
            {note && <div className="text-sm text-emerald-300">{note}</div>}
            <Btn className="w-full" onClick={submit} disabled={busy || !email || !password}>{busy ? "Signing in…" : "Sign in"}</Btn>
            <div className="flex justify-between text-xs text-slate-400">
              <button onClick={reset} className="hover:text-white">Forgot password?</button>
              <Link href="/register" className="hover:text-white">Create account</Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
