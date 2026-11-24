"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { auth } from "@/lib/client/firebase";
import { Backdrop, Btn, ErrorBox, Field, inputCls, Logo } from "@/components/ui";
import { authError } from "@/lib/client/authError";

export default function Register() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setErr("");
    try {
      const c = await createUserWithEmailAndPassword(auth, f.email.trim(), f.password);
      if (f.name.trim()) await updateProfile(c.user, { displayName: f.name.trim() });
      await sendEmailVerification(c.user).catch(() => {});
      router.replace("/dashboard");
    } catch (e) { setErr(authError(e)); }
    setBusy(false);
  }
  return (
    <>
      <Backdrop />
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="liquid animate-fade-up relative w-full max-w-sm space-y-4 rounded-3xl p-6">
          <div className="relative text-center"><Logo size={84} className="mx-auto animate-bob" /><div className="glow-text mt-2 text-xl font-bold">Create your account</div>
            <div className="text-sm text-slate-400">Verify your email, then wait for approval if required</div></div>
          <div className="relative space-y-4">
            <Field label="Name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Email"><input className={inputCls} type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Password (6+ characters)"><input className={inputCls} type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submit()} /></Field>
            <ErrorBox text={err} />
            <Btn className="w-full" onClick={submit} disabled={busy || !f.email || f.password.length < 6}>{busy ? "Creating…" : "Create account"}</Btn>
            <div className="text-center text-xs text-slate-400">Already registered? <Link href="/login" className="text-white">Sign in</Link></div>
          </div>
        </div>
      </main>
    </>
  );
}
