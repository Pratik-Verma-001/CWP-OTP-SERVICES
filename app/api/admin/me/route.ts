import { NextResponse } from "next/server";
import { checkAdmin, REASON_TEXT } from "@/lib/auth/admin";
import { fail } from "@/lib/http";

export async function GET(req: Request) {
  const r = await checkAdmin(req);
  if ("admin" in r) return NextResponse.json({ success: true, email: r.admin.email, role: r.admin.role });
  return fail(401, "UNAUTHORIZED", REASON_TEXT[r.reason]);
}
