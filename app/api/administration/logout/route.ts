import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/admin-auth";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.headers.append("Set-Cookie", sessionCookie("", 0));
  return res;
}
