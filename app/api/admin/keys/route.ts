import { NextResponse } from "next/server";
import { audit, requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/supabase/admin";
import { generateApiKey } from "@/lib/api-keys";
import { keyActionSchema, keyCreateSchema } from "@/lib/validation/schemas";
import { fail, internalError } from "@/lib/http";

async function ownsProject(adminId: string, projectId: string) {
  const { data } = await db().from("projects").select("id").eq("id", projectId).eq("owner_id", adminId).maybeSingle();
  return !!data;
}

async function createKey(projectId: string, name: string) {
  const k = generateApiKey();
  const { data, error } = await db().from("api_keys")
    .insert({ project_id: projectId, name, key_hash: k.hash, prefix: k.prefix }).select("id").single();
  if (error) throw error;
  return { id: data.id, rawKey: k.raw }; // raw key is shown exactly once
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = keyCreateSchema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Invalid request");
    if (!(await ownsProject(admin.id, p.data.projectId))) return fail(404, "NOT_FOUND", "Project not found");
    const key = await createKey(p.data.projectId, p.data.name);
    await audit(admin.id, "key.create", "api_key", key.id);
    return NextResponse.json({ success: true, ...key }, { status: 201 });
  } catch (e) { return internalError(e); }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = keyActionSchema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Invalid request");
    const { data: k } = await db().from("api_keys").select("id,name,status,project_id").eq("id", p.data.keyId).maybeSingle();
    if (!k || !(await ownsProject(admin.id, k.project_id))) return fail(404, "NOT_FOUND", "Key not found");
    if (k.status === "revoked") return fail(409, "KEY_REVOKED", "Revoked keys cannot be changed");

    const { action } = p.data;
    if (action === "rotate") {
      await db().from("api_keys").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", k.id);
      const fresh = await createKey(k.project_id, k.name);
      await audit(admin.id, "key.rotate", "api_key", k.id, { newKeyId: fresh.id });
      return NextResponse.json({ success: true, ...fresh });
    }
    const patch = action === "revoke" ? { status: "revoked", revoked_at: new Date().toISOString() }
      : { status: action === "disable" ? "disabled" : "active" };
    await db().from("api_keys").update(patch).eq("id", k.id);
    await audit(admin.id, `key.${action}`, "api_key", k.id);
    return NextResponse.json({ success: true });
  } catch (e) { return internalError(e); }
}
