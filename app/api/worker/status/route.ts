import { NextResponse } from "next/server";
import { authWorker, cleanReport } from "@/lib/whatsapp/worker";
import { db } from "@/lib/supabase/admin";
import { fail } from "@/lib/http";

// The worker reports instantly when its state changes (new QR, linked, error).
export async function POST(req: Request) {
  if (!(await authWorker(req))) return fail(401, "UNAUTHORIZED", "Unauthorized");
  const body = await req.json().catch(() => ({}));
  const b = cleanReport(body);
  const now = new Date().toISOString();
  await db().from("wa_worker").update({ ...b, last_seen: now, updated_at: now, ...(b.qr && body?.qrNew ? { qr_at: now } : {}), ...(b.qr ? {} : { qr_at: null }) }).eq("id", 1);
  return NextResponse.json({ ok: true });
}
