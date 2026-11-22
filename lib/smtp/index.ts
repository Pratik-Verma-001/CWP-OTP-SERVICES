import nodemailer from "nodemailer";
import { loadStored } from "@/lib/providers/config";
import { db } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/security/crypto";

export type SmtpConfig = {
  host: string; port: number; username: string; password: string;
  encryption: "ssl" | "tls"; fromName: string; fromEmail: string; replyTo?: string; timeoutMs: number;
};
export type Result = { ok: true; messageId?: string } | { ok: false; code: string; message: string };

// Google shows app passwords as "abcd efgh ijkl mnop"; the spaces are not part of the password.
export const cleanPw = (host: string, pw: string) => (/gmail|google/i.test(host) ? pw.replace(/\s+/g, "") : pw);

export function toSmtpConfig(c: Record<string, any>, pw: string): SmtpConfig | null {
  if (!c.host || !c.port || !c.username || !pw || !c.fromEmail) return null;
  return { host: c.host, port: Number(c.port), username: c.username, password: cleanPw(c.host, pw),
    encryption: c.encryption === "tls" ? "tls" : "ssl", fromName: c.fromName || "CWP OTP Services",
    fromEmail: c.fromEmail, replyTo: c.replyTo || undefined, timeoutMs: Number(c.timeoutMs) || 10000 };
}

// ---- per-project sender (each project/client can bring its own mailbox) ----
export async function loadProjectSmtp(projectId: string) {
  const { data } = await db().from("project_smtp").select("enabled,settings,encrypted_credentials").eq("project_id", projectId).maybeSingle();
  if (!data) return null;
  let password = "";
  try { password = JSON.parse(decrypt(data.encrypted_credentials)).password ?? ""; } catch { password = ""; }
  return { enabled: !!data.enabled, settings: (data.settings ?? {}) as Record<string, any>, password };
}
export async function saveProjectSmtp(projectId: string, enabled: boolean, settings: object, newPassword?: string) {
  const cur = await loadProjectSmtp(projectId);
  const password = newPassword || cur?.password || "";
  const { error } = await db().from("project_smtp").upsert(
    { project_id: projectId, enabled, settings, encrypted_credentials: encrypt(JSON.stringify({ password })), updated_at: new Date().toISOString() },
    { onConflict: "project_id" });
  if (error) throw error;
}

// A project's own enabled sender wins; otherwise the platform default is used.
export async function getSmtpConfig(projectId?: string): Promise<SmtpConfig | null> {
  if (projectId) {
    const p = await loadProjectSmtp(projectId);
    if (p?.enabled) return toSmtpConfig(p.settings, p.password); // enabled but incomplete -> not configured (no silent fallback)
  }
  const s = await loadStored("smtp");
  if (s) return s.enabled ? toSmtpConfig(s.settings, s.secrets.password ?? "") : null;
  const e = process.env;
  if (!e.SMTP_HOST || !e.SMTP_PORT || !e.SMTP_USERNAME || !e.SMTP_PASSWORD || !e.SMTP_FROM_EMAIL) return null;
  return toSmtpConfig({ host: e.SMTP_HOST, port: e.SMTP_PORT, username: e.SMTP_USERNAME, encryption: Number(e.SMTP_PORT) === 465 ? "ssl" : "tls",
    fromName: e.SMTP_FROM_NAME, fromEmail: e.SMTP_FROM_EMAIL }, e.SMTP_PASSWORD);
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

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export function otpEmail(code: string, ttlMinutes: number, brand = "CWP OTP Services") {
  const b = esc(brand);
  const text = `Your ${brand} verification code is ${code}.\n\nIt expires in ${ttlMinutes} minutes and can be used once.\n\nIf you did not request this code, you can safely ignore this email. Never share this code with anyone.`;
  const html = `<!doctype html><html><body style="margin:0;background:#0b1224;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:480px;background:#111a33;border-radius:14px;padding:32px">
<tr><td style="color:#8b9cff;font-size:14px;font-weight:bold;letter-spacing:1px">${b}</td></tr>
<tr><td style="color:#e8ecff;font-size:18px;padding:16px 0 8px">Your verification code</td></tr>
<tr><td style="padding:8px 0 16px"><div style="background:#1b2750;border-radius:10px;padding:18px;text-align:center;font-size:34px;letter-spacing:8px;font-weight:bold;color:#ffffff">${code}</div></td></tr>
<tr><td style="color:#b5bfe0;font-size:14px;line-height:1.6">This code expires in <b>${ttlMinutes} minutes</b> and can be used only once.</td></tr>
<tr><td style="color:#8791b8;font-size:12px;line-height:1.6;padding-top:20px;border-top:1px solid #243158">If you did not request this code, ignore this email. Never share this code with anyone; we will never ask for it.</td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}

export async function sendEmailOtp(to: string, code: string, ttlSeconds: number, projectId?: string): Promise<Result> {
  const c = await getSmtpConfig(projectId);
  if (!c) return { ok: false, code: "PROVIDER_NOT_CONFIGURED", message: "Email provider is not configured." };
  const m = otpEmail(code, Math.round(ttlSeconds / 60), c.fromName);
  return send(c, to, `Your ${c.fromName} verification code`, m.text, m.html);
}

export async function sendTestEmail(c: SmtpConfig, to: string): Promise<Result> {
  const t = `This is a test email from ${c.fromName}. Your SMTP settings work.`;
  return send(c, to, `${c.fromName} test email`, t, `<p>${esc(t)}</p>`);
}
