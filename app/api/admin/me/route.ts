import { NextResponse } from "next/server";
import { checkUser, REASON_TEXT } from "@/lib/auth/admin";
import { getSetting } from "@/lib/platform";
import { fail } from "@/lib/http";

export async function GET(req: Request) {
  const r = await checkUser(req);
  if (!("user" in r)) return fail(401, "UNAUTHORIZED", REASON_TEXT[r.reason]);
  const u = r.user;
  const [announcement, maintenance] = await Promise.all([getSetting<string>("announcement", ""), getSetting<boolean>("maintenance", false)]);
  return NextResponse.json({ success: true, id: u.id, email: u.email, name: u.name, role: u.role, status: u.status, features: u.features, limits: u.limits, announcement, maintenance });
}
