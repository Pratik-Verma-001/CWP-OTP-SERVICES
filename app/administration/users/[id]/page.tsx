"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, useApi } from "@/lib/client/api";
import { Badge, Bars, Btn, Card, Empty, ErrorBox, Field, Icon, inputCls, Loading, Stat } from "@/components/ui";

type Tri = "default" | "on" | "off";
const LIMITS: [string, string][] = [["maxProjects", "Max projects"], ["maxKeysPerProject", "Keys per project"], ["dailyOtpLimit", "OTPs per day"]];

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: me } = useApi<any>("/api/admin/me");
  const { data: d, error, loading, reload } = useApi<any>(`/api/administration/users/${id}`);
  const [name, setName] = useState(""), [notes, setNotes] = useState(""), [role, setRole] = useState("user");
  const [feat, setFeat] = useState<Record<string, Tri>>({}), [lim, setLim] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null), [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!d) return;
    setName(d.user.name ?? ""); setNotes(d.user.notes ?? ""); setRole(d.user.role);
    const f: Record<string, Tri> = {};
    for (const c of d.catalog) f[c.key] = d.user.features[c.key] === undefined ? "default" : d.user.features[c.key] ? "on" : "off";
    setFeat(f);
    setLim(Object.fromEntries(LIMITS.map(([k]) => [k, d.user.limits[k] === undefined ? "" : String(d.user.limits[k])])));
  }, [d]);

  const patch = async (body: object, ok = "Saved") => {
    setBusy(true); setMsg(null);
    try { await api(`/api/administration/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }); setMsg({ ok: true, text: ok }); await reload(); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };
  const saveAll = () => patch({
    displayName: name.trim() || null, notes: notes.trim() || null, ...(role !== d.user.role && { role }),
    features: Object.fromEntries(Object.entries(feat).map(([k, v]) => [k, v === "default" ? null : v === "on"])),
    ...(d.user.role === "user" && { limits: Object.fromEntries(LIMITS.map(([k]) => [k, lim[k] === "" ? null : Number(lim[k])])) }),
  });
  const remove = async () => {
    if (!confirm(`Delete ${d.user.email}? This also deletes their projects, keys and logs. It cannot be undone.`)) return;
    try { await api(`/api/administration/users/${id}`, { method: "DELETE" }); router.replace("/administration/users"); } catch (e: any) { setMsg({ ok: false, text: e.message }); }
  };

  if (loading && !d) return <Loading />;
  if (!d) return <ErrorBox text={error || "User not found"} />;
  const u = d.user, isUser = u.role === "user", owner = me?.role === "owner", self = me?.id === u.id;
  const locked = !isUser && !owner && !self;

  return (
    <div className="space-y-4">
      <Link href="/administration/users" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><Icon name="back" className="h-4 w-4" />All users</Link>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-xl font-semibold">{u.name || u.email}</h1><Badge s={u.role} /><Badge s={u.status} /></div>
          <div className="truncate text-sm text-slate-400">{u.email}</div>
          <div className="mt-1 text-xs text-slate-500">Joined {new Date(u.created_at).toLocaleDateString()} · last login {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "never"}</div></div>
        {!self && !locked && (
          <div className="flex flex-wrap gap-2">
            {u.status !== "active" && <Btn disabled={busy} onClick={() => patch({ status: "active" }, "Account activated")}>{u.status === "pending" ? "Approve" : "Reactivate"}</Btn>}
            {u.status !== "suspended" && <Btn variant="ghost" disabled={busy} onClick={() => patch({ status: "suspended" }, "Account suspended")}>Suspend</Btn>}
            <Btn variant="danger" disabled={busy} onClick={remove}>Delete</Btn>
          </div>)}
      </Card>
      {msg && <div className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="OTPs (30 days)" value={d.usage.total} /><Stat label="Email OTP" value={d.usage.email} /><Stat label="WhatsApp OTP" value={d.usage.whatsapp} />
        <Stat label="Failed deliveries" value={d.usage.failed} /><Stat label="Successful verifications" value={d.usage.verifyOk} /><Stat label="Failed verifications" value={d.usage.verifyFail} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3"><h2 className="font-medium">Usage per feature</h2>
          {d.featureUsage.map((f: any) => (
            <div key={f.key} className="flex items-center justify-between gap-2 text-sm"><span>{f.label}</span>
              <span className="flex items-center gap-2 text-slate-300">{f.value}<Badge s={d.effective[f.key] === false ? "disabled" : "active"} /></span></div>))}
        </Card>
        <Card className="space-y-2"><h2 className="font-medium">OTPs per day (30 days)</h2>
          <Bars data={d.usage.daily.map((x: any) => ({ label: x.date, values: [x.count] }))} colors={["#38bdf8"]} /></Card>
      </div>

      <Card className="space-y-4">
        <h2 className="font-medium">Profile and access</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Name"><input className={inputCls} value={name} disabled={locked} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Role"><select className={inputCls} value={role} disabled={!owner || self} onChange={(e) => setRole(e.target.value)}>
            <option value="user">User</option><option value="admin">Administrator</option><option value="owner">Owner</option></select></Field>
          <Field label="Private notes (admins only)"><input className={inputCls} value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        <div>
          <div className="mb-2 text-sm font-medium">Features</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {d.catalog.map((c: any) => (
              <div key={c.key} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="min-w-0"><div className="truncate text-sm">{c.name}</div><div className="text-[11px] text-slate-500">{c.enabled ? `default: ${c.default_enabled ? "on" : "off"}` : "disabled globally"}</div></div>
                <select className={`${inputCls} !w-28 !py-1.5`} disabled={!isUser || locked} value={feat[c.key] ?? "default"} onChange={(e) => setFeat({ ...feat, [c.key]: e.target.value as Tri })}>
                  <option value="default">Default</option><option value="on">On</option><option value="off">Off</option></select>
              </div>))}
          </div>
          {!isUser && <p className="mt-2 text-xs text-slate-500">Administrators are not restricted by per-user features or limits.</p>}
        </div>
        {isUser && (
          <div>
            <div className="mb-2 text-sm font-medium">Limits <span className="font-normal text-slate-500">(empty = platform default)</span></div>
            <div className="grid gap-3 sm:grid-cols-3">{LIMITS.map(([k, l]) => (
              <Field key={k} label={l}><input className={inputCls} type="number" min={0} inputMode="numeric" placeholder="default" value={lim[k] ?? ""} onChange={(e) => setLim({ ...lim, [k]: e.target.value })} /></Field>))}</div>
          </div>)}
        <Btn disabled={busy || locked} onClick={saveAll}>Save changes</Btn>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2"><h2 className="font-medium">Projects ({d.projects.length})</h2>
          {!d.projects.length ? <Empty text="No projects" /> : d.projects.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <div className="min-w-0"><div className="truncate">{p.name}</div><div className="truncate text-xs text-slate-500">{p.website_url || "no website"} · {p.api_keys.length} key(s)</div></div><Badge s={p.status} /></div>))}
        </Card>
        <Card className="space-y-2"><h2 className="font-medium">Recent OTP requests</h2>
          {!d.recent.length ? <Empty text="No OTP activity" /> : d.recent.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 truncate">{r.projects?.name} · {r.masked_recipient} · {r.channel}</span>
              <span className="flex shrink-0 items-center gap-2"><Badge s={r.status} /><span className="hidden text-xs text-slate-500 sm:inline">{new Date(r.created_at).toLocaleString()}</span></span></div>))}
        </Card>
      </div>
      <Card className="space-y-2"><h2 className="font-medium">Activity history</h2>
        {!d.activity.length ? <Empty text="No recorded activity" /> : d.activity.map((a: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-2 border-t border-white/5 pt-2 text-sm first:border-0 first:pt-0"><code className="text-xs">{a.action}</code>
            <span className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</span></div>))}
      </Card>
    </div>
  );
}
