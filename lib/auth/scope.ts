import { db } from "@/lib/supabase/admin";
export async function ownedProjects(adminId: string) {
  const { data } = await db().from("projects").select("id,name").eq("owner_id", adminId);
  return data ?? [];
}
