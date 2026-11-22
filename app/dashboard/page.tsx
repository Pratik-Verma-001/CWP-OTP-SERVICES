"use client";
import { useState } from "react";
import { useApi } from "@/lib/client/api";
import { Badge, Card, Empty, ErrorBox, Loading, Stat } from "@/components/ui";
import { Charts, RangeSelect } from "@/components/dashboard/Charts";
import SetupChecklist from "@/components/dashboard/SetupChecklist";

export default function Dashboard() {
  const [days, setDays] = useState(7);
  const { data: s, error, loading } = useApi<any>(`/api/admin/stats?days=${days}`);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-lg font-semibold">Dashboard</h1><RangeSelect days={days} onChange={setDays} /></div>
      <SetupChecklist />
      <ErrorBox text={error} />
      {loading && !s ? <Loading /> : s?.empty ? <Card><Empty text="No projects yet. Create one under Projects to get started." /></Card> : s && (<>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Total OTP requests" value={s.totals.total} /><Stat label="Requests today" value={s.totals.today} />
          <Stat label="Email OTP" value={s.totals.email} /><Stat label="WhatsApp OTP" value={s.totals.whatsapp} />
          <Stat label="Successful verifications" value={s.totals.verifyOk} /><Stat label="Failed verifications" value={s.totals.verifyFail} />
          <Stat label="Active API keys" value={s.totals.activeKeys} /><Stat label="Active projects" value={s.totals.activeProjects} />
        </div>
        <Charts s={s} />
        <Card><h3 className="mb-3 text-sm font-medium">Recent activity</h3>
          {!s.recent.length ? <Empty text="No OTP activity yet" /> : <div className="space-y-2">{s.recent.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0 truncate">{r.projects?.name} · {r.masked_recipient} · {r.channel}</div>
              <div className="flex shrink-0 items-center gap-2"><Badge s={r.status} /><span className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</span></div>
            </div>))}</div>}</Card>
      </>)}
    </div>
  );
}
