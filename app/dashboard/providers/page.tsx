"use client";
import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/client/api";
import { Btn, Card, ErrorBox, Field, inputCls, Loading } from "@/components/ui";
import WhatsAppCard from "@/components/providers/WhatsAppCard";

export default function Providers() {
  const { data, error, loading, reload } = useApi<any>("/api/admin/providers");
  const [smtp, setSmtp] = useState<any>({ enabled: false, host: "", port: "465", username: "", password: "", encryption: "ssl", fromName: "CWP OTP Services", fromEmail: "", replyTo: "", timeoutMs: "10000" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null), [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setSmtp((x: any) => ({ ...x, ...data.smtp.settings, port: String(data.smtp.settings.port ?? x.port), timeoutMs: String(data.smtp.settings.timeoutMs ?? x.timeoutMs), enabled: data.smtp.enabled, password: "" }));
  }, [data]);

  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); await reload(); } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  };
  const save = () => run(() => api("/api/admin/providers", { method: "PUT", body: JSON.stringify({
    provider: "smtp", enabled: smtp.enabled, secrets: { password: smtp.password || undefined },
    settings: { host: smtp.host, port: Number(smtp.port), username: smtp.username, encryption: smtp.encryption, fromName: smtp.fromName, fromEmail: smtp.fromEmail, replyTo: smtp.replyTo || "", timeoutMs: Number(smtp.timeoutMs) } }) }), "Saved");
  const test = (action: string) => run(() => api("/api/admin/providers", { method: "POST", body: JSON.stringify({ provider: "smtp", action }) }),
    action === "test_email" ? "Test email sent to your admin address" : "Connection OK");
  const t = (k: string, label: string, type = "text", ph = "") =>
    <Field label={label}><input className={inputCls} type={type} placeholder={ph} value={smtp[k] ?? ""} onChange={(e) => setSmtp({ ...smtp, [k]: e.target.value })} /></Field>;
  if (loading && !data) return <Loading />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Providers</h1><ErrorBox text={error} />
      <Card className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="font-medium">Email (SMTP)</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={smtp.enabled} onChange={(e) => setSmtp({ ...smtp, enabled: e.target.checked })} />Enabled</label></div>
        <div className="grid gap-3 md:grid-cols-2">
          {t("host", "SMTP host", "text", "smtp.gmail.com")}{t("port", "Port", "number")}
          {t("username", "Username")}{t("password", "App password (write-only)", "password", data?.smtp.hasPassword ? "•••••• saved, leave blank to keep" : "")}
          <Field label="Encryption"><select className={inputCls} value={smtp.encryption} onChange={(e) => setSmtp({ ...smtp, encryption: e.target.value })}><option value="ssl">SSL (port 465)</option><option value="tls">STARTTLS (port 587)</option></select></Field>
          {t("timeoutMs", "Timeout (ms)", "number")}{t("fromName", "Sender name")}{t("fromEmail", "Sender email", "email")}{t("replyTo", "Reply-to (optional)", "email")}
        </div>
        <div className="flex flex-wrap gap-2"><Btn disabled={busy} onClick={save}>Save</Btn><Btn variant="ghost" disabled={busy} onClick={() => test("verify")}>Test connection</Btn>
          <Btn variant="ghost" disabled={busy} onClick={() => test("test_email")}>Send test email</Btn></div>
        {msg && <div className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</div>}
      </Card>
      <WhatsAppCard />
    </div>
  );
}
