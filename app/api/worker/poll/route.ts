import { NextResponse } from "next/server";
import { authWorker, cleanReport } from "@/lib/whatsapp/worker";
import { db } from "@/lib/supabase/admin";
import { fail } from "@/lib/http";

export const maxDuration = 15;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Long-poll: holds the request up to ~8s waiting for a job, then returns {job:null}; the worker immediately polls again.
export async function POST(req: Request) {
  if (!(await authWorker(req))) return fail(401, "UNAUTHORIZED", "Unauthorized");
  const b = cleanReport(await req.json().catch(() => ({})));
  const beat = () => db().from("wa_worker").update({ ...b, last_seen: new Date().toISOString() }).eq("id", 1);
  await beat();
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    const { data: next } = await db().from("wa_jobs").select("id,kind,payload").eq("status", "queued").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (next) {
      const { data: got } = await db().from("wa_jobs").update({ status: "running", picked_at: new Date().toISOString() }).eq("id", next.id).eq("status", "queued").select("id");
      if (got?.length) return NextResponse.json({ job: next });
    }
    await sleep(800);
  }
  await beat();
  return NextResponse.json({ job: null });
}
