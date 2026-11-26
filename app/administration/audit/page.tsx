"use client";
import { useState } from "react";
import { useApi } from "@/lib/client/api";
import { Btn, Card, Empty, ErrorBox, Loading, PageHead } from "@/components/ui";

export default function Audit() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useApi<any>(`/api/administration/audit?page=${page}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  return (
    <div className="space-y-4">
      <PageHead title="Audit log" sub="Every administrative action, newest first." />
      <ErrorBox text={error} />
      <Card className="space-y-0 !p-0">
        {loading && !data ? <div className="p-4"><Loading /></div> : !data?.rows?.length ? <Empty text="Nothing recorded yet" /> : data.rows.map((r: any) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-sm first:border-0">
            <div className="min-w-0"><code className="text-xs">{r.action}</code><div className="truncate text-xs text-slate-500">{r.admin_profiles?.email ?? (r.metadata?.actor === "admin" ? "administrator" : "system")} · {r.entity_type}{r.entity_id ? ` ${String(r.entity_id).slice(0, 8)}` : ""}</div></div>
            <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</span></div>))}
      </Card>
      <div className="flex items-center justify-between text-sm text-slate-400"><span>{data?.total ?? 0} entries</span>
        <div className="flex items-center gap-2"><Btn variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Btn><span>{page} / {pages}</span><Btn variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Btn></div></div>
    </div>
  );
}
