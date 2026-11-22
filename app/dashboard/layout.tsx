"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "@/lib/client/firebase";
import { api } from "@/lib/client/api";
import { Backdrop, Btn, Icon, Loading, Logo } from "@/components/ui";

const NAV = [["Dashboard", "", "dashboard"], ["API Keys", "/api-keys", "key"], ["Email", "/email", "mail"], ["WhatsApp", "/whatsapp", "chat"],
  ["Projects", "/projects", "projects"], ["OTP Logs", "/logs", "logs"], ["Test OTP", "/test", "send"], ["Analytics", "/analytics", "analytics"],
  ["API Docs", "/docs", "docs"], ["Settings", "/settings", "settings"]];
const EASE = "[transition-timing-function:cubic-bezier(.4,0,.2,1)]";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter(), path = usePathname();
  const scroller = useRef<HTMLElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [email, setEmail] = useState(""), [why, setWhy] = useState(""), [note, setNote] = useState("");
  const [more, setMore] = useState(false), [search, setSearch] = useState("");

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (!u) return router.replace("/login");
    try { setEmail((await api("/api/admin/me")).email); setState("ok"); } catch (e: any) { setWhy(e.message); setState("denied"); }
  }), [router]);
  useEffect(() => { setMore(false); scroller.current?.scrollTo({ top: 0 }); }, [path]);

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
          <Logo size={72} className="relative mx-auto animate-bob" />
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
  const title = NAV[idx]?.[0] ?? "Dashboard";
  const initial = (email[0] ?? "A").toUpperCase();

  return (
    // The shell is fixed to the screen and only <main> scrolls, so the phone's address bar
    // can no longer resize the page and make the navigation jump.
    <div className="fixed inset-0 flex overflow-hidden">
      <Backdrop />

      <aside className="liquid m-4 hidden w-64 shrink-0 flex-col rounded-3xl p-4 lg:flex">
        <div className="relative mb-6 flex items-center gap-3"><Logo size={44} /><div><div className="glow-text text-lg font-bold leading-none">CWP</div><div className="text-[11px] tracking-widest text-slate-400">OTP SERVICES</div></div></div>
        <nav className="relative flex-1 overflow-y-auto">
          <div className={`absolute inset-x-0 top-0 h-11 rounded-xl bg-gradient-to-r from-blue-500/35 to-violet-500/35 shadow-[0_0_24px_rgba(99,102,241,.3)] ring-1 ring-white/20 transition-transform duration-300 ${EASE}`}
            style={{ transform: `translateY(${Math.max(idx, 0) * 48}px)`, opacity: idx < 0 ? 0 : 1 }} />
          {NAV.map(([l, h, ic]) => (
            <Link key={l} href={"/dashboard" + h} className="relative z-10 mb-1 flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-slate-300 transition-colors hover:text-white"><Icon name={ic} />{l}</Link>))}
        </nav>
        <div className="relative space-y-2 border-t border-white/10 pt-3">
          <div className="truncate text-xs text-slate-400">{email}</div>
          <Btn variant="ghost" className="flex w-full items-center justify-center gap-2" onClick={logout}><Icon name="logout" className="h-4 w-4" />Logout</Btn>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="liquid mx-3 mt-3 flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2 lg:ml-0 lg:mr-4 lg:mt-4">
          <Logo size={32} className="relative lg:hidden" />
          <h1 className="relative text-base font-semibold">{title}</h1>
          <form className="relative ml-auto hidden w-full max-w-xs sm:block" onSubmit={(e) => { e.preventDefault(); router.push(`/dashboard/logs?q=${encodeURIComponent(search)}`); }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search request ID…"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 text-sm outline-none transition focus:border-violet-400" /></form>
          <div className="relative ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-semibold sm:ml-0" title={email}>{initial}</div>
          <button onClick={logout} className="relative rounded-xl p-2 text-slate-300 hover:bg-white/10 lg:hidden" aria-label="Logout"><Icon name="logout" /></button>
        </header>
        <main ref={scroller} className="flex-1 overflow-y-auto overscroll-contain px-3 pb-28 pt-3 lg:pb-6 lg:pl-0 lg:pr-4 lg:pt-4">
          <div key={path} className="animate-fade-in mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {more && <button aria-label="Close menu" className="absolute inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMore(false)} />}
      {more && (
        <div className="liquid animate-sheet-up absolute inset-x-3 z-40 grid grid-cols-2 gap-2 rounded-3xl p-3 lg:hidden" style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}>
          {NAV.slice(4).map(([l, h, ic]) => (
            <Link key={l} href={"/dashboard" + h} className="relative flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-3 text-sm active:bg-white/10"><Icon name={ic} />{l}</Link>))}
        </div>)}
      <nav className="liquid absolute inset-x-3 z-40 grid grid-cols-5 rounded-full p-1.5 lg:hidden" style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        <div className={`absolute bottom-1.5 left-1.5 top-1.5 w-[calc((100%-0.75rem)/5)] rounded-full bg-gradient-to-r from-blue-500/45 to-violet-500/45 shadow-[0_0_18px_rgba(99,102,241,.4)] ring-1 ring-white/25 transition-transform duration-300 ${EASE}`}
          style={{ transform: `translateX(${dockIdx * 100}%)` }} />
        {NAV.slice(0, 4).map(([l, h, ic], i) => (
          <Link key={l} href={"/dashboard" + h} className={`relative z-10 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${dockIdx === i ? "text-white" : "text-slate-400"}`}>
            <Icon name={ic} className="h-5 w-5" />{l}</Link>))}
        <button onClick={() => setMore(!more)} className={`relative z-10 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${dockIdx === 4 ? "text-white" : "text-slate-400"}`}>
          <Icon name="more" className="h-5 w-5" />More</button>
      </nav>
    </div>
  );
}
