import { describe, expect, it } from "vitest";
import { decrypt, encrypt, hashRecipient, maskRecipient, safeEqualHex } from "@/lib/security/crypto";
import { generateCode, hashOtp } from "@/lib/otp/engine";
import { generateApiKey, hashApiKey } from "@/lib/api-keys";
import { sendSchema, verifySchema } from "@/lib/validation/schemas";
import { otpEmail } from "@/lib/smtp";

describe("OTP generation and hashing", () => {
  it("generates 6-digit numeric codes by default", () => {
    for (let i = 0; i < 500; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
  it("supports configurable length", () => expect(generateCode(8)).toMatch(/^\d{8}$/));
  it("hash is deterministic, bound to the request id, and never equals the code", () => {
    expect(hashOtp("r1", "123456")).toBe(hashOtp("r1", "123456"));
    expect(hashOtp("r1", "123456")).not.toBe(hashOtp("r2", "123456"));
    expect(hashOtp("r1", "123456")).not.toContain("123456");
  });
  it("safeEqualHex compares correctly", () => {
    expect(safeEqualHex("abcd", "abcd")).toBe(true);
    expect(safeEqualHex("abcd", "abce")).toBe(false);
    expect(safeEqualHex("abcd", "ab")).toBe(false);
  });
});

describe("API keys", () => {
  it("uses the cwp_live_ prefix and stores only a hash", () => {
    const k = generateApiKey();
    expect(k.raw.startsWith("cwp_live_")).toBe(true);
    expect(k.hash).toBe(hashApiKey(k.raw));
    expect(k.hash).not.toContain(k.raw);
    expect(generateApiKey().raw).not.toBe(k.raw);
  });
});

describe("encryption and masking", () => {
  it("round-trips credentials with AES-GCM and detects tampering", () => {
    const c = encrypt("app-password");
    expect(c).not.toContain("app-password");
    expect(decrypt(c)).toBe("app-password");
    expect(() => decrypt(c.slice(0, -2) + "AA")).toThrow();
  });
  it("masks recipients", () => {
    expect(maskRecipient("email", "user@example.com")).toBe("u***@example.com");
    expect(maskRecipient("whatsapp", "+919876543210")).toBe("+91******10");
    expect(hashRecipient("email", "A@x.com")).toBe(hashRecipient("email", "a@x.com"));
  });
});

describe("request validation (invalid recipients)", () => {
  it("rejects bad emails and non-E.164 phone numbers", () => {
    expect(sendSchema.safeParse({ channel: "email", recipient: "nope", project: "P" }).success).toBe(false);
    expect(sendSchema.safeParse({ channel: "whatsapp", recipient: "9876543210", project: "P" }).success).toBe(false);
    expect(sendSchema.safeParse({ channel: "sms", recipient: "+919876543210", project: "P" }).success).toBe(false);
    expect(sendSchema.safeParse({ channel: "email", recipient: "u@example.com", project: "P" }).success).toBe(true);
    expect(sendSchema.safeParse({ channel: "whatsapp", recipient: "+919876543210", project: "P" }).success).toBe(true);
  });
  it("rejects malformed verify requests", () => {
    expect(verifySchema.safeParse({ requestId: "x", code: "123456" }).success).toBe(false);
    expect(verifySchema.safeParse({ requestId: "7b0f4b0e-6f8e-4c5e-9d57-0d4f2a1b3c4d", code: "abc" }).success).toBe(false);
  });
});

describe("email template", () => {
  it("contains code, expiry, ignore notice, plain text, and no tracking pixel", () => {
    const m = otpEmail("123456", 5);
    expect(m.html).toContain("123456");
    expect(m.html).toContain("5 minutes");
    expect(m.html.toLowerCase()).toContain("ignore");
    expect(m.text).toContain("123456");
    expect(m.html).not.toMatch(/<img/i);
  });
});
