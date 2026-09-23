import { supabase } from "@/lib/supabase";

/**
 * A read-only ping that keeps the Supabase project from being paused.
 *
 * Free-tier projects pause after a stretch with no database activity, so a
 * daily Vercel cron (vercel.json) hits this. It runs one real query against
 * Postgres — a static page would not touch the database and would not count —
 * but reads a single id and throws it away. Nothing is written, and nothing
 * about any room is returned.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  const { error } = await supabase.from("rooms").select("id").limit(1);

  const headers = { "Cache-Control": "no-store" };

  if (error) {
    console.error("health check failed", error);
    return Response.json({ ok: false }, { status: 503, headers });
  }

  return Response.json(
    { ok: true, db_ms: Date.now() - started },
    { status: 200, headers },
  );
}
