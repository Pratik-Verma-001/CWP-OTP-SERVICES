"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, useApi } from "@/lib/client/api";
import { Badge, Btn, Card, CopyBtn, ErrorBox, Icon, inputCls, Loading, PageHead, Toggle } from "@/components/ui";

const ago = (iso?: string | null) => { if (!iso) return "never"; const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`; };

export default function WhatsAppAdmin() {
  const { data, error, reload } = useApi<any>("/api/administration/worker");
  const [token, setToken] = useState(""), [phone, setPhone] = useState(""), [testTo, setTestTo] = useState(""), [code, setCode] = useState("");
  const [os, setOs] = useState<"termux" | "linux" | "windows">("termux"), [busy, setBusy] = useState(""), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => { reload(); tick((n) => n + 1); }, 2000); return () => clearInterval(t); }, [reload]);

  const post = async (action: string, extra: object = {}) => {
    setBusy(action); setMsg(null);
    try { const r = await api("/api/administration/worker", { method: "POST", body: JSON.stringify({ action, ...extra }) }); await reload(); return r; }
    catch (e: any) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(""); }
  };
  if (!data) return error ? <ErrorBox text={error} /> : <Loading />;

  const st = data.status, linked = st.state === "connected", app = data.endpoint.replace(/\/api\/worker$/, "");
  const qrAge = st.qrAt ? Math.max(0, Math.round((Date.now() - new Date(st.qrAt).getTime()) / 1000)) : null;
  const qrStale = qrAge !== null && qrAge > 70;
  const env = `APP_URL=${app}\nWORKER_TOKEN=${token || "<paste your token>"}`;
  const cmds = {
    termux: `pkg install nodejs git\ncd worker\nnpm install\ntermux-wake-lock\nset -a; . ./.env; set +a\nnode index.js`,
    linux: `# Node.js 18 or newer\ncd worker\nnpm install\nset -a; . ./.env; set +a\nnode index.js\n# keep it running: npm i -g pm2 && pm2 start index.js --name cwp-wa`,
    windows: `cd worker\nnpm install\n$env:APP_URL="${app}"\n$env:WORKER_TOKEN="<paste your token>"\nnode index.js`,
  }[os];
  const steps = [
    { ok: st.hasToken, label: "Token created", hint: st.hasToken ? "Ready" : "Create it below" },
    { ok: st.online, label: "Worker running", hint: st.online ? `Online${st.version ? " v" + st.version : ""}` : st.lastSeen ? `Last seen ${ago(st.lastSeen)}` : "Not started yet" },
    { ok: linked || st.state === "qr", label: "Scan QR or code", hint: st.state === "qr" ? "Waiting for your scan" : linked ? "Done" : "Not started" },
    { ok: linked, label: "WhatsApp linked", hint: linked ? `+${st.phone}` : "Not linked" },
  ];
  const statusBadge = !st.online ? "offline" : linked ? "connected" : "pending";

  return (
    <div className="space-y-4">
      <PageHead title="WhatsApp" sub="Link a WhatsApp number so OTPs can be sent over WhatsApp."><Badge s={statusBadge} /></PageHead>
      <ErrorBox text={error} />

      <Card>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.label} className={`flex items-center gap-2.5 rounded-2xl border p-3 ${s.ok ? "border-emerald-400/25 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${s.ok ? "bg-emerald-400/25 text-emerald-300" : "bg-white/10 text-slate-300"}`}>{s.ok ? <Icon name="check" className="h-4 w-4" /> : i + 1}</span>
              <span className="min-w-0"><span className="block truncate text-sm">{s.label}</span><span className="block truncate text-[11px] text-slate-400">{s.hint}</span></span>
            </div>))}
        </div>
      </Card>

      {/* 1. token */}
      <Card className="space-y-3">
        <h2 className="font-medium">1. Worker token</h2>
        <p className="text-sm text-slate-400">The worker proves it is yours with this secret token. The worker address is simply your app: <code>{data.endpoint}</code> (permanent, it never changes).</p>
        {token && <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-3"><code className="min-w-0 flex-1 break-all text-xs">{token}</code><CopyBtn text={token} /></div>}
        <div className="flex flex-wrap gap-2">
          <Btn disabled={!!busy} onClick={async () => { if (st.hasToken && !confirm("Create a new token? The running worker will disconnect until you update its .env.")) return; const r = await post("token"); if (r) setToken(r.token); }}>{busy === "token" ? "Working…" : st.hasToken ? "Rotate token" : "Create token"}</Btn>
          {st.hasToken && <Btn variant="ghost" disabled={!!busy} onClick={async () => { const r = await post("reveal"); if (r) setToken(r.token); }}>Show token</Btn>}
        </div>
      </Card>

      {/* 2. worker */}
      {st.hasToken && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-medium">2. Start the worker</h2>
            <span className={`text-sm ${st.online ? "text-emerald-300" : "text-amber-300"}`}>{st.online ? "Worker is online" : "Waiting for the worker…"}</span></div>
          <div className="flex rounded-xl border border-white/10 bg-black/20 p-1 text-xs">
            {([["termux", "Android (Termux)"], ["linux", "PC / Server"], ["windows", "Windows"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setOs(k)} className={`flex-1 rounded-lg px-2 py-2 transition ${os === k ? "bg-gradient-to-r from-a1 to-a2 text-white" : "text-slate-300"}`}>{l}</button>))}
          </div>
          <div className="text-xs text-slate-400">Create the file <code>worker/.env</code>:</div>
          <div className="relative"><pre className="overflow-x-auto rounded-xl bg-black/30 p-3 pr-16 text-xs">{env}</pre><div className="absolute right-2 top-2"><CopyBtn text={env} /></div></div>
          <div className="text-xs text-slate-400">Then run:</div>
          <div className="relative"><pre className="overflow-x-auto rounded-xl bg-black/30 p-3 pr-16 text-xs">{cmds}</pre><div className="absolute right-2 top-2"><CopyBtn text={cmds} /></div></div>
          {!st.online && <p className="text-xs text-slate-500">This page updates by itself. If it stays offline, see <Link href="/docs#whatsapp-troubleshooting" className="text-slate-300 underline">Troubleshooting</Link>.</p>}
        </Card>)}

      {/* 3. link */}
      {st.hasToken && st.online && !linked && (
        <Card className="space-y-4">
          <h2 className="font-medium">3. Link WhatsApp</h2>
          {st.lastError && <ErrorBox text={st.lastError} />}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium">Option A: scan a QR code</div>
              <ol className="list-decimal space-y-0.5 pl-5 text-xs text-slate-400">
                <li>Open WhatsApp on the phone you want to link</li><li>Settings (or the 3 dots) &gt; Linked devices</li><li>Link a device, then point the camera at this code</li></ol>
              {st.qr ? (
                <div className="space-y-2 text-center">
                  <img src={st.qr} alt="WhatsApp QR code" width={260} height={260} className="mx-auto h-auto w-full max-w-[260px] rounded-2xl bg-white p-2" />
                  <div className={`text-xs ${qrStale ? "text-amber-300" : "text-slate-400"}`}>{qrStale ? "This code may have expired. Press Regenerate." : `Code is ${qrAge ?? 0}s old. It refreshes automatically about every 20 seconds.`}</div>
                  <Btn variant="ghost" disabled={!!busy} onClick={() => post("qr")}>{busy === "qr" ? "Regenerating…" : "Regenerate QR"}</Btn>
                </div>
              ) : busy === "qr" || st.state === "connecting" ? (
                <div className="space-y-2" role="status"><div className="shimmer mx-auto h-[220px] w-full max-w-[260px] rounded-2xl" /><div className="text-center text-xs text-slate-400">Connecting to WhatsApp… this takes up to 20 seconds.</div></div>
              ) : <Btn disabled={!!busy} onClick={() => post("qr")}>Generate QR code</Btn>}
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium">Option B: pairing code (no camera needed)</div>
              <ol className="list-decimal space-y-0.5 pl-5 text-xs text-slate-400">
                <li>Enter the number of the phone you are linking</li><li>On that phone: Linked devices &gt; Link a device</li><li>Tap &quot;Link with phone number instead&quot; and type the code</li></ol>
              <input className={inputCls} inputMode="numeric" placeholder="Number with country code, e.g. 919876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Btn disabled={!!busy || phone.replace(/\D/g, "").length < 8} onClick={async () => { setCode(""); const r = await post("code", { phone }); if (r?.code) setCode(r.code); }}>{busy === "code" ? "Getting code…" : "Get pairing code"}</Btn>
              {code && <div className="rounded-2xl bg-black/30 p-3 text-center text-3xl font-bold tracking-[0.2em]">{code}</div>}
            </div>
          </div>
          {msg && <div className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</div>}
        </Card>)}

      {/* 4. linked */}
      {linked && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm">
            <span className="flex items-center gap-2"><Icon name="check" className="h-5 w-5 text-emerald-300" />WhatsApp is linked. OTPs are sent from +{st.phone}.</span>
            <Btn variant="danger" disabled={!!busy} onClick={() => confirm("Unlink this number?") && post("logout")}>Unlink</Btn></div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Send a test message</div>
            <div className="flex flex-col gap-2 sm:flex-row"><input className={inputCls} inputMode="tel" placeholder="Number with country code" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <Btn className="shrink-0" disabled={!!busy || testTo.replace(/\D/g, "").length < 8} onClick={async () => { const r = await post("test", { phone: testTo }); if (r) setMsg({ ok: true, text: "Test message sent." }); }}>{busy === "test" ? "Sending…" : "Send test"}</Btn></div>
            {msg && <div className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</div>}
          </div>
        </Card>)}

      {st.hasToken && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"><span>Use WhatsApp for OTPs</span>
            <Toggle on={!!data.enabled} onChange={async (v) => { await api("/api/administration/worker", { method: "PUT", body: JSON.stringify({ enabled: v }) }); reload(); }} /></div>
          <p className="text-xs text-slate-500">Unofficial method: WhatsApp may restrict numbers used for automated messages. Use a spare number and keep volume low. Full guide: <Link href="/docs#whatsapp" className="text-slate-300 underline">Documentation</Link>.</p>
        </Card>)}
    </div>
  );
}
