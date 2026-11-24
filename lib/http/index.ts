import { NextResponse } from "next/server";

export const fail = (status: number, code: string, message: string, extra: object = {}) =>
  NextResponse.json({ success: false, error: { code, message }, ...extra }, { status });

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";

// Never leak stack traces or internals.
export function internalError(e: unknown) {
  console.error("internal_error", e instanceof Error ? e.message : "unknown");
  return fail(500, "INTERNAL_ERROR", "Something went wrong");
}
