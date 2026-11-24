import { NextResponse } from "next/server";
import { authWorker, cleanReport } from "@/lib/whatsapp/worker";
import { db } from "@/lib/supabase/admin";
import { fail } from "@/lib/http";

export async function POST(req: Request) {
  if (!(await authWorker(req))) return fail(401, "UNAUTHORIZED", "Unauthorized");
  const b = cleanReport(await req.json().catch(() => ({})));
  await db().from("wa_worker").update({ ...b, last_seen: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", 1);
  return NextResponse.json({ ok: true });
}
