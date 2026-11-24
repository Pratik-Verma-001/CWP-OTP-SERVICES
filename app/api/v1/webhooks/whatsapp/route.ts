import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/admin";

// Meta subscription handshake.
export function GET(req: Request) {
  const u = new URL(req.url);
  const ok = u.searchParams.get("hub.mode") === "subscribe" &&
    !!process.env.WHATSAPP_VERIFY_TOKEN && u.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN;
  return ok ? new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("Forbidden", { status: 403 });
}

const MAP: Record<string, "sent" | "delivered" | "failed"> = { sent: "sent", delivered: "delivered", read: "delivered", failed: "failed" };

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.WHATSAPP_APP_SECRET;
  const sig = req.headers.get("x-hub-signature-256")?.replace("sha256=", "");
  if (!secret || !sig) return new Response("Forbidden", { status: 403 });
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(sig, "hex"), b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response("Forbidden", { status: 403 });

  try {
    const body = JSON.parse(raw);
    for (const entry of body.entry ?? []) for (const ch of entry.changes ?? []) for (const s of ch.value?.statuses ?? []) {
      const status = MAP[s.status];
      if (!status || !s.id) continue;
      await db().from("delivery_logs").update({
        status, error_code: s.errors?.[0]?.code ? String(s.errors[0].code) : null,
        error_message: s.errors?.[0] ? "WhatsApp reported a delivery failure" : null,
      }).eq("provider_message_id", s.id);
    }
  } catch { /* always ack so Meta doesn't retry-storm */ }
  return NextResponse.json({ ok: true });
}
