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
import { checkUser } from "@/lib/auth/admin";
import { ownerPolicy } from "@/lib/policy";
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

const decoded = (o: object = {}) => ({ uid: "u", email: "someone@example.com", email_verified: true, ...o });
const user = (o: object = {}) => ({ id: "u1", firebase_uid: "u", email: "someone@example.com", role: "user", status: "active", display_name: null, features: {}, limits: {}, ...o });

describe("access control (users and admins)", () => {
  it("rejects a missing token", async () => expect(await checkUser(req())).toEqual({ reason: "no_token" }));
  it("rejects an invalid token", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad"));
    expect(await checkUser(req("t"))).toEqual({ reason: "token_invalid" });
  });
  it("rejects unverified emails", async () => {
    verifyIdToken.mockResolvedValue(decoded({ email_verified: false }));
    expect(await checkUser(req("t"))).toEqual({ reason: "email_not_verified" });
  });
  it("makes ADMIN_ALLOWLIST emails active owners", async () => {
    verifyIdToken.mockResolvedValue(decoded({ email: "Admin@Example.com" }));
    const r = await checkUser(req("t"));
    expect("user" in r && r.user.role).toBe("owner");
    expect("user" in r && r.user.status).toBe("active");
  });
  it("puts new sign-ups on 'pending' by default", async () => {
    verifyIdToken.mockResolvedValue(decoded());
    expect(await checkUser(req("t"))).toEqual({ reason: "pending" });
  });
  it("activates new sign-ups when registration is open", async () => {
    fake.tables.platform_settings = [{ key: "registration", value: "open" }];
    verifyIdToken.mockResolvedValue(decoded());
    const r = await checkUser(req("t"));
    expect("user" in r && r.user.role).toBe("user");
  });
  it("blocks new sign-ups when registration is closed", async () => {
    fake.tables.platform_settings = [{ key: "registration", value: "closed" }];
    verifyIdToken.mockResolvedValue(decoded());
    expect(await checkUser(req("t"))).toEqual({ reason: "registration_closed" });
  });
  it("blocks suspended users", async () => {
    fake.tables.admin_profiles = [user({ status: "suspended" })];
    verifyIdToken.mockResolvedValue(decoded());
    expect(await checkUser(req("t"))).toEqual({ reason: "suspended" });
  });
  it("applies per-user feature overrides but not to platform admins", async () => {
    fake.tables.features = [{ key: "email_otp", enabled: true, default_enabled: true, builtin: true }];
    fake.tables.admin_profiles = [user({ features: { email_otp: false } })];
    verifyIdToken.mockResolvedValue(decoded());
    const r = await checkUser(req("t"));
    expect("user" in r && r.user.features.email_otp).toBe(false);
    fake.tables.admin_profiles = [user({ role: "admin", features: { email_otp: false } })];
    const a = await checkUser(req("t"));
    expect("user" in a && a.user.features.email_otp).toBe(true);
  });
});

describe("per-account policy when sending", () => {
  const today = () => new Date().toISOString();
  it("blocks suspended accounts", async () => {
    fake.tables.admin_profiles = [user({ status: "suspended" })];
    expect(await ownerPolicy("u1", "email")).toMatchObject({ code: "ACCOUNT_SUSPENDED" });
  });
  it("blocks a disabled feature", async () => {
    fake.tables.features = [{ key: "whatsapp_otp", enabled: true, default_enabled: true, builtin: true }];
    fake.tables.admin_profiles = [user({ features: { whatsapp_otp: false } })];
    expect(await ownerPolicy("u1", "whatsapp")).toMatchObject({ code: "FEATURE_DISABLED" });
    expect(await ownerPolicy("u1", "email")).toBeNull();
  });
  it("enforces the daily OTP limit", async () => {
    fake.tables.admin_profiles = [user({ limits: { dailyOtpLimit: 3 } })];
    fake.tables.projects = [{ id: "p1", owner_id: "u1" }];
    fake.tables.otp_requests = [1, 2, 3].map(() => ({ project_id: "p1", created_at: today() }));
    expect(await ownerPolicy("u1", "email")).toMatchObject({ code: "DAILY_LIMIT", status: 429 });
  });
});
