import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let client: SupabaseClient | null = null;
// Server-only: uses the service-role key. Never import from client components.
export function db(): SupabaseClient {
  return (client ??= createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
}
