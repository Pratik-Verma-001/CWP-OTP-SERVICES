"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/client/firebase";
import { Backdrop, Icon, Logo } from "@/components/ui";
import type { Me } from "@/lib/client/session";

export type NavItem = { label: string; href: string; icon: string; group: string; exact?: boolean; dock?: boolean };
const EASE = "[transition-timing-function:cubic-bezier(.4,0,.2,1)]";

// One shell for both panels. The root is fixed to the screen and only <main> scrolls, so a phone's address bar
// can never resize the page and make the navigation jump. Desktop (lg+): sidebar. Phone/tablet: bottom dock.
export default function PanelShell({ variant, nav, me, switchTo, children }: {
  variant: "user" | "admin"; nav: NavItem[]; me: Me; switchTo?: { label: string; href: string; icon: string }; children: ReactNode;
}) {
  const path = usePathname(), router = useRouter();
  const scroller = useRef<HTMLElement>(null);
  const [more, setMore] = useState(false), [q, setQ] = useState("");
  useEffect(() => { setMore(false); scroller.current?.scrollTo({ top: 0 }); }, [path]);
  const logout = async () => { await signOut(auth); router.replace("/login"); };

  const active = nav.filter((i) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/"))).sort((a, b) => b.href.length - a.href.length)[0];
  const dock = nav.filter((i) => i.dock);
  const dockIdx = active && dock.includes(active) ? dock.indexOf(active) : dock.length;
  const groups = nav.reduce<Record<string, NavItem[]>>((m, i) => { (m[i.group] ??= []).push(i); return m; }, {});
  const initial = (me.name || me.email || "A")[0].toUpperCase();
  const admin = variant === "admin";
  const Avatar = ({ size = "h-9 w-9" }: { size?: string }) => <div className={`relative grid ${size} shrink-0 place-items-center rounded-full bg-gradient-to-br from-a1 to-a2 text-sm font-semibold text-white`}>{initial}</div>;

  return (
    <div data-panel={variant} className="fixed inset-0 flex overflow-hidden">
      <Backdrop />

      {/* Desktop sidebar */}
      <aside className="liquid m-3 hidden w-64 shrink-0 flex-col rounded-3xl p-4 lg:flex">
        <div className="relative mb-5 flex items-center gap-3">
          <Logo size={42} />
          <div className="min-w-0"><div className="glow-text text-lg font-bold leading-none">CWP</div>
            <div className="mt-1 text-[10px] tracking-[0.2em] text-slate-400">{admin ? "ADMINISTRATION" : "OTP SERVICES"}</div></div>
        </div>
        <nav className="relative flex-1 space-y-4 overflow-y-auto pr-1">
          {Object.entries(groups).map(([g, items]) => (
            <div key={g}>
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{g}</div>
              {items.map((i) => (
                <Link key={i.href} href={i.href} className={`mb-0.5 flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${active === i
                  ? "bg-gradient-to-r from-a1/30 to-a2/30 text-white ring-1 ring-white/15" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                  <Icon name={i.icon} className="h-[18px] w-[18px]" />{i.label}</Link>))}
            </div>))}
        </nav>
        <div className="relative mt-3 space-y-2 border-t border-white/10 pt-3">
          {switchTo && <Link href={switchTo.href} className="flex h-10 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 text-sm hover:bg-white/10"><Icon name={switchTo.icon} className="h-[18px] w-[18px]" />{switchTo.label}</Link>}
          <div className="flex items-center gap-2">
            <Avatar />
            <div className="min-w-0 flex-1"><div className="truncate text-sm">{me.name || me.email}</div><div className="truncate text-[11px] capitalize text-slate-500">{me.role}</div></div>
            <button onClick={logout} aria-label="Logout" className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white"><Icon name="logout" /></button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="liquid mx-3 mt-3 flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 lg:ml-0 lg:mr-3">
          <Logo size={32} className="relative lg:hidden" />
          <div className="relative min-w-0 flex-1">
            <div className="truncate text-base font-semibold lg:hidden">{active?.label ?? "Dashboard"}</div>
            <div className="hidden items-center gap-2 text-sm text-slate-400 lg:flex">
              {admin ? <span className="rounded-full bg-gradient-to-r from-a1 to-a2 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white">ADMIN</span> : <span>Workspace</span>}
              <span className="text-slate-600">/</span><span className="text-slate-200">{active?.label ?? "Dashboard"}</span>
            </div>
          </div>
          {!admin && (
            <form className="relative hidden w-full max-w-xs sm:block" onSubmit={(e) => { e.preventDefault(); router.push(`/dashboard/logs?q=${encodeURIComponent(q)}`); }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search request ID…" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 text-sm outline-none transition focus:border-a2" /></form>)}
          <div className="relative hidden items-center gap-2 sm:flex lg:hidden"><Avatar size="h-8 w-8" /></div>
          <button onClick={logout} aria-label="Logout" className="relative rounded-xl p-2 text-slate-300 hover:bg-white/10 lg:hidden"><Icon name="logout" /></button>
        </header>

        <main ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-28 pt-3 sm:px-5 lg:pb-8 lg:pl-1 lg:pr-5">
          <div key={path} className="animate-fade-in mx-auto w-full max-w-6xl space-y-4">
            {!admin && me.announcement && <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">{me.announcement}</div>}
            {!admin && me.maintenance && <div className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">The platform is in maintenance mode: sending OTPs is paused.</div>}
            {children}
          </div>
        </main>
      </div>

      {/* Phone and tablet: dock */}
      {more && <button aria-label="Close menu" className="absolute inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMore(false)} />}
      {more && (
        <div className="liquid animate-sheet-up absolute inset-x-3 z-40 grid grid-cols-2 gap-2 rounded-3xl p-3 sm:grid-cols-3 lg:hidden" style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}>
          {nav.filter((i) => !i.dock).map((i) => (
            <Link key={i.href} href={i.href} className="relative flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-3 text-sm active:bg-white/10"><Icon name={i.icon} />{i.label}</Link>))}
          {switchTo && <Link href={switchTo.href} className="relative flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-sm"><Icon name={switchTo.icon} />{switchTo.label}</Link>}
        </div>)}
      <nav className="liquid absolute inset-x-3 z-40 grid grid-cols-5 rounded-full p-1.5 sm:inset-x-auto sm:left-1/2 sm:w-[28rem] sm:-translate-x-1/2 lg:hidden" style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        <div className={`absolute bottom-1.5 left-1.5 top-1.5 w-[calc((100%-0.75rem)/5)] rounded-full bg-gradient-to-r from-a1/50 to-a2/50 ring-1 ring-white/25 transition-transform duration-300 ${EASE}`} style={{ transform: `translateX(${dockIdx * 100}%)` }} />
        {dock.map((i, n) => (
          <Link key={i.href} href={i.href} className={`relative z-10 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${dockIdx === n ? "text-white" : "text-slate-400"}`}>
            <Icon name={i.icon} className="h-5 w-5" />{i.label.replace("API ", "").replace("OTP ", "")}</Link>))}
        <button onClick={() => setMore(!more)} className={`relative z-10 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${dockIdx === dock.length ? "text-white" : "text-slate-400"}`}>
          <Icon name="more" className="h-5 w-5" />More</button>
      </nav>
    </div>
  );
}
