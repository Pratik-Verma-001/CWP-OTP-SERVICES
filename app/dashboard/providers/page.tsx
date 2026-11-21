"use client";
import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/client/api";
import { Btn, Card, ErrorBox, Field, inputCls, Loading } from "@/components/ui";

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  return m ? <div className={`text-sm ${m.ok ? "text-emerald-300" : "text-red-300"}`}>{m.text}</div> : null;
}

export default function Providers() {
  const { data, error, loading, reload } = useApi<any>("/api/admin/providers");
  const [smtp, setSmtp] = useState<any>({ enabled: false, host: "", port: "465", username: "", password: "", encryption: "ssl", fromName: "CWP OTP API", fromEmail: "", replyTo: "", timeoutMs: "10000" });
  const [wa, setWa] = useState<any>({ enabled: false, phoneNumberId: "", businessAccountId: "", accessToken: "", apiVersion: "v21.0", templateName: "", templateLanguage: "en_US" });
  const [m1, setM1] = useState<any>(null), [m2, setM2] = useState<any>(null), [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setSmtp((x: any) => ({ ...x, ...data.smtp.settings, port: String(data.smtp.settings.port ?? x.port), timeoutMs: String(data.smtp.settings.timeoutMs ?? x.timeoutMs), enabled: data.smtp.enabled, password: "" }));
    setWa((x: any) => ({ ...x, ...data.whatsapp.settings, enabled: data.whatsapp.enabled, accessToken: "" }));
  }, [data]);

  const run = async (set: (m: any) => void, fn: () => Promise<any>, okText: string) => {
    setBusy(true); set(null);
    try { await fn(); set({ ok: true, text: okText }); await reload(); } catch (e: any) { set({ ok: false, text: e.message }); }
    setBusy(false);
  };
  const saveSmtp = () => run(setM1, () => api("/api/admin/providers", { method: "PUT", body: JSON.stringify({
    provider: "smtp", enabled: smtp.enabled, secrets: { password: smtp.password || undefined },
    settings: { host: smtp.host, port: Number(smtp.port), username: smtp.username, encryption: smtp.encryption, fromName: smtp.fromName, fromEmail: smtp.fromEmail, replyTo: smtp.replyTo || "", timeoutMs: Number(smtp.timeoutMs) } }) }), "Saved");
  const saveWa = () => run(setM2, () => api("/api/admin/providers", { method: "PUT", body: JSON.stringify({
    provider: "whatsapp", enabled: wa.enabled, secrets: { accessToken: wa.accessToken || undefined },
    settings: { phoneNumberId: wa.phoneNumberId, businessAccountId: wa.businessAccountId || "", apiVersion: wa.apiVersion, templateName: wa.templateName, templateLanguage: wa.templateLanguage } }) }), "Saved");
  const test = (provider: string, action: string) => (provider === "smtp" ? setM1 : setM2) &&
    run(provider === "smtp" ? setM1 : setM2, () => api("/api/admin/providers", { method: "POST", body: JSON.stringify({ provider, action }) }),
      action === "test_email" ? "Test email sent to your admin address" : "Connection OK");

  const t = (o: any, set: any, k: string, label: string, type = "text", ph = "") =>
    <Field label={label}><input className={inputCls} type={type} placeholder={ph} value={o[k]} onChange={(e) => set({ ...o, [k]: e.target.value })} /></Field>;
  if (loading && !data) return <Loading />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Providers</h1><ErrorBox text={error} />
      <Card className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-medium">SMTP Email</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={smtp.enabled} onChange={(e) => setSmtp({ ...smtp, enabled: e.target.checked })} />Enabled</label></div>
        <div className="grid gap-3 md:grid-cols-2">
          {t(smtp, setSmtp, "host", "SMTP host", "text", "smtp.gmail.com")}{t(smtp, setSmtp, "port", "Port", "number")}
          {t(smtp, setSmtp, "username", "Username")}{t(smtp, setSmtp, "password", "App password (write-only)", "password", data?.smtp.hasPassword ? "•••••• saved, leave blank to keep" : "")}
          <Field label="Encryption"><select className={inputCls} value={smtp.encryption} onChange={(e) => setSmtp({ ...smtp, encryption: e.target.value })}><option value="ssl">SSL (port 465)</option><option value="tls">STARTTLS (port 587)</option></select></Field>
          {t(smtp, setSmtp, "timeoutMs", "Timeout (ms)", "number")}{t(smtp, setSmtp, "fromName", "Sender name")}{t(smtp, setSmtp, "fromEmail", "Sender email", "email")}{t(smtp, setSmtp, "replyTo", "Reply-to (optional)", "email")}
        </div>
        <div className="flex flex-wrap gap-2"><Btn disabled={busy} onClick={saveSmtp}>Save</Btn><Btn variant="ghost" disabled={busy} onClick={() => test("smtp", "verify")}>Test connection</Btn>
          <Btn variant="ghost" disabled={busy} onClick={() => test("smtp", "test_email")}>Send test email</Btn></div><Msg m={m1} /></Card>

      <Card className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-medium">WhatsApp Cloud API</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wa.enabled} onChange={(e) => setWa({ ...wa, enabled: e.target.checked })} />Enabled</label></div>
        <div className="text-sm text-slate-400">Status: {data?.whatsapp.configured ? "configured" : "WhatsApp provider is not configured."}</div>
        <div className="grid gap-3 md:grid-cols-2">
          {t(wa, setWa, "phoneNumberId", "Phone number ID")}{t(wa, setWa, "businessAccountId", "Business account ID (optional)")}
          {t(wa, setWa, "accessToken", "Access token (write-only)", "password", data?.whatsapp.hasAccessToken ? "•••••• saved, leave blank to keep" : "")}{t(wa, setWa, "apiVersion", "API version")}
          {t(wa, setWa, "templateName", "Authentication template name")}{t(wa, setWa, "templateLanguage", "Template language", "text", "en_US")}
        </div>
        <div className="flex flex-wrap gap-2"><Btn disabled={busy} onClick={saveWa}>Save</Btn><Btn variant="ghost" disabled={busy} onClick={() => test("whatsapp", "verify")}>Test configuration</Btn></div><Msg m={m2} /></Card>
    </div>
  );
}
