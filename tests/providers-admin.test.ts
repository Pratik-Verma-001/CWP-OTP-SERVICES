import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();
const sendMail = vi.fn();
const verify = vi.fn();
vi.mock("@/lib/supabase/admin", async () => {
  const { fake } = await import("./helpers/fakeDb");
  return { db: () => fake };
});
vi.mock("@/lib/firebase/admin", () => ({ firebaseAuth: () => ({ verifyIdToken }) }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ verify, sendMail }) } }));

import { fake } from "./helpers/fakeDb";
import { checkAdmin } from "@/lib/auth/admin";
import { sendEmailOtp, verifySmtp, type SmtpConfig } from "@/lib/smtp";
import { sendWhatsAppOtp } from "@/lib/whatsapp";

const cfg: SmtpConfig = { host: "smtp.test", port: 465, username: "u", password: "p", encryption: "ssl", fromName: "N", fromEmail: "a@test.com", timeoutMs: 5000 };
const req = (t?: string) => new Request("http://x", { headers: t ? { authorization: `Bearer ${t}` } : {} });

beforeEach(() => {
  fake.reset(); verifyIdToken.mockReset(); sendMail.mockReset(); verify.mockReset();
  for (const k of Object.keys(process.env)) if (k.startsWith("SMTP_") || k.startsWith("WHATSAPP_")) delete process.env[k];
});

describe("SMTP failures", () => {
  it("maps authentication errors", async () => {
    verify.mockRejectedValue({ code: "EAUTH", message: "535 secret details" });
    const r = await verifySmtp(cfg);
    expect(r).toMatchObject({ ok: false, code: "SMTP_AUTH_FAILED" });
    expect(JSON.stringify(r)).not.toContain("secret details");
  });
  it("maps connection errors", async () => {
    verify.mockRejectedValue({ code: "ETIMEDOUT" });
    expect(await verifySmtp(cfg)).toMatchObject({ ok: false, code: "SMTP_CONNECTION_FAILED" });
  });
});

describe("provider configuration missing", () => {
  it("email returns PROVIDER_NOT_CONFIGURED and sends nothing", async () => {
    expect(await sendEmailOtp("u@example.com", "123456", 300)).toMatchObject({ ok: false, code: "PROVIDER_NOT_CONFIGURED" });
    expect(sendMail).not.toHaveBeenCalled();
  });
  it("WhatsApp returns the exact not-configured message", async () => {
    expect(await sendWhatsAppOtp("+919876543210", "123456")).toEqual({ ok: false, code: "PROVIDER_NOT_CONFIGURED", message: "WhatsApp provider is not configured." });
  });
});

describe("unauthorized admin access", () => {
  it("rejects missing token", async () => expect(await checkAdmin(req())).toEqual({ reason: "no_token" }));
  it("rejects invalid token", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad"));
    expect(await checkAdmin(req("t"))).toEqual({ reason: "token_invalid" });
  });
  it("rejects emails not on the allowlist", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u", email: "intruder@example.com", email_verified: true });
    expect(await checkAdmin(req("t"))).toEqual({ reason: "not_allowlisted" });
  });
  it("rejects unverified emails", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u", email: "admin@example.com", email_verified: false });
    expect(await checkAdmin(req("t"))).toEqual({ reason: "email_not_verified" });
  });
  it("accepts an allowlisted, verified admin", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u", email: "Admin@Example.com", email_verified: true });
    const r = await checkAdmin(req("t"));
    expect("admin" in r && r.admin.email).toBe("admin@example.com");
  });
});
