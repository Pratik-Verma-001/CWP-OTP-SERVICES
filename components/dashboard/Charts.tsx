"use client";
import { Bars, Card, HBars } from "@/components/ui";

export function RangeSelect({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <div className="flex gap-1">
      {[[1, "Today"], [7, "7 days"], [30, "30 days"], [90, "90 days"]].map(([d, l]) => (
        <button key={d} onClick={() => onChange(d as number)}
          className={`rounded-lg px-3 py-1.5 text-xs ${days === d ? "bg-a2 text-white" : "border border-navy-600 text-slate-300"}`}>{l}</button>
      ))}
    </div>
  );
}

export function Charts({ s }: { s: any }) {
  const t = s.totals ?? {};
  const v = (t.verifyOk ?? 0) + (t.verifyFail ?? 0);
  const rate = v ? Math.round((t.verifyOk / v) * 100) : null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="md:col-span-2"><h3 className="mb-3 text-sm font-medium">Daily OTP usage <span className="text-xs text-slate-500">(email · whatsapp)</span></h3>
        <Bars data={s.daily.map((d: any) => ({ label: d.date, values: [d.email, d.whatsapp] }))} colors={["#3b82f6", "#8b5cf6"]} /></Card>
      <Card><h3 className="mb-3 text-sm font-medium">Email vs WhatsApp</h3>
        <HBars items={[{ label: "Email", value: t.email ?? 0 }, { label: "WhatsApp", value: t.whatsapp ?? 0 }]} /></Card>
      <Card><h3 className="mb-3 text-sm font-medium">Verification success rate</h3>
        {rate === null ? <div className="text-sm text-slate-500">No verifications yet</div> : <>
          <div className="text-3xl font-semibold">{rate}%</div>
          <div className="mt-2 h-2 rounded bg-navy-900"><div className="h-2 rounded bg-emerald-500" style={{ width: `${rate}%` }} /></div></>}</Card>
      <Card><h3 className="mb-3 text-sm font-medium">Project usage</h3><HBars items={s.byProject} /></Card>
      <Card><h3 className="mb-3 text-sm font-medium">Delivery failures</h3>
        <Bars data={s.daily.map((d: any) => ({ label: d.date, values: [d.failed] }))} colors={["#ef4444"]} /></Card>
    </div>
  );
}
