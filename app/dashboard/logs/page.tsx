"use client";
import { useEffect, useState } from "react";
import { download, useApi } from "@/lib/client/api";
import { Badge, Btn, Card, Empty, ErrorBox, inputCls, Loading, PageLoading } from "@/components/ui";

export default function Logs() {
  const [f, setF] = useState({ project: "", channel: "", status: "", from: "", to: "", q: "", sort: "desc" });
  const [page, setPage] = useState(1);
  useEffect(() => { const q = new URLSearchParams(window.location.search).get("q"); if (q) setF((x) => ({ ...x, q })); }, []);
  const qs = (extra = "") => new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), page: String(page) }).toString() + extra;
  const { data, error, loading } = useApi<any>(`/api/admin/logs?${qs()}`);
  const set = (k: string, v: string) => { setF({ ...f, [k]: v }); setPage(1); };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-lg font-semibold">OTP Logs</h1>
        <Btn variant="ghost" onClick={() => download(`/api/admin/logs?${qs("&format=csv")}`, "otp-logs.csv")}>Export CSV</Btn></div>
      <Card className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-4">
        <select className={inputCls} value={f.project} onChange={(e) => set("project", e.target.value)}><option value="">All projects</option>
          {(data?.projects ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className={inputCls} value={f.channel} onChange={(e) => set("channel", e.target.value)}><option value="">All channels</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select>
        <select className={inputCls} value={f.status} onChange={(e) => set("status", e.target.value)}><option value="">All statuses</option>
          {["pending", "sent", "failed", "verified", "expired", "locked"].map((s) => <option key={s}>{s}</option>)}</select>
        <select className={inputCls} value={f.sort} onChange={(e) => set("sort", e.target.value)}><option value="desc">Newest first</option><option value="asc">Oldest first</option></select>
        <input className={inputCls} type="date" value={f.from} onChange={(e) => set("from", e.target.value)} />
        <input className={inputCls} type="date" value={f.to} onChange={(e) => set("to", e.target.value)} />
        <input className={`${inputCls} min-[420px]:col-span-2`} placeholder="Request ID (full UUID)" value={f.q} onChange={(e) => set("q", e.target.value)} />
      </Card>
      <ErrorBox text={error} />
      <Card className="hidden overflow-x-auto p-0 sm:block">
        {loading && !data ? <div className="p-4"><PageLoading /></div> : !data?.rows?.length ? <Empty text="No logs match these filters" /> : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-slate-400"><tr>{["Request ID", "Project", "Recipient", "Channel", "Status", "Provider", "Attempts", "Created", "Expires"].map((h) => <th key={h} className="p-3 font-normal">{h}</th>)}</tr></thead>
            <tbody>{data.rows.map((r: any) => (
              <tr key={r.id} className="border-t border-navy-600">
                <td className="p-3 font-mono text-xs">{r.id.slice(0, 8)}…</td><td className="p-3">{r.projects?.name}</td><td className="p-3">{r.masked_recipient}</td>
                <td className="p-3">{r.channel}</td><td className="p-3"><Badge s={r.status} /></td>
                <td className="p-3">{r.delivery_logs?.[0] ? <Badge s={r.delivery_logs[0].status === "delivered" ? "sent" : r.delivery_logs[0].status} /> : "-"}</td>
                <td className="p-3">{r.attempts}</td><td className="p-3 text-xs">{new Date(r.created_at).toLocaleString()}</td><td className="p-3 text-xs">{new Date(r.expires_at).toLocaleTimeString()}</td>
              </tr>))}</tbody></table>)}
      </Card>
      <div className="space-y-2 sm:hidden">
        {loading && !data ? <PageLoading /> : !data?.rows?.length ? <Card><Empty text="No logs match these filters" /></Card> : data.rows.map((r: any) => (
          <Card key={r.id} className="space-y-1.5 !p-3 text-sm">
            <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{r.projects?.name}</span><Badge s={r.status} /></div>
            <div className="truncate text-slate-300">{r.masked_recipient} · {r.channel}</div>
            <div className="flex justify-between text-xs text-slate-500"><span>{new Date(r.created_at).toLocaleString()}</span><span>attempts {r.attempts}</span></div>
            <div className="font-mono text-[11px] text-slate-500">{r.id.slice(0, 8)}…</div>
          </Card>))}
      </div>
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{data?.total ?? 0} total</span>
        <div className="flex items-center gap-2"><Btn variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Btn><span>{page} / {pages}</span>
          <Btn variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Btn></div></div>
    </div>
  );
}
