"use client";
import Link from "next/link";
import { useApi } from "@/lib/client/api";
import { Card, Icon } from "@/components/ui";

export default function SetupChecklist() {
  const { data: s } = useApi<any>("/api/admin/setup");
  if (!s) return null;
  const steps = [
    { done: s.projects > 0, label: "Create a project", hint: "Your website or app", href: "/dashboard/projects" },
    { done: s.keys > 0, label: "Create an API key", hint: "Used by your website", href: "/dashboard/api-keys" },
    { done: s.email, label: "Connect email", hint: "Your mailbox + app password", href: "/dashboard/email" },
    { done: s.whatsapp, label: "Connect WhatsApp", hint: "Scan QR or pairing code", href: "/dashboard/whatsapp" },
    { done: s.tested > 0, label: "Send a test OTP", hint: "Check it really works", href: "/dashboard/test" },
  ];
  const n = steps.filter((x) => x.done).length;
  if (n === steps.length) return null;
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="font-medium">Get started</h2><span className="text-xs text-slate-400">{n}/{steps.length} done</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-a1 to-a2 transition-all duration-700" style={{ width: `${(n / steps.length) * 100}%` }} /></div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((x) => (
          <Link key={x.label} href={x.href} className={`flex items-center gap-3 rounded-2xl border p-3 transition active:scale-[.98] ${x.done ? "border-emerald-400/20 bg-emerald-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${x.done ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10 text-slate-300"}`}><Icon name={x.done ? "check" : "pulse"} className="h-4 w-4" /></span>
            <span className="min-w-0"><span className="block truncate text-sm">{x.label}</span><span className="block truncate text-xs text-slate-400">{x.hint}</span></span>
          </Link>))}
      </div>
    </Card>
  );
}
