import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", async () => {
  const { fake } = await import("./helpers/fakeDb");
  return { db: () => fake };
});

import { fake } from "./helpers/fakeDb";
import { adminConfigured, hashPassword, loginAllowed, makeSessionToken, parseSessionToken, requireAdmin, safeEq, sameOrigin, verifyPassword } from "@/lib/admin-auth";
import { hashIp } from "@/lib/security/crypto";

beforeEach(() => {
  fake.reset();
  process.env.ADMIN_USERNAME = "cwp-admin";
  process.env.ADMIN_SESSION_SECRET = "s".repeat(64);
  process.env.ADMIN_PASSWORD_HASH = hashPassword("correct horse battery");
});

describe("admin password", () => {
  it("verifies the right password and rejects wrong ones", () => {
    const h = hashPassword("correct horse battery");
    expect(h.startsWith("scrypt.")).toBe(true);
    expect(h).not.toContain("correct horse");
    expect(verifyPassword("correct horse battery", h)).toBe(true);
    expect(verifyPassword("wrong password", h)).toBe(false);
    expect(verifyPassword("x", "garbage")).toBe(false);
  });
  it("uses a random salt each time", () => expect(hashPassword("same password 1")).not.toBe(hashPassword("same password 1")));
  it("safeEq compares strings of different length safely", () => { expect(safeEq("a", "a")).toBe(true); expect(safeEq("a", "abc")).toBe(false); });
  it("reports whether admin login is configured", async () => {
    expect(await adminConfigured()).toBe(true);
    delete process.env.ADMIN_PASSWORD_HASH;
    expect(await adminConfigured()).toBe(false);
  });
});

describe("admin session cookie", () => {
  const reqWith = (token?: string, method = "GET", extra: Record<string, string> = {}) =>
    new Request("http://app.test/api/administration/overview", { method, headers: { ...(token ? { cookie: `cwp_admin=${token}` } : {}), host: "app.test", ...extra } });

  it("accepts a valid session", async () => {
    expect(await requireAdmin(reqWith(makeSessionToken("cwp-admin")))).toEqual({ username: "cwp-admin" });
  });
  it("rejects a missing, tampered or foreign-signed token", async () => {
    expect(await requireAdmin(reqWith())).toBeNull();
    const t = makeSessionToken("cwp-admin");
    expect(await requireAdmin(reqWith(t.slice(0, -3) + "abc"))).toBeNull();
    const [payload] = t.split(".");
    expect(await requireAdmin(reqWith(payload + ".AAAA"))).toBeNull();
  });
  it("rejects expired sessions", async () => {
    const old = makeSessionToken("cwp-admin", Date.now() - 9 * 3600_000);
    expect(await parseSessionToken(old)).toBeNull();
  });
  it("rejects a session for a different username", async () => {
    process.env.ADMIN_USERNAME = "someone-else";
    expect(await requireAdmin(reqWith(makeSessionToken("cwp-admin")))).toBeNull();
  });
  it("invalidates sessions older than a password change", async () => {
    const t = makeSessionToken("cwp-admin", Date.now() - 1000);
    fake.tables.platform_settings = [{ key: "admin_epoch", value: Date.now() }];
    expect(await parseSessionToken(t)).toBeNull();
  });
  it("blocks cross-site state-changing requests", async () => {
    expect(sameOrigin(reqWith(undefined, "POST", { origin: "https://evil.example" }))).toBe(false);
    expect(sameOrigin(reqWith(undefined, "POST", { origin: "http://app.test" }))).toBe(true);
    expect(await requireAdmin(reqWith(makeSessionToken("cwp-admin"), "POST", { origin: "https://evil.example" }))).toBeNull();
  });
});

describe("admin login brute-force protection", () => {
  it("locks an IP after 5 failures in 15 minutes", async () => {
    const now = new Date().toISOString();
    fake.tables.admin_login_attempts = Array.from({ length: 5 }, () => ({ ip_hash: hashIp("1.2.3.4"), ok: false, created_at: now }));
    expect(await loginAllowed("1.2.3.4")).toBe(false);
    expect(await loginAllowed("9.9.9.9")).toBe(true);
  });
});
