"use client";
import { useState } from "react";
import { api, useApi } from "@/lib/client/api";
import { Badge, Btn, Card, CopyBtn, Empty, ErrorBox, Field, inputCls, Loading, PageLoading } from "@/components/ui";

export default function ApiKeys() {
  const { data, error, loading, reload } = useApi<any>("/api/admin/projects");
  const [projectId, setProjectId] = useState(""), [name, setName] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null), [err, setErr] = useState("");
  const act = async (fn: () => Promise<any>) => { setErr(""); try { const r = await fn(); if (r?.rawKey) setRevealed(r.rawKey); await reload(); } catch (e: any) { setErr(e.message); } };
  const patch = (keyId: string, action: string) => act(() => api("/api/admin/keys", { method: "PATCH", body: JSON.stringify({ keyId, action }) }));
  const projects = data?.projects ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">API Keys</h1>
      {revealed && <Card className="space-y-2 border-a2">
        <div className="text-sm font-medium">Copy this key now. It will not be shown again.</div>
        <code className="block break-all rounded bg-navy-900 p-2 text-xs">{revealed}</code>
        <div className="flex gap-2"><CopyBtn text={revealed} /><Btn variant="ghost" onClick={() => setRevealed(null)}>I saved it</Btn></div></Card>}
      <Card className="grid gap-3 md:grid-cols-3">
        <Field label="Project"><select className={inputCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Select…</option>{projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Key name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Production" /></Field>
        <div className="flex items-end"><Btn disabled={!projectId || !name} onClick={() => act(async () => { const r = await api("/api/admin/keys", { method: "POST", body: JSON.stringify({ projectId, name }) }); setName(""); return r; })}>Create key</Btn></div>
      </Card>
      <ErrorBox text={err || error} />
      {loading && !data ? <PageLoading /> : !projects.length ? <Card><Empty text="Create a project first" /></Card> :
        projects.map((p: any) => (
          <Card key={p.id} className="space-y-3"><div className="font-medium">{p.name}</div>
            {!p.api_keys.length ? <Empty text="No keys yet" /> : p.api_keys.map((k: any) => (
              <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-navy-600 pt-3">
                <div><div className="text-sm">{k.name} <Badge s={k.status} /></div>
                  <div className="text-xs text-slate-400">{k.prefix}… · created {new Date(k.created_at).toLocaleDateString()} · last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}</div></div>
                {k.status !== "revoked" && <div className="flex gap-2">
                  <Btn variant="ghost" onClick={() => patch(k.id, k.status === "active" ? "disable" : "enable")}>{k.status === "active" ? "Disable" : "Enable"}</Btn>
                  <Btn variant="ghost" onClick={() => confirm("Rotate? The old key stops working immediately.") && patch(k.id, "rotate")}>Rotate</Btn>
                  <Btn variant="danger" onClick={() => confirm("Revoke permanently?") && patch(k.id, "revoke")}>Revoke</Btn></div>}
              </div>))}
          </Card>))}
    </div>
  );
}
