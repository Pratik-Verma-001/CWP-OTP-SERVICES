import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", async () => {
  const { fake } = await import("./helpers/fakeDb");
  return { db: () => fake };
});
vi.mock("@/lib/providers", () => ({ deliver: vi.fn() }));

import { fake } from "./helpers/fakeDb";
import { deliver } from "@/lib/providers";
import { sendOtp, verifyOtp } from "@/lib/otp/engine";
import { authenticateApiKey, hashApiKey } from "@/lib/api-keys";
import { hashRecipient } from "@/lib/security/crypto";

const key = { keyId: "k1", projectId: "p1", projectName: "P", allowedOrigins: [] };
const send = (r = "user@example.com", ip = "1.1.1.1", k = key) => sendOtp(k, { channel: "email", recipient: r, ip });
const mockedDeliver = vi.mocked(deliver);
let lastCode = "";

beforeEach(() => {
  fake.reset();
  mockedDeliver.mockReset();
  mockedDeliver.mockImplementation(async (_c, _r, code) => { lastCode = code; return { ok: true, messageId: "m1" }; });
});

describe("send", () => {
  it("stores only a hash, never returns the code, never logs it in delivery logs", async () => {
    const out = await send();
    expect(out.ok).toBe(true);
    const row = fake.tables.otp_requests[0];
    expect(row.otp_hash).not.toContain(lastCode);
    expect(JSON.stringify(out)).not.toContain(lastCode);
    expect(JSON.stringify(fake.tables.delivery_logs)).not.toContain(lastCode);
    expect(row.masked_recipient).toBe("u***@example.com");
  });
  it("enforces the resend cooldown", async () => {
    await send();
    const second = await send();
    expect(second).toMatchObject({ ok: false, code: "RESEND_COOLDOWN", status: 429 });
  });
  it("enforces the per-recipient hourly limit", async () => {
    const h = hashRecipient("email", "user@example.com");
    const old = new Date(Date.now() - 600000).toISOString();
    fake.tables.otp_requests = Array.from({ length: 5 }, () => ({ recipient_hash: h, created_at: old, api_key_id: "k1", ip_hash: "x" }));
    expect(await send()).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });
  it("enforces the per-API-key limit", async () => {
    const old = new Date(Date.now() - 5000).toISOString();
    fake.tables.otp_requests = Array.from({ length: 60 }, (_, i) => ({ recipient_hash: "r" + i, created_at: old, api_key_id: "k1", ip_hash: "x" + i }));
    expect(await send("new@example.com")).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });
  it("enforces the per-IP limit", async () => {
    const { hashIp } = await import("@/lib/security/crypto");
    const old = new Date(Date.now() - 600000).toISOString();
    fake.tables.otp_requests = Array.from({ length: 20 }, (_, i) => ({ recipient_hash: "r" + i, created_at: old, api_key_id: "k" + i, ip_hash: hashIp("9.9.9.9") }));
    expect(await send("new@example.com", "9.9.9.9")).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });
  it("reports a missing provider honestly instead of faking success", async () => {
    mockedDeliver.mockResolvedValue({ ok: false, code: "PROVIDER_NOT_CONFIGURED", message: "Email provider is not configured." });
    const out = await send();
    expect(out).toMatchObject({ ok: false, status: 503, code: "PROVIDER_NOT_CONFIGURED" });
    expect(fake.tables.delivery_logs[0].status).toBe("failed");
    expect(fake.tables.otp_requests[0].status).toBe("failed");
  });
});

describe("verify", () => {
  const sendOk = async () => { const o = await send(); if (!o.ok) throw new Error("send failed"); return o.requestId; };

  it("accepts the correct code once, then rejects reuse", async () => {
    const id = await sendOk();
    expect(await verifyOtp(key, id, lastCode)).toBe(true);
    expect(fake.tables.otp_requests[0].consumed_at).not.toBeNull();
    expect(await verifyOtp(key, id, lastCode)).toBe(false);
  });
  it("rejects an incorrect code and counts the attempt", async () => {
    const id = await sendOk();
    const wrong = lastCode === "000000" ? "111111" : "000000";
    expect(await verifyOtp(key, id, wrong)).toBe(false);
    expect(fake.tables.otp_requests[0].attempts).toBe(1);
  });
  it("locks after too many wrong attempts, even for the right code", async () => {
    const id = await sendOk();
    const wrong = lastCode === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await verifyOtp(key, id, wrong);
    expect(fake.tables.otp_requests[0].status).toBe("locked");
    expect(await verifyOtp(key, id, lastCode)).toBe(false);
  });
  it("rejects an expired code", async () => {
    const id = await sendOk();
    fake.tables.otp_requests[0].expires_at = new Date(Date.now() - 1000).toISOString();
    expect(await verifyOtp(key, id, lastCode)).toBe(false);
    expect(fake.tables.otp_requests[0].status).toBe("expired");
  });
  it("rejects verification from another project's key", async () => {
    const id = await sendOk();
    expect(await verifyOtp({ ...key, projectId: "other" }, id, lastCode)).toBe(false);
  });
});

describe("API key validation", () => {
  const raw = "cwp_live_testkey123";
  const seed = (status: string, projectStatus = "active") => {
    fake.tables.api_keys = [{ id: "k1", status, project_id: "p1", key_hash: hashApiKey(raw), projects: { name: "P", status: projectStatus, allowed_origins: [] } }];
  };
  const req = (k?: string) => new Request("http://x", { headers: k ? { "x-api-key": k } : {} });

  it("accepts a valid key", async () => { seed("active"); expect(await authenticateApiKey(req(raw))).toMatchObject({ keyId: "k1", projectName: "P" }); });
  it("rejects revoked and disabled keys", async () => {
    seed("revoked"); expect(await authenticateApiKey(req(raw))).toBeNull();
    seed("disabled"); expect(await authenticateApiKey(req(raw))).toBeNull();
  });
  it("rejects missing, unknown and malformed keys", async () => {
    seed("active");
    expect(await authenticateApiKey(req())).toBeNull();
    expect(await authenticateApiKey(req("cwp_live_wrong"))).toBeNull();
    expect(await authenticateApiKey(req("not_a_key"))).toBeNull();
  });
  it("flags paused projects", async () => { seed("active", "paused"); expect(await authenticateApiKey(req(raw))).toBe("paused"); });
});
