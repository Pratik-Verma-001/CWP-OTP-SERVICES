"use client";
import { useState } from "react";
import { api, useApi } from "@/lib/client/api";
import { Badge, Btn, Card, ErrorBox, Field, inputCls, Loading, PageHead, Toggle } from "@/components/ui";

export default function Features() {
  const { data, error, loading, reload } = useApi<any>("/api/administration/features");
  const [f, setF] = useState({ key: "", name: "", description: "" });
  const [edit, setEdit] = useState<string | null>(null), [draft, setDraft] = useState({ name: "", description: "" });
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<any>) => { setErr(""); try { await fn(); await reload(); } catch (e: any) { setErr(e.message); } };
  const patch = (key: string, body: object) => run(() => api("/api/administration/features", { method: "PATCH", body: JSON.stringify({ key, ...body }) }));

  return (
    <div className="space-y-4">
      <PageHead title="Features" sub="Switch features on or off for the whole platform, set what new users get, or add your own flags." />
      <ErrorBox text={err || error} />
      <Card className="space-y-3">
        <h2 className="font-medium">Add a feature</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Key (a-z, 0-9, _)"><input className={inputCls} placeholder="bulk_sms" value={f.key} onChange={(e) => setF({ ...f, key: e.target.value.toLowerCase() })} /></Field>
          <Field label="Name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Description"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
        <Btn disabled={!f.key || !f.name} onClick={() => run(async () => { await api("/api/administration/features", { method: "POST", body: JSON.stringify(f) }); setF({ key: "", name: "", description: "" }); })}>Add feature</Btn>
        <p className="text-xs text-slate-500">Built-in features are enforced by the platform. Custom features are flags you can switch per user and read from the user's profile.</p>
      </Card>
      {loading && !data ? <Loading /> : (data?.features ?? []).map((x: any) => (
        <Card key={x.key} className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {edit === x.key ? (
                <div className="grid gap-2 sm:grid-cols-2"><input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  <input className={inputCls} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
              ) : (<><div className="flex items-center gap-2 font-medium">{x.name}{x.builtin && <Badge s="active" />}<code className="text-xs text-slate-500">{x.key}</code></div>
                <div className="text-sm text-slate-400">{x.description || "No description"}</div></>)}
            </div>
            <div className="flex gap-2">
              {edit === x.key ? <Btn onClick={() => { patch(x.key, draft); setEdit(null); }}>Save</Btn>
                : <Btn variant="ghost" onClick={() => { setEdit(x.key); setDraft({ name: x.name, description: x.description }); }}>Edit</Btn>}
              {!x.builtin && <Btn variant="danger" onClick={() => confirm(`Delete feature ${x.key}?`) && run(() => api(`/api/administration/features?key=${x.key}`, { method: "DELETE" }))}>Delete</Btn>}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"><span>Available on the platform</span><Toggle on={x.enabled} onChange={(v) => patch(x.key, { enabled: v })} /></div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"><span>On by default for new users</span><Toggle on={x.default_enabled} onChange={(v) => patch(x.key, { default_enabled: v })} /></div>
          </div>
        </Card>))}
    </div>
  );
}
