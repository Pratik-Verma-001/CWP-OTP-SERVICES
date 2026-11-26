import { NextResponse } from "next/server";
import { authWorker, cleanReport } from "@/lib/whatsapp/worker";
import { db } from "@/lib/supabase/admin";
import { fail } from "@/lib/http";

export const maxDuration = 15;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Adaptive polling keeps Vercel usage low: while idle the worker is told to wait a few seconds between polls;
// for 2 minutes after any job it is "hot" and the request is held open up to ~7s so jobs start almost instantly.
export async function POST(req: Request) {
  if (!(await authWorker(req))) return fail(401, "UNAUTHORIZED", "Unauthorized");
  const b = cleanReport(await req.json().catch(() => ({})));
  const now = () => new Date().toISOString();
  await db().from("wa_worker").update({ ...b, last_seen: now() }).eq("id", 1);

  const { data: last } = await db().from("wa_jobs").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const hot = !!last && Date.now() - new Date(last.created_at).getTime() < 120_000;
  const end = Date.now() + (hot ? 7000 : 0);
  for (;;) {
    const { data: next } = await db().from("wa_jobs").select("id,kind,payload").eq("status", "queued").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (next) {
      const { data: got } = await db().from("wa_jobs").update({ status: "running", picked_at: now() }).eq("id", next.id).eq("status", "queued").select("id");
      if (got?.length) return NextResponse.json({ job: next });
    }
    if (Date.now() >= end) break;
    await sleep(700);
  }
  return NextResponse.json({ job: null, nextMs: hot ? 0 : b.state === "connected" ? 4000 : 2500 });
}
