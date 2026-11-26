"use client";
import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/client/api";
import { Btn, Card, ErrorBox, Field, inputCls, Loading, PageHead, Toggle } from "@/components/ui";

function ChangePassword() {
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null), [busy, setBusy] = useState(false);
  const save = async () => {
    if (f.next !== f.again) return setMsg({ ok: false, text: "The new passwords do not match." });
    setBusy(true); setMsg(null);
    try { await api("/api/administration/password", { method: "POST", body: JSON.stringify({ current: f.current, next: f.next }) }); setF({ current: "", next: "", again: "" }); setMsg({ ok: true, text: "Password changed. Other sessions were signed out." }); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };
  return (
    <Card className="space-y-3"><h2 className="font-medium">Administrator password</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Current password"><input className={inputCls} type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
        <Field label="New password (10+ characters)"><input className={inputCls} type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
        <Field label="Repeat new password"><input className={inputCls} type="password" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} /></Field>
      </div>
      {msg && <div className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</div>}
      <Btn disabled={busy || !f.current || f.next.length < 10} onClick={save}>Change password</Btn></Card>
  );
}

const MODES: [string, string, string][] = [["open", "Open", "Anyone can sign up and start immediately"], ["approval", "Approval", "Sign-ups wait until an admin approves them"], ["closed", "Closed", "Only admins can add users"]];

export default function PlatformSettings() {
  const { data, error, loading, reload } = useApi<any>("/api/administration/settings");
  const [s, setS] = useState<any>(null), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setS({ ...data, limits: Object.fromEntries(Object.entries(data.limits).map(([k, v]) => [k, String(v)])) }); }, [data]);
  if (loading && !s) return <Loading />;
  if (!s) return <ErrorBox text={error} />;
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await api("/api/administration/settings", { method: "PUT", body: JSON.stringify({ registration: s.registration, maintenance: s.maintenance, announcement: s.announcement,
        limits: Object.fromEntries(Object.entries(s.limits).map(([k, v]) => [k, Number(v) || 0])) }) });
      setMsg({ ok: true, text: "Settings saved" }); reload();
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    setBusy(false);
  };
  return (
    <div className="space-y-4">
      <PageHead title="Platform settings" sub="Controls that apply to everyone." />
      <Card className="space-y-3"><h2 className="font-medium">Registration</h2>
        <div className="grid gap-2 sm:grid-cols-3">{MODES.map(([k, l, d]) => (
          <button key={k} onClick={() => setS({ ...s, registration: k })} className={`rounded-2xl border p-3 text-left transition active:scale-[.98] ${s.registration === k ? "border-a2 bg-gradient-to-br from-a1/20 to-a2/20" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
            <div className="text-sm font-medium">{l}</div><div className="text-xs text-slate-400">{d}</div></button>))}</div></Card>
      <Card className="space-y-3"><h2 className="font-medium">Default limits for users</h2>
        <div className="grid gap-3 sm:grid-cols-3">{[["maxProjects", "Max projects"], ["maxKeysPerProject", "Keys per project"], ["dailyOtpLimit", "OTPs per day"]].map(([k, l]) => (
          <Field key={k} label={l}><input className={inputCls} type="number" min={0} inputMode="numeric" value={s.limits[k]} onChange={(e) => setS({ ...s, limits: { ...s.limits, [k]: e.target.value } })} /></Field>))}</div>
        <p className="text-xs text-slate-500">Override per user on the user's page. Administrators have no limits.</p></Card>
      <Card className="space-y-3"><h2 className="font-medium">Announcement and maintenance</h2>
        <Field label="Banner shown to all users (empty = none)"><input className={inputCls} maxLength={300} value={s.announcement} onChange={(e) => setS({ ...s, announcement: e.target.value })} /></Field>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"><div><div>Maintenance mode</div><div className="text-xs text-slate-500">Pauses sending OTPs through the API</div></div>
          <Toggle on={s.maintenance} onChange={(v) => setS({ ...s, maintenance: v })} /></div></Card>
      {msg && <div className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</div>}
      <Btn disabled={busy} onClick={save}>Save settings</Btn>
      <ChangePassword />
    </div>
  );
}
