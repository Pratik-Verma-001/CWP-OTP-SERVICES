"use client";
import Link from "next/link";
import { api, useApi } from "@/lib/client/api";
import { Badge, Btn, Card, Empty, ErrorBox, Loading, PageHead, Stat } from "@/components/ui";

export default function Overview() {
  const { data: s, error, loading, reload } = useApi<any>("/api/administration/overview");
  const approve = async (id: string) => { await api(`/api/administration/users/${id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) }); reload(); };
  return (
    <div className="space-y-4">
      <PageHead title="Platform overview" sub="Everything happening across all users." />
      <ErrorBox text={error} />
      {loading && !s ? <Loading /> : s && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Users" value={s.users} /><Stat label="Pending approval" value={s.pending} /><Stat label="Projects" value={s.projects} />
            <Stat label="Active API keys" value={s.keys} /><Stat label="OTPs (7 days)" value={s.otp7d} /><Stat label="Failed (7 days)" value={s.failed7d} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-3">
              <div className="flex items-center justify-between"><h2 className="font-medium">Connections</h2></div>
              <Link href="/administration/worker" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-sm hover:bg-white/10">
                <span>WhatsApp worker{s.worker.phone ? ` (+${s.worker.phone})` : ""}</span><Badge s={s.worker.online ? (s.worker.state === "connected" ? "connected" : "pending") : "offline"} /></Link>
              <Link href="/administration/email" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-sm hover:bg-white/10">
                <span>Platform email sender</span><Badge s={s.email ? "active" : "disabled"} /></Link>
            </Card>
            <Card className="space-y-3">
              <h2 className="font-medium">Waiting for approval</h2>
              {!s.pendingUsers.length ? <Empty text="No pending users" /> : s.pendingUsers.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/administration/users/${u.id}`} className="min-w-0 truncate hover:underline">{u.display_name || u.email}<span className="block truncate text-xs text-slate-500">{u.email}</span></Link>
                  <Btn className="shrink-0 !px-3 !py-1.5" onClick={() => approve(u.id)}>Approve</Btn>
                </div>))}
            </Card>
          </div>
        </>)}
    </div>
  );
}
