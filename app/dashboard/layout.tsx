"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "@/lib/client/firebase";
import { api } from "@/lib/client/api";
import { Backdrop, Btn, Icon, Loading, Logo } from "@/components/ui";

const NAV = [["Dashboard", "", "dashboard"], ["API Keys", "/api-keys", "key"], ["Projects", "/projects", "projects"], ["OTP Logs", "/logs", "logs"],
  ["Analytics", "/analytics", "analytics"], ["Providers", "/providers", "providers"], ["API Docs", "/docs", "docs"], ["Settings", "/settings", "settings"]];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter(), path = usePathname();
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [email, setEmail] = useState(""), [why, setWhy] = useState(""), [note, setNote] = useState("");
  const [more, setMore] = useState(false), [search, setSearch] = useState("");

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) return router.replace("/login");
    try { setEmail((await api("/api/admin/me")).email); setState("ok"); } catch (e: any) { setWhy(e.message); setState("denied"); }
  }), [router]);
  useEffect(() => setMore(false), [path]);

  const sendVerify = async () => {
    try { await sendEmailVerification(auth.currentUser!); setNote("Verification email sent. Check inbox and spam, open the link, then tap the button below."); }
    catch { setNote("Could not send the email right now. Wait a minute and try again."); }
  };
  const recheck = async () => { await auth.currentUser?.reload(); await auth.currentUser?.getIdToken(true); window.location.reload(); };
  const logout = async () => { await signOut(auth); router.replace("/login"); };

  if (state === "loading") return <><Backdrop /><div className="mx-auto max-w-md p-8"><Loading /></div></>;
  if (state === "denied") return (
    <><Backdrop />
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="liquid animate-fade-up w-full max-w-sm space-y-3 rounded-3xl p-6 text-center">
          <Logo size={72} className="mx-auto animate-bob" />
          <div className="relative font-semibold">Unauthorized</div>
          <p className="relative text-sm text-slate-300">{why}</p>
          {why.includes("not verified") && <div className="relative space-y-2">
            <Btn className="w-full" onClick={sendVerify}>Send verification email</Btn>
            <Btn variant="ghost" className="w-full" onClick={recheck}>I verified, check again</Btn>
            {note && <p className="text-xs text-emerald-300">{note}</p>}</div>}
          <Btn variant="ghost" className="relative" onClick={logout}>Sign out</Btn>
        </div>
      </div></>);

  const idx = NAV.findIndex(([, h]) => (h === "" ? path === "/dashboard" : path.startsWith("/dashboard" + h)));
  const dockIdx = idx >= 0 && idx < 4 ? idx : 4;

  return (
    <div className="min-h-screen">
      <Backdrop />

      {/* Desktop: floating liquid-glass sidebar */}
      <aside className="liquid fixed bottom-4 left-4 top-4 z-30 hidden w-64 flex-col rounded-3xl p-4 md:flex">
        <div className="relative mb-6 flex items-center gap-3"><Logo size={44} /><div><div className="glow-text text-lg font-bold leading-none">CWP</div><div className="text-[11px] tracking-widest text-slate-400">OTP SERVICES</div></div></div>
        <nav className="relative flex-1">
          <div className="absolute inset-x-0 top-0 h-11 rounded-xl bg-gradient-to-r from-blue-500/35 to-violet-500/35 shadow-[0_0_24px_rgba(99,102,241,.35)] ring-1 ring-white/20 transition-transform duration-500 [transition-timing-function:cubic-bezier(.3,1.4,.5,1)]"
            style={{ transform: `translateY(${Math.max(idx, 0) * 48}px)`, opacity: idx < 0 ? 0 : 1 }} />
          {NAV.map(([l, h, ic]) => (
            <Link key={l} href={"/dashboard" + h} className="relative z-10 mb-1 flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-slate-300 transition hover:text-white">
              <Icon name={ic} />{l}</Link>))}
        </nav>
        <div className="relative space-y-2 border-t border-white/10 pt-3">
          <div className="truncate text-xs text-slate-400">{email}</div>
          <Btn variant="ghost" className="flex w-full items-center justify-center gap-2" onClick={logout}><Icon name="logout" className="h-4 w-4" />Logout</Btn>
        </div>
      </aside>

      <div className="md:pl-[17.5rem]">
        <header className="liquid sticky top-3 z-20 mx-3 mt-3 flex items-center gap-2 rounded-2xl px-3 py-2 md:mx-4 md:mr-4">
          <Logo size={32} className="relative md:hidden" />
          <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); router.push(`/dashboard/logs?q=${encodeURIComponent(search)}`); }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search request ID…"
              className="w-full max-w-md rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 text-sm outline-none focus:border-violet-400" /></form>
          <span className="relative hidden text-xs text-slate-400 sm:block">{email}</span>
          <button onClick={logout} className="relative rounded-xl p-2 text-slate-300 hover:bg-white/10 md:hidden" aria-label="Logout"><Icon name="logout" /></button>
        </header>
        <main key={path} className="animate-fade-up p-3 pb-32 md:p-6 md:pb-10">{children}</main>
      </div>

      {/* Mobile: liquid-glass dock with sliding highlight */}
      {more && <button aria-label="Close menu" className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMore(false)} />}
      {more && (
        <div className="liquid animate-sheet-up fixed inset-x-3 bottom-24 z-40 grid grid-cols-2 gap-2 rounded-3xl p-3 md:hidden">
          {NAV.slice(4).map(([l, h, ic]) => (
            <Link key={l} href={"/dashboard" + h} className="relative flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-3 text-sm hover:bg-white/10"><Icon name={ic} />{l}</Link>))}
        </div>)}
      <nav className="liquid fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-full p-1.5 md:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
        <div className="absolute bottom-1.5 left-1.5 top-1.5 w-[calc((100%-0.75rem)/5)] rounded-full bg-gradient-to-r from-blue-500/45 to-violet-500/45 shadow-[0_0_20px_rgba(99,102,241,.45)] ring-1 ring-white/25 transition-transform duration-500 [transition-timing-function:cubic-bezier(.3,1.4,.5,1)]"
          style={{ transform: `translateX(${dockIdx * 100}%)` }} />
        {NAV.slice(0, 4).map(([l, h, ic], i) => (
          <Link key={l} href={"/dashboard" + h} className={`relative z-10 flex flex-col items-center gap-0.5 py-2 text-[10px] transition ${dockIdx === i ? "text-white" : "text-slate-400"}`}>
            <Icon name={ic} className="h-5 w-5" />{l.replace("API ", "").replace("OTP ", "")}</Link>))}
        <button onClick={() => setMore(!more)} className={`relative z-10 flex flex-col items-center gap-0.5 py-2 text-[10px] transition ${dockIdx === 4 ? "text-white" : "text-slate-400"}`}>
          <Icon name="more" className="h-5 w-5" />More</button>
      </nav>
    </div>
  );
}
