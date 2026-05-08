import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleEnv } from "@/lib/env";
import type { Database } from "@/lib/types";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  if (adminClient) {
    return adminClient;
  }
  const { url, serviceRoleKey } = getSupabaseServiceRoleEnv();
  adminClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  return adminClient;
}
