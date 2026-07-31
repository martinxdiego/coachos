import "server-only";

import {
  createClient,
  type SupabaseClient
} from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

let adminClient: SupabaseClient<Database> | null = null;

/**
 * NextAuth is the application's identity layer, so Supabase's anon client has
 * no Supabase session and cannot safely enforce our team permissions. Storage
 * operations therefore run through this server-only client after the caller
 * has already passed a workspace/player authorization check.
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (adminClient) {
    return adminClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  adminClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return adminClient;
}
