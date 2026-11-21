import nodemailer from "nodemailer";
import { loadStored } from "@/lib/providers/config";

export type SmtpConfig = {
  host: string; port: number; username: string; password: string;
  encryption: "ssl" | "tls"; fromName: string; fromEmail: string; replyTo?: string; timeoutMs: number;
};
export type Result = { ok: true; messageId?: string } | { ok: false; code: string; message: string };

// Database settings (encrypted) win; env vars are the fallback for first-time setup.
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const s = await loadStored("smtp");
  if (s) {
    if (!s.enabled) return null;
    const c = s.settings, pw = s.secrets.password;
    if (!c.host || !c.port || !c.username || !pw || !c.fromEmail) return null;
    return { host: c.host, port: Number(c.port), username: c.username, password: pw,
      encryption: c.encryption === "tls" ? "tls" : "ssl", fromName: c.fromName || "CWP OTP API",
      fromEmail: c.fromEmail, replyTo: c.replyTo || undefined, timeoutMs: Number(c.timeoutMs) || 10000 };
  }
  const e = process.env;
  if (!e.SMTP_HOST || !e.SMTP_PORT || !e.SMTP_USERNAME || !e.SMTP_PASSWORD || !e.SMTP_FROM_EMAIL) return null;
  return { host: e.SMTP_HOST, port: Number(e.SMTP_PORT), username: e.SMTP_USERNAME, password: e.SMTP_PASSWORD,
    encryption: Number(e.SMTP_PORT) === 465 ? "ssl" : "tls", fromName: e.SMTP_FROM_NAME || "CWP OTP API",
    fromEmail: e.SMTP_FROM_EMAIL, timeoutMs: 10000 };
}

function transport(c: SmtpConfig) {
  return nodemailer.createTransport({
    host: c.host, port: c.port, secure: c.encryption === "ssl", requireTLS: c.encryption === "tls",
    auth: { user: c.username, pass: c.password },
    connectionTimeout: c.timeoutMs, greetingTimeout: c.timeoutMs, socketTimeout: c.timeoutMs,
    tls: { minVersion: "TLSv1.2" },
  });
}

// Map errors to safe codes; raw SMTP responses can echo account details.
function mapError(e: any): { code: string; message: string } {
  if (e?.code === "EAUTH") return { code: "SMTP_AUTH_FAILED", message: "SMTP authentication failed. Check username and app password." };
  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNREFUSED", "ENOTFOUND", "EDNS"].includes(e?.code))
    return { code: "SMTP_CONNECTION_FAILED", message: "Could not connect to the SMTP server. Check host, port and encryption." };
  if (e?.code === "EENVELOPE") return { code: "SMTP_REJECTED", message: "The server rejected the sender or recipient address." };
  return { code: "SMTP_SEND_FAILED", message: "Email delivery failed." };
}

export async function verifySmtp(c: SmtpConfig): Promise<Result> {
  try { await transport(c).verify(); return { ok: true }; } catch (e) { return { ok: false, ...mapError(e) }; }
}

async function send(c: SmtpConfig, to: string, subject: string, text: string, html: string): Promise<Result> {
  try {
    const info = await transport(c).sendMail({
      from: { name: c.fromName, address: c.fromEmail }, to, subject, text, html, replyTo: c.replyTo,
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) { return { ok: false, ...mapError(e) }; }
}

export function otpEmail(code: string, ttlMinutes: number) {
  const text = `Your CWP OTP API verification code is ${code}.\n\nIt expires in ${ttlMinutes} minutes and can be used once.\n\nIf you did not request this code, you can safely ignore this email. Never share this code with anyone.`;
  const html = `<!doctype html><html><body style="margin:0;background:#0b1224;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:480px;background:#111a33;border-radius:14px;padding:32px">
<tr><td style="color:#8b9cff;font-size:14px;font-weight:bold;letter-spacing:1px">CWP OTP API</td></tr>
<tr><td style="color:#e8ecff;font-size:18px;padding:16px 0 8px">Your verification code</td></tr>
<tr><td style="padding:8px 0 16px"><div style="background:#1b2750;border-radius:10px;padding:18px;text-align:center;font-size:34px;letter-spacing:8px;font-weight:bold;color:#ffffff">${code}</div></td></tr>
<tr><td style="color:#b5bfe0;font-size:14px;line-height:1.6">This code expires in <b>${ttlMinutes} minutes</b> and can be used only once.</td></tr>
<tr><td style="color:#8791b8;font-size:12px;line-height:1.6;padding-top:20px;border-top:1px solid #243158">If you did not request this code, ignore this email. Never share this code with anyone; we will never ask for it.</td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}

export async function sendEmailOtp(to: string, code: string, ttlSeconds: number): Promise<Result> {
  const c = await getSmtpConfig();
  if (!c) return { ok: false, code: "PROVIDER_NOT_CONFIGURED", message: "Email provider is not configured." };
  const m = otpEmail(code, Math.round(ttlSeconds / 60));
  return send(c, to, "Your CWP OTP API verification code", m.text, m.html);
}

export async function sendTestEmail(c: SmtpConfig, to: string): Promise<Result> {
  const t = "This is a test email from CWP OTP API. Your SMTP settings work.";
  return send(c, to, "CWP OTP API test email", t, `<p>${t}</p>`);
}
