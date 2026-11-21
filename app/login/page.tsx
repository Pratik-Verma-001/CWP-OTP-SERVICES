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
    catch (e: any) {
      const code: string = e?.code ?? "unknown";
      const msg: Record<string, string> = {
        "auth/invalid-credential": "Wrong email or password.",
        "auth/wrong-password": "Wrong email or password.",
        "auth/user-not-found": "No user with this email in Firebase Authentication.",
        "auth/invalid-email": "Email format is invalid.",
        "auth/invalid-api-key": "Firebase config is missing or wrong. Check the NEXT_PUBLIC_FIREBASE_* variables in Vercel, then redeploy.",
        "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Firebase API key is not valid. Check NEXT_PUBLIC_FIREBASE_API_KEY in Vercel, then redeploy.",
        "auth/operation-not-allowed": "Email/Password sign-in is not enabled in Firebase Authentication.",
        "auth/user-disabled": "This user is disabled in Firebase.",
        "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
        "auth/network-request-failed": "Network error. Check your connection.",
        "auth/unauthorized-domain": "Add this domain in Firebase > Authentication > Settings > Authorized domains.",
      };
      setErr((msg[code] ?? "Sign in failed.") + ` (${code})`);
    }
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
