import { NextResponse } from "next/server";
import { z } from "zod";
import { authWorker } from "@/lib/whatsapp/worker";
import { db } from "@/lib/supabase/admin";
import { fail } from "@/lib/http";

const schema = z.object({
  id: z.string().uuid(), ok: z.boolean(),
  result: z.object({ messageId: z.string().max(100).optional(), error: z.string().max(40).optional(), code: z.string().max(20).optional(), state: z.string().max(20).optional() }).default({}),
});

export async function POST(req: Request) {
  if (!(await authWorker(req))) return fail(401, "UNAUTHORIZED", "Unauthorized");
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(400, "INVALID_REQUEST", "Invalid result");
  await db().from("wa_jobs").update({ status: p.data.ok ? "done" : "failed", result: p.data.result, payload: null, finished_at: new Date().toISOString() }).eq("id", p.data.id);
  return NextResponse.json({ ok: true });
}
