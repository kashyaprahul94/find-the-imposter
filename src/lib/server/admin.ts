import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS, so this module must never be
 * imported from a client component — the `server-only` import above turns that
 * into a build error rather than a leaked key.
 *
 * Constructed lazily: Next evaluates route modules while collecting page data
 * at build time, and a missing secret should fail the request that needs it,
 * not the build.
 */
let client: SupabaseClient | null = null;

export function admin(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. See .env.example.",
    );
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
