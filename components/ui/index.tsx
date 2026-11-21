"use client";
import { useEffect, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#050a1c]">
      <div className="blob -left-24 -top-24 h-[28rem] w-[28rem] bg-blue-600/40" />
      <div className="blob -right-24 top-1/4 h-[26rem] w-[26rem] bg-violet-600/35 [animation-delay:-6s]" />
      <div className="blob -bottom-32 left-1/4 h-[24rem] w-[24rem] bg-cyan-500/25 [animation-delay:-12s]" />
    </div>
  );
}

export const Logo = ({ size = 40, className = "" }: { size?: number; className?: string }) =>
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/logo.png" alt="CWP OTP Services" width={size} height={size} className={`rounded-full ${className}`} />;

const ICONS: Record<string, string> = {
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  key: "M15.5 7.5l3 3L22 7l-3-3m-3.5 3.5L19 4m-3.5 3.5a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8z",
  projects: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  logs: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  analytics: "M3 3v18h18M7 15l4-4 3 3 5-6",
  providers: "M4 5h16v5H4zM4 14h16v5H4zM8 7.5h.01M8 16.5h.01",
  docs: "M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4zM4 16a4 4 0 014-4h12",
  settings: "M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M14 4v4M6 10v4M16 16v4",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  logout: "M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4M16 17l5-5-5-5M21 12H9",
};
export const Icon = ({ name, className = "h-5 w-5" }: { name: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={ICONS[name] ?? ""} />
  </svg>
);

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) =>
  <div className={`glass animate-fade-up rounded-2xl p-4 ${className}`}>{children}</div>;

function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 800);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n}</>;
}

export const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="glass animate-fade-up rounded-2xl p-4 transition duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(99,102,241,.25)]">
    <div className="text-xs text-slate-400">{label}</div>
    <div className="glow-text mt-1 text-3xl font-semibold">{typeof value === "number" ? <CountUp value={value} /> : value}</div>
  </div>
);

export function Btn({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const v = {
    primary: "bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-[0_4px_20px_rgba(99,102,241,.35)] hover:shadow-[0_6px_28px_rgba(139,92,246,.55)]",
    ghost: "border border-white/15 bg-white/5 text-slate-100 backdrop-blur hover:bg-white/10",
    danger: "bg-red-500/80 text-white hover:bg-red-500",
  }[variant];
  return <button {...p} className={`rounded-xl px-4 py-2 text-sm font-medium transition duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50 ${v} ${className}`} />;
}
export const inputCls = "w-full rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-sm outline-none backdrop-blur transition placeholder:text-slate-500 focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(139,92,246,.25)]";
export const Field = ({ label, children }: { label: string; children: ReactNode }) =>
  <label className="block text-xs text-slate-400">{label}<div className="mt-1">{children}</div></label>;

const tone: Record<string, string> = {
  active: "bg-emerald-400/15 text-emerald-300", sent: "bg-emerald-400/15 text-emerald-300", verified: "bg-emerald-400/15 text-emerald-300",
  paused: "bg-amber-400/15 text-amber-300", disabled: "bg-amber-400/15 text-amber-300", pending: "bg-amber-400/15 text-amber-300",
  revoked: "bg-red-400/15 text-red-300", failed: "bg-red-400/15 text-red-300", locked: "bg-red-400/15 text-red-300", expired: "bg-slate-400/15 text-slate-300",
};
export const Badge = ({ s }: { s: string }) =>
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${tone[s] ?? "bg-slate-500/20"}`}><i className="h-1.5 w-1.5 rounded-full bg-current" />{s}</span>;

export const Loading = () => (
  <div className="space-y-3" aria-busy="true"><div className="shimmer h-20 rounded-2xl" /><div className="shimmer h-20 rounded-2xl" /><div className="shimmer h-20 rounded-2xl" /></div>
);
export const Empty = ({ text }: { text: string }) => <div className="py-8 text-center text-sm text-slate-500">{text}</div>;
export const ErrorBox = ({ text }: { text: string }) =>
  text ? <div className="animate-fade-up rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{text}</div> : null;

export function Bars({ data, colors }: { data: { label: string; values: number[] }[]; colors: string[] }) {
  const max = Math.max(1, ...data.map((d) => d.values.reduce((a, b) => a + b, 0)));
  if (!data.length) return <Empty text="No data in this range" />;
  return (
    <div className="flex h-40 items-end gap-1 overflow-x-auto">
      {data.map((d, i) => (
        <div key={d.label} className="flex h-full min-w-[10px] flex-1 flex-col justify-end" title={`${d.label}: ${d.values.join(" / ")}`}>
          {d.values.map((v, j) => (
            <div key={j} className="origin-bottom animate-grow rounded-t" style={{ height: `${(v / max) * 100}%`, background: colors[j], animationDelay: `${i * 30}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
export function HBars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <Empty text="No data in this range" />;
  return <div className="space-y-3">{items.map((i, n) => (
    <div key={i.label}><div className="flex justify-between text-xs text-slate-300"><span>{i.label}</span><span>{i.value}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-2 origin-left animate-grow-x rounded-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${(i.value / max) * 100}%`, animationDelay: `${n * 80}ms` }} /></div></div>
  ))}</div>;
}
export function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <Btn variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>{done ? "Copied ✓" : "Copy"}</Btn>;
}
