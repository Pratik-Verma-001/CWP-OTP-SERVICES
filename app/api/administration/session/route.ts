import { NextResponse } from "next/server";
import { adminConfigured, requireAdmin } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const [admin, configured] = await Promise.all([requireAdmin(req), adminConfigured()]);
  return NextResponse.json({ success: true, configured, authenticated: !!admin, username: admin?.username ?? null });
}
