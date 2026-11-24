import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/supabase/admin";
import { fail, internalError } from "@/lib/http";

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" automatically.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected)))
    return fail(401, "UNAUTHORIZED", "Unauthorized");
  try {
    const { error } = await db().rpc("cleanup_expired_otps");
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) { return internalError(e); }
}
