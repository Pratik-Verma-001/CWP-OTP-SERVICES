import { NextResponse } from "next/server";
import { audit, requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/supabase/admin";
import { projectSchema } from "@/lib/validation/schemas";
import { fail, internalError } from "@/lib/http";

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const { data, error } = await db().from("projects")
      .select("id,name,website_url,description,allowed_origins,status,created_at,api_keys(id,name,prefix,status,last_used_at,created_at)")
      .eq("owner_id", admin.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ success: true, projects: data });
  } catch (e) { return internalError(e); }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const p = projectSchema.safeParse(await req.json().catch(() => null));
    if (!p.success) return fail(400, "INVALID_REQUEST", "Invalid project data");
    const { data, error } = await db().from("projects").insert({
      owner_id: admin.id, name: p.data.name, website_url: p.data.websiteUrl,
      description: p.data.description, allowed_origins: p.data.allowedOrigins,
    }).select("id,name,status").single();
    if (error?.code === "23505") return fail(409, "DUPLICATE", "Project name already exists");
    if (error) throw error;
    await audit(admin.id, "project.create", "project", data.id);
    return NextResponse.json({ success: true, project: data }, { status: 201 });
  } catch (e) { return internalError(e); }
}

const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const b = await req.json().catch(() => null);
    if (!isUuid(b?.id) || !["active", "paused"].includes(b?.status)) return fail(400, "INVALID_REQUEST", "Invalid request");
    const { data } = await db().from("projects").update({ status: b.status, updated_at: new Date().toISOString() })
      .eq("id", b.id).eq("owner_id", admin.id).select("id");
    if (!data?.length) return fail(404, "NOT_FOUND", "Project not found");
    await audit(admin.id, `project.${b.status}`, "project", b.id);
    return NextResponse.json({ success: true });
  } catch (e) { return internalError(e); }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "UNAUTHORIZED", "Unauthorized");
    const id = new URL(req.url).searchParams.get("id");
    if (!isUuid(id)) return fail(400, "INVALID_REQUEST", "Invalid request");
    const { data } = await db().from("projects").delete().eq("id", id).eq("owner_id", admin.id).select("id");
    if (!data?.length) return fail(404, "NOT_FOUND", "Project not found");
    await audit(admin.id, "project.delete", "project", id);
    return NextResponse.json({ success: true });
  } catch (e) { return internalError(e); }
}
