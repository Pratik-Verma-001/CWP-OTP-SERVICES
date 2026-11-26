"use client";
import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/client/api";
import { Btn, ErrorBox, Field, inputCls, Loading } from "@/components/ui";

export type Scope = { kind: "global" } | { kind: "project"; projectId: string };
const PRESETS: [string, string, string, string][] = [
  ["Gmail", "smtp.gmail.com", "465", "ssl"], ["Outlook", "smtp.office365.com", "587", "tls"],
  ["Zoho", "smtp.zoho.in", "465", "ssl"], ["Yahoo", "smtp.mail.yahoo.com", "465", "ssl"],
];
const BLANK = { enabled: false, host: "", port: "465", username: "", password: "", encryption: "ssl", fromName: "", fromEmail: "", replyTo: "", timeoutMs: "10000" };

export default function SmtpForm({ scope }: { scope: Scope }) {
  const path = scope.kind === "global" ? "/api/administration/providers" : `/api/admin/project-smtp?projectId=${scope.projectId}`;
  const { data, error, loading, reload } = useApi<any>(path);
  const info = scope.kind === "global" ? data?.smtp : data;
  const [f, setF] = useState<any>(BLANK);
  const [to, setTo] = useState(""), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null), [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!info) return;
    const s = info.settings ?? {};
    setF((x: any) => ({ ...x, host: s.host ?? "", port: String(s.port ?? "465"), username: s.username ?? "", encryption: s.encryption ?? "ssl",
      fromName: s.fromName ?? "", fromEmail: s.fromEmail ?? "", replyTo: s.replyTo ?? "", timeoutMs: String(s.timeoutMs ?? "10000"), enabled: !!info.enabled, password: "" }));
  }, [info]);

  const settings = () => ({ host: f.host.trim(), port: Number(f.port), username: f.username.trim(), encryption: f.encryption,
    fromName: f.fromName.trim(), fromEmail: f.fromEmail.trim(), replyTo: f.replyTo.trim(), timeoutMs: Number(f.timeoutMs) || 10000 });
  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); await reload(); } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };
  const save = () => run(() => api(scope.kind === "global" ? "/api/administration/providers" : "/api/admin/project-smtp", {
    method: "PUT", body: JSON.stringify(scope.kind === "global"
      ? { provider: "smtp", enabled: f.enabled, settings: settings(), secrets: { password: f.password || undefined } }
      : { projectId: scope.projectId, enabled: f.enabled, settings: settings(), password: f.password || undefined }) }), "Saved");
  const test = (action: string) => run(() => api(scope.kind === "global" ? "/api/administration/providers" : "/api/admin/project-smtp", {
    method: "POST", body: JSON.stringify(scope.kind === "global" ? { provider: "smtp", action, to: to || undefined } : { projectId: scope.projectId, action, to: to || undefined }) }),
    action === "verify" ? "Connection OK: server and login accepted." : `Test email sent${to ? ` to ${to}` : " to your account email"}. Check the inbox (and spam).`);
  const t = (k: string, label: string, type = "text", ph = "") =>
    <Field label={label}><input className={inputCls} type={type} placeholder={ph} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>;

  if (loading && !data) return <Loading />;
  return (
    <div className="space-y-4">
      <ErrorBox text={error} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400">Quick fill:</span>
        {PRESETS.map(([n, h, p, e]) => (
          <button key={n} onClick={() => setF({ ...f, host: h, port: p, encryption: e })} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs transition active:scale-95 hover:bg-white/10">{n}</button>))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {t("host", "SMTP host", "text", "smtp.gmail.com")}{t("port", "Port", "number")}
        {t("username", "Email / username", "email", "you@gmail.com")}
        {t("password", "App password (write-only)", "password", info?.hasPassword ? "•••••• saved, leave blank to keep" : "16-letter app password")}
        <Field label="Encryption"><select className={inputCls} value={f.encryption} onChange={(e) => setF({ ...f, encryption: e.target.value })}><option value="ssl">SSL (port 465)</option><option value="tls">STARTTLS (port 587)</option></select></Field>
        {t("fromName", "Sender name (shown to users)", "text", "My Website")}{t("fromEmail", "Sender email", "email", "same as your email")}
        {t("replyTo", "Reply-to (optional)", "email")}
      </div>
      <p className="text-xs text-slate-500">Gmail: Google Account &gt; Security &gt; 2-Step Verification &gt; App passwords. Use that 16-letter password here, not your normal password. Spaces are removed automatically.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />Enabled (use this sender for OTP emails)</label>
      <div className="flex flex-wrap gap-2"><Btn disabled={busy} onClick={save}>Save</Btn><Btn variant="ghost" disabled={busy} onClick={() => test("verify")}>Test connection</Btn></div>
      <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-medium">Send a test email</div>
        <input className={inputCls} type="email" placeholder={scope.kind === "global" ? "Send the test to (email address)" : "Send to (empty = your account email)"} value={to} onChange={(e) => setTo(e.target.value)} />
        <Btn variant="ghost" disabled={busy} onClick={() => test("test_email")}>Send test email</Btn>
      </div>
      {msg && <div className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</div>}
    </div>
  );
}
