"use client";
import { useState } from "react";
import { api, useApi } from "@/lib/client/api";
import { Badge, Btn, Card, Empty, ErrorBox, Field, inputCls, Loading, PageLoading } from "@/components/ui";

export default function Projects() {
  const { data, error, loading, reload } = useApi<any>("/api/admin/projects");
  const [f, setF] = useState({ name: "", websiteUrl: "", description: "", origins: "" });
  const [err, setErr] = useState("");
  const act = async (fn: () => Promise<any>) => { setErr(""); try { await fn(); await reload(); } catch (e: any) { setErr(e.message); } };

  const create = () => act(async () => {
    await api("/api/admin/projects", { method: "POST", body: JSON.stringify({
      name: f.name, websiteUrl: f.websiteUrl || undefined, description: f.description || undefined,
      allowedOrigins: f.origins.split(",").map((s) => s.trim()).filter(Boolean) }) });
    setF({ name: "", websiteUrl: "", description: "", origins: "" });
  });
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Projects</h1>
      <Card className="grid gap-3 md:grid-cols-2">
        <Field label="Project name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="CWP-Pay" /></Field>
        <Field label="Website URL"><input className={inputCls} value={f.websiteUrl} onChange={(e) => setF({ ...f, websiteUrl: e.target.value })} placeholder="https://example.com" /></Field>
        <Field label="Allowed origins (comma separated, optional)"><input className={inputCls} value={f.origins} onChange={(e) => setF({ ...f, origins: e.target.value })} placeholder="https://example.com" /></Field>
        <Field label="Description"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div><Btn onClick={create} disabled={!f.name}>Create project</Btn></div>
      </Card>
      <ErrorBox text={err || error} />
      {loading && !data ? <PageLoading /> : !data?.projects?.length ? <Card><Empty text="No projects yet" /></Card> :
        data.projects.map((p: any) => (
          <Card key={p.id} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><div className="font-medium">{p.name} <Badge s={p.status} /></div>
                <div className="text-xs text-slate-400">{p.website_url ?? "No website"} · {p.api_keys.length} key(s) · created {new Date(p.created_at).toLocaleDateString()}</div></div>
              <div className="flex gap-2">
                <Btn variant="ghost" onClick={() => act(() => api("/api/admin/projects", { method: "PATCH", body: JSON.stringify({ id: p.id, status: p.status === "active" ? "paused" : "active" }) }))}>
                  {p.status === "active" ? "Pause" : "Activate"}</Btn>
                <Btn variant="danger" onClick={() => confirm(`Delete ${p.name} and all its keys and logs?`) && act(() => api(`/api/admin/projects?id=${p.id}`, { method: "DELETE" }))}>Delete</Btn>
              </div>
            </div>
            {p.description && <div className="text-sm text-slate-300">{p.description}</div>}
          </Card>))}
    </div>
  );
}
