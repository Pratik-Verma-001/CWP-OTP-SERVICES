"use client";
import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/client/api";
import { Btn, Card, ErrorBox, Field, Icon, inputCls } from "@/components/ui";

type Msg = { ok: boolean; text: string } | null;
const Note = ({ m }: { m: Msg }) => m ? <div className={`text-sm ${m.ok ? "text-emerald-300" : "text-red-300"}`}>{m.text}</div> : null;
const STATE: Record<string, [string, string]> = {
  connected: ["Connected", "bg-emerald-400/15 text-emerald-300"], qr: ["Waiting for scan", "bg-amber-400/15 text-amber-300"],
  connecting: ["Connecting…", "bg-blue-400/15 text-blue-300"], disconnected: ["Not linked", "bg-slate-400/15 text-slate-300"],
};

function LinkDevice() {
  const { data, reload } = useApi<any>("/api/admin/whatsapp");
  const [f, setF] = useState({ workerUrl: "", workerSecret: "", enabled: true });
  const [phone, setPhone] = useState(""), [code, setCode] = useState(""), [msg, setMsg] = useState<Msg>(null), [busy, setBusy] = useState(false);

  useEffect(() => { if (data?.mode === "qr") setF((x) => ({ ...x, workerUrl: data.workerUrl, enabled: data.enabled })); }, [data?.mode, data?.workerUrl, data?.enabled]);
  const st = data?.worker?.state as string | undefined;
  useEffect(() => { if (st !== "qr" && st !== "connecting") return; const t = setInterval(reload, 3000); return () => clearInterval(t); }, [st, reload]);

  const run = async (fn: () => Promise<any>, ok = "") => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); if (ok) setMsg({ ok: true, text: ok }); await reload(); return r; }
    catch (e: any) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };
  const save = () => run(() => api("/api/admin/whatsapp", { method: "PUT", body: JSON.stringify({ enabled: f.enabled, workerUrl: f.workerUrl, workerSecret: f.workerSecret || undefined }) }), "Saved");
  const act = (action: string, extra: object = {}) => run(async () => {
    const r = await api("/api/admin/whatsapp", { method: "POST", body: JSON.stringify({ action, ...extra }) });
    if (action === "code") setCode(r.code); else setCode("");
    return r;
  });
  const [label, tone] = STATE[st ?? "disconnected"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded-full px-3 py-1 text-xs ${tone}`}>{data?.worker ? label : "Worker not connected"}</span>
        {data?.worker?.phone && <span className="text-slate-300">+{data.worker.phone}</span>}
      </div>
      {st !== "connected" && (
        <ol className="list-decimal space-y-1 rounded-2xl border border-white/10 bg-white/5 p-4 pl-8 text-xs text-slate-300">
          <li className="font-medium text-slate-100">How to connect WhatsApp</li>
          <li>Start the worker on Termux or a server: <code>cd worker &amp;&amp; node index.js</code> (see worker/README.md).</li>
          <li>Make it reachable: <code>cloudflared tunnel --url http://localhost:3001</code> and copy the https link.</li>
          <li>Paste that link and the worker secret below, tick Enabled, press Save.</li>
          <li>Press &quot;Show QR code&quot; (scan from another phone) or use the pairing code.</li>
        </ol>)}
      <ErrorBox text={data?.error ?? ""} />
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Worker URL"><input className={inputCls} placeholder="https://your-worker.example.com" value={f.workerUrl} onChange={(e) => setF({ ...f, workerUrl: e.target.value })} /></Field>
        <Field label="Worker secret (write-only)"><input className={inputCls} type="password" placeholder={data?.hasSecret ? "•••••• saved, leave blank to keep" : "WORKER_SECRET from worker/.env"} value={f.workerSecret} onChange={(e) => setF({ ...f, workerSecret: e.target.value })} /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />Enabled</label>
        <Btn disabled={busy || !f.workerUrl} onClick={save}>Save</Btn>
      </div>

      {data?.hasSecret && data?.worker && st !== "connected" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-medium">Option 1: Scan QR</div>
            <p className="text-xs text-slate-400">WhatsApp &gt; Settings &gt; Linked devices &gt; Link a device, then scan.</p>
            {data.worker.qr ? <img src={data.worker.qr} alt="WhatsApp QR" className="mx-auto w-56 rounded-2xl bg-white p-2" /> :
              <Btn disabled={busy} onClick={() => act("qr")}>Show QR code</Btn>}
          </div>
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-medium">Option 2: Pairing code</div>
            <p className="text-xs text-slate-400">WhatsApp &gt; Linked devices &gt; Link a device &gt; Link with phone number instead, then enter the code.</p>
            <input className={inputCls} inputMode="numeric" placeholder="WhatsApp number with country code, e.g. 919876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Btn disabled={busy || phone.replace(/\D/g, "").length < 8} onClick={() => act("code", { phone })}>Get pairing code</Btn>
            {code && <div className="rounded-2xl bg-black/30 p-3 text-center text-3xl font-bold tracking-[0.2em]">{code}</div>}
          </div>
        </div>
      )}
      {st === "connected" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm">
          <Icon name="check" className="h-5 w-5 text-emerald-300" />Number linked. OTPs will be sent from +{data.worker.phone}.
          <Btn variant="danger" className="ml-auto" disabled={busy} onClick={() => confirm("Unlink this number?") && act("logout")}>Unlink</Btn>
        </div>)}
      <Note m={msg} />
      <p className="text-xs text-slate-500">Unofficial method: WhatsApp may restrict numbers used for automated messages. Use a spare number and keep volume low. The worker must stay running (see worker/README.md).</p>
    </div>
  );
}

function Official() {
  const { data, reload } = useApi<any>("/api/admin/providers");
  const [wa, setWa] = useState<any>({ enabled: false, phoneNumberId: "", businessAccountId: "", accessToken: "", apiVersion: "v21.0", templateName: "", templateLanguage: "en_US" });
  const [msg, setMsg] = useState<Msg>(null), [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setWa((x: any) => ({ ...x, ...data.whatsapp.settings, enabled: data.whatsapp.enabled, accessToken: "" })); }, [data]);
  const run = async (fn: () => Promise<any>, ok: string) => { setBusy(true); setMsg(null); try { await fn(); setMsg({ ok: true, text: ok }); await reload(); } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); } };
  const t = (k: string, label: string, type = "text", ph = "") => <Field label={label}><input className={inputCls} type={type} placeholder={ph} value={wa[k] ?? ""} onChange={(e) => setWa({ ...wa, [k]: e.target.value })} /></Field>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Needs a Meta developer account, Phone Number ID and an approved authentication template. Saving this replaces the linked-device mode.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {t("phoneNumberId", "Phone number ID")}{t("businessAccountId", "Business account ID (optional)")}
        {t("accessToken", "Access token (write-only)", "password", data?.whatsapp.hasAccessToken ? "•••••• saved, leave blank to keep" : "")}{t("apiVersion", "API version")}
        {t("templateName", "Authentication template name")}{t("templateLanguage", "Template language")}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wa.enabled} onChange={(e) => setWa({ ...wa, enabled: e.target.checked })} />Enabled</label>
      <div className="flex gap-2">
        <Btn disabled={busy} onClick={() => run(() => api("/api/admin/providers", { method: "PUT", body: JSON.stringify({ provider: "whatsapp", enabled: wa.enabled, secrets: { accessToken: wa.accessToken || undefined },
          settings: { phoneNumberId: wa.phoneNumberId, businessAccountId: wa.businessAccountId || "", apiVersion: wa.apiVersion, templateName: wa.templateName, templateLanguage: wa.templateLanguage } }) }), "Saved")}>Save</Btn>
        <Btn variant="ghost" disabled={busy} onClick={() => run(() => api("/api/admin/providers", { method: "POST", body: JSON.stringify({ provider: "whatsapp", action: "verify" }) }), "Configuration OK")}>Test configuration</Btn>
      </div><Note m={msg} />
    </div>
  );
}

export default function WhatsAppCard() {
  const [tab, setTab] = useState<"link" | "official">("link");
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">WhatsApp</h2>
        <div className="flex rounded-xl border border-white/10 bg-black/20 p-1 text-xs">
          {([["link", "Link device (QR / code)"], ["official", "Official API (advanced)"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 transition ${tab === k ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white" : "text-slate-300"}`}>{l}</button>))}
        </div>
      </div>
      {tab === "link" ? <LinkDevice /> : <Official />}
    </Card>
  );
}
