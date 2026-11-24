"use client";
import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/client/api";
import { Badge, Btn, Card, Empty, ErrorBox, Field, inputCls } from "@/components/ui";

export default function TestOtp() {
  const { data } = useApi<any>("/api/admin/projects");
  const projects = data?.projects ?? [];
  const [projectId, setProjectId] = useState(""), [channel, setChannel] = useState<"email" | "whatsapp">("email"), [recipient, setRecipient] = useState("");
  const [sent, setSent] = useState<{ requestId: string; expiresIn: number } | null>(null), [code, setCode] = useState("");
  const [verified, setVerified] = useState<boolean | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { if (!projectId && projects.length) setProjectId(projects[0].id); }, [projects, projectId]);

  const call = async (body: object) => api("/api/admin/test-otp", { method: "POST", body: JSON.stringify({ projectId, ...body }) });
  const send = async () => {
    setBusy(true); setErr(""); setSent(null); setVerified(null); setCode("");
    try { setSent(await call({ action: "send", channel, recipient: recipient.trim() })); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const verify = async () => {
    setBusy(true); setErr("");
    try { setVerified((await call({ action: "verify", requestId: sent!.requestId, code: code.trim() })).verified); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Test OTP</h1>
      <p className="text-sm text-slate-400">Runs the real flow: sends a real OTP using your saved email / WhatsApp settings, then checks the code you receive.</p>
      {!projects.length ? <Card><Empty text="Create a project and an API key first" /></Card> : (
        <Card className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Project"><select className={inputCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Channel">
              <div className="flex rounded-xl border border-white/10 bg-black/20 p-1 text-sm">
                {(["email", "whatsapp"] as const).map((c) => (
                  <button key={c} onClick={() => setChannel(c)} className={`flex-1 rounded-lg px-3 py-1.5 capitalize transition ${channel === c ? "bg-gradient-to-r from-a1 to-a2 text-white" : "text-slate-300"}`}>{c}</button>))}
              </div></Field>
          </div>
          <Field label={channel === "email" ? "Send to (email)" : "Send to (WhatsApp number with country code)"}>
            <input className={inputCls} type={channel === "email" ? "email" : "tel"} placeholder={channel === "email" ? "you@example.com" : "+919876543210"} value={recipient} onChange={(e) => setRecipient(e.target.value)} /></Field>
          <Btn disabled={busy || !recipient} onClick={send}>{busy && !sent ? "Sending…" : "Send test OTP"}</Btn>
          <ErrorBox text={err} />
          {sent && (
            <div className="animate-fade-up space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-emerald-300">OTP sent. It expires in {Math.round(sent.expiresIn / 60)} minutes.</div>
              <Field label="Enter the code you received"><input className={`${inputCls} text-center text-xl tracking-[0.3em]`} inputMode="numeric" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></Field>
              <div className="flex items-center gap-3"><Btn disabled={busy || code.length < 4} onClick={verify}>Verify</Btn>
                {verified !== null && <Badge s={verified ? "verified" : "failed"} />}</div>
              {verified === false && <div className="text-xs text-slate-400">Wrong, expired or already used code.</div>}
            </div>)}
        </Card>)}
    </div>
  );
}
