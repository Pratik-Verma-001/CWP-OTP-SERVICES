"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "@/lib/client/firebase";
import { Backdrop, Btn, Logo } from "@/components/ui";

export default function Denied({ why, title = "Access problem", back }: { why: string; title?: string; back?: { label: string; href: string } }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const logout = async () => { await signOut(auth); router.replace("/login"); };
  const sendVerify = async () => {
    try { await sendEmailVerification(auth.currentUser!); setNote("Verification email sent. Check inbox and spam, open the link, then tap the button below."); }
    catch { setNote("Could not send the email right now. Wait a minute and try again."); }
  };
  const recheck = async () => { await auth.currentUser?.reload(); await auth.currentUser?.getIdToken(true); window.location.reload(); };
  return (
    <>
      <Backdrop />
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="liquid animate-fade-up relative w-full max-w-sm space-y-3 rounded-3xl p-6 text-center">
          <Logo size={72} className="relative mx-auto animate-bob" />
          <div className="relative font-semibold">{title}</div>
          <p className="relative text-sm text-slate-300">{why}</p>
          {why.includes("not verified") && (
            <div className="relative space-y-2">
              <Btn className="w-full" onClick={sendVerify}>Send verification email</Btn>
              <Btn variant="ghost" className="w-full" onClick={recheck}>I verified, check again</Btn>
              {note && <p className="text-xs text-emerald-300">{note}</p>}
            </div>)}
          {(why.includes("approval") || why.includes("suspended")) && <Btn variant="ghost" className="relative w-full" onClick={recheck}>Check again</Btn>}
          {back && <Link href={back.href} className="relative block rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm hover:bg-white/10">{back.label}</Link>}
          <Btn variant="ghost" className="relative w-full" onClick={logout}>Sign out</Btn>
        </div>
      </div>
    </>
  );
}
