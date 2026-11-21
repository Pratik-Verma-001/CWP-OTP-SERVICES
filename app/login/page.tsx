"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/client/firebase";
import { Backdrop, Btn, ErrorBox, Field, inputCls, Logo } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setErr("");
    try { await signInWithEmailAndPassword(auth, email, password); router.replace("/dashboard"); }
    catch { setErr("Invalid email or password"); }
    setBusy(false);
  }
  return (
    <>
      <Backdrop />
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="liquid animate-fade-up w-full max-w-sm space-y-4 rounded-3xl p-6">
          <div className="relative text-center">
            <Logo size={110} className="mx-auto animate-bob drop-shadow-[0_0_30px_rgba(99,102,241,.6)]" />
            <div className="glow-text mt-2 text-xl font-bold">CWP OTP Services</div>
            <div className="text-sm text-slate-400">Admin sign in</div>
          </div>
          <div className="relative space-y-4">
            <Field label="Email"><input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Password"><input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} /></Field>
            <ErrorBox text={err} />
            <Btn className="w-full" onClick={submit} disabled={busy || !email || !password}>{busy ? "Signing in…" : "Sign in"}</Btn>
          </div>
        </div>
      </main>
    </>
  );
}
