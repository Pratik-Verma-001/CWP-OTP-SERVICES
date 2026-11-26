"use client";
import { useState } from "react";
import Link from "next/link";
import { api, useApi } from "@/lib/client/api";
import { Badge, Btn, Card, CopyBtn, Empty, ErrorBox, Field, Icon, inputCls, Loading, PageHead } from "@/components/ui";

export default function Users() {
  const [q, setQ] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(1);
  const qs = new URLSearchParams({ ...(q && { q }), ...(status && { status }), page: String(page) }).toString();
  const { data, error, loading, reload } = useApi<any>(`/api/administration/users?${qs}`);
  const [add, setAdd] = useState(false), [f, setF] = useState({ email: "", name: "" });
  const [err, setErr] = useState(""), [link, setLink] = useState(""), [busy, setBusy] = useState(false);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  const create = async () => {
    setBusy(true); setErr(""); setLink("");
    try { const r = await api("/api/administration/users", { method: "POST", body: JSON.stringify({ email: f.email, name: f.name || undefined }) }); setLink(r.resetLink); setF({ email: "", name: "" }); reload(); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <PageHead title="Users" sub="Manage accounts, approvals, features and limits.">
        <Btn onClick={() => setAdd(!add)} className="flex items-center gap-1.5"><Icon name="plus" className="h-4 w-4" />Add user</Btn>
      </PageHead>
      {add && (
        <Card className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email"><input className={inputCls} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Name (optional)"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          </div>
          <ErrorBox text={err} />
          <Btn disabled={busy || !f.email} onClick={create}>Create user</Btn>
          {link && <div className="space-y-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm">
            <div>User created. Send them this one-time link so they can set a password:</div>
            <code className="block break-all rounded bg-black/30 p-2 text-xs">{link}</code><CopyBtn text={link} /></div>}
        </Card>)}
      <Card className="grid gap-2 sm:grid-cols-[1fr_12rem]">
        <input className={inputCls} placeholder="Search name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select>
      </Card>
      <ErrorBox text={error} />
      {loading && !data ? <Loading /> : !data?.users?.length ? <Card><Empty text="No users found" /></Card> : (
        <>
          <Card className="hidden overflow-x-auto p-0 md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-slate-400"><tr>{["User", "Status", "Projects", "OTPs (30d)", "Last login"].map((h) => <th key={h} className="p-3 font-normal">{h}</th>)}</tr></thead>
              <tbody>{data.users.map((u: any) => (
                <tr key={u.id} className="border-t border-white/10 transition hover:bg-white/5">
                  <td className="p-3"><Link href={`/administration/users/${u.id}`} className="block hover:underline">{u.display_name || u.email}<span className="block text-xs text-slate-500">{u.email}</span></Link></td>
                  <td className="p-3"><Badge s={u.status} /></td><td className="p-3">{u.projects}</td><td className="p-3">{u.otp30d}</td>
                  <td className="p-3 text-xs text-slate-400">{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "never"}</td></tr>))}</tbody></table>
          </Card>
          <div className="space-y-2 md:hidden">{data.users.map((u: any) => (
            <Link key={u.id} href={`/administration/users/${u.id}`} className="block"><Card className="space-y-1.5 !p-3 text-sm transition active:scale-[.99]">
              <div className="flex items-center justify-between gap-2"><span className="truncate font-medium">{u.display_name || u.email}</span><Badge s={u.status} /></div>
              <div className="truncate text-xs text-slate-500">{u.email}</div>
              <div className="text-xs text-slate-400">{u.projects} projects · {u.otp30d} OTPs (30d)</div>
            </Card></Link>))}</div>
          <div className="flex items-center justify-between text-sm text-slate-400"><span>{data.total} users</span>
            <div className="flex items-center gap-2"><Btn variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Btn><span>{page} / {pages}</span><Btn variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Btn></div></div>
        </>)}
    </div>
  );
}
