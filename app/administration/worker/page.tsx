"use client";
import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/client/api";
import { Badge, Btn, Card, CopyBtn, ErrorBox, inputCls, Loading, PageHead, Toggle } from "@/components/ui";

const LABEL: Record<string, string> = { connected: "Linked and ready", qr: "Waiting for scan", connecting: "Connecting…", disconnected: "Online, not linked", offline: "Worker offline" };

export default function WorkerPage() {
  const { data, error, reload } = useApi<any>("/api/administration/worker");
  const [token, setToken] = useState(""), [phone, setPhone] = useState(""), [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => { const t = setInterval(reload, 3000); return () => clearInterval(t); }, [reload]);

  const post = async (action: string, extra: object = {}) => {
    setBusy(true); setMsg(null);
    try { const r = await api("/api/administration/worker", { method: "POST", body: JSON.stringify({ action, ...extra }) }); await reload(); return r; }
    catch (e: any) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };
  if (!data) return error ? <ErrorBox text={error} /> : <Loading />;
  const st = data.status, linked = st.state === "connected";
  const cmd = `cd worker\nset -a; . ./.env; set +a\nnode index.js`;

  return (
    <div className="space-y-4">
      <PageHead title="WhatsApp worker" sub="Link a WhatsApp number to send OTPs. The worker connects out to this app, so the URL never changes.">
        <Badge s={st.online ? (linked ? "connected" : "pending") : "offline"} />
      </PageHead>
      <ErrorBox text={error} />

      <Card className="space-y-3">
        <h2 className="font-medium">1. Permanent worker URL</h2>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-3"><code className="min-w-0 flex-1 truncate text-sm">{data.endpoint}</code><CopyBtn text={data.endpoint} /></div>
        <p className="text-xs text-slate-500">This is your app address. It never changes and only a worker with the secret token below can use it. Nothing is exposed from your phone or PC.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-medium">2. Worker token (admin only)</h2>
        {!st.hasToken ? <p className="text-sm text-slate-400">No token yet. Generate one and put it in <code>worker/.env</code> as WORKER_TOKEN.</p>
          : <p className="text-sm text-slate-400">A token exists. Reveal it to copy it, or generate a new one (this disconnects the old worker).</p>}
        {token && <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-3"><code className="min-w-0 flex-1 break-all text-xs">{token}</code><CopyBtn text={token} /></div>}
        <div className="flex flex-wrap gap-2">
          <Btn disabled={busy} onClick={async () => { if (st.hasToken && !confirm("Generate a new token? The current worker will disconnect.")) return; const r = await post("token"); if (r) setToken(r.token); }}>{st.hasToken ? "Rotate token" : "Generate token"}</Btn>
          {st.hasToken && <Btn variant="ghost" disabled={busy} onClick={async () => { const r = await post("reveal"); if (r) setToken(r.token); }}>Reveal token</Btn>}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-medium">3. Start the worker</h2>
        <pre className="overflow-x-auto rounded-xl bg-black/30 p-3 text-xs">{`# worker/.env\nAPP_URL=${data.endpoint.replace(/\/api\/worker$/, "")}\nWORKER_TOKEN=<token from step 2>\n\n${cmd}`}</pre>
        <p className="text-xs text-slate-500">Run it on Termux, a PC or a VPS and keep it running. Status above turns to "Online" within a few seconds. See worker/README.md.</p>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-2"><h2 className="font-medium">4. Link WhatsApp</h2><span className="text-sm text-slate-400">{LABEL[st.state]}{st.phone ? ` · +${st.phone}` : ""}</span></div>
        {!st.online ? <p className="text-sm text-slate-400">Start the worker first.</p> : linked ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm">
            <span>Number linked. OTPs are sent from +{st.phone}.</span>
            <Btn variant="danger" disabled={busy} onClick={() => confirm("Unlink this number?") && post("logout")}>Unlink</Btn></div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium">Option A: scan QR</div>
              <p className="text-xs text-slate-400">WhatsApp &gt; Settings &gt; Linked devices &gt; Link a device. Scan from another phone.</p>
              {st.qr ? <img src={st.qr} alt="WhatsApp QR code" className="mx-auto w-56 rounded-2xl bg-white p-2" /> : <Btn disabled={busy} onClick={() => post("qr")}>{busy ? "Starting…" : "Show QR code"}</Btn>}
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium">Option B: pairing code</div>
              <p className="text-xs text-slate-400">WhatsApp &gt; Linked devices &gt; Link a device &gt; Link with phone number instead, then enter the code.</p>
              <input className={inputCls} inputMode="numeric" placeholder="Number with country code, e.g. 919876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Btn disabled={busy || phone.replace(/\D/g, "").length < 8} onClick={async () => { const r = await post("code", { phone }); if (r?.code) setCode(r.code); }}>Get pairing code</Btn>
              {code && <div className="rounded-2xl bg-black/30 p-3 text-center text-3xl font-bold tracking-[0.2em]">{code}</div>}
            </div>
          </div>)}
        {msg && <div className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</div>}
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"><span>Use WhatsApp for OTPs</span>
          <Toggle on={!!data.enabled} onChange={async (v) => { await api("/api/administration/worker", { method: "PUT", body: JSON.stringify({ enabled: v }) }); reload(); }} /></div>
        <p className="text-xs text-slate-500">Unofficial method: WhatsApp may restrict numbers used for automated messages. Use a spare number and keep volume low.</p>
      </Card>
    </div>
  );
}
