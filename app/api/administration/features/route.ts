import { NextResponse } from "next/server";
import { z } from "zod";
import { auditAdmin, requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/supabase/admin";
import { clearPlatformCache, loadFeatures } from "@/lib/platform";
import { fail, internalError } from "@/lib/http";

const key = z.string().regex(/^[a-z][a-z0-9_]{1,40}$/);
const createSchema = z.object({ key, name: z.string().min(1).max(60), description: z.string().max(200).default(""), default_enabled: z.boolean().default(true) });
const patchSchema = z.object({ key, name: z.string().min(1).max(60).optional(), description: z.string().max(200).optional(), enabled: z.boolean().optional(), default_enabled: z.boolean().optional() });

export async function GET(req: Request) {
  try {
    if (!(await requireAdmin(req))) return fail(401, "UNAUTHORIZED", "Unauthorized");
    return NextResponse.json({ success: true, features: await loadFeatures() });
  } catch (e) { return internalError(e); }
}
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = createSchema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Key: lowercase letters, numbers and underscores (starts with a letter).");
    const { error } = await db().from("features").insert({ ...p.data, builtin: false });
    if (error?.code === "23505") return fail(409, "DUPLICATE", "A feature with this key already exists.");
    if (error) throw error;
    clearPlatformCache();
    await auditAdmin("feature.create", "feature", p.data.key);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) { return internalError(e); }
}
export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = patchSchema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Invalid values");
    const { key: k, ...rest } = p.data;
    const { data, error } = await db().from("features").update(rest).eq("key", k).select("key");
    if (error) throw error;
    if (!data?.length) return fail(404, "NOT_FOUND", "Feature not found");
    clearPlatformCache();
    await auditAdmin("feature.update", "feature", k, rest);
    return NextResponse.json({ success: true });
  } catch (e) { return internalError(e); }
}
export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const k = new URL(req.url).searchParams.get("key") ?? "";
    if (!key.safeParse(k).success) return fail(400, "INVALID_REQUEST", "Invalid key");
    const { data } = await db().from("features").delete().eq("key", k).eq("builtin", false).select("key");
    if (!data?.length) return fail(400, "INVALID_REQUEST", "Built-in features cannot be deleted. Disable them instead.");
    clearPlatformCache();
    await auditAdmin("feature.delete", "feature", k);
    return NextResponse.json({ success: true });
  } catch (e) { return internalError(e); }
}
