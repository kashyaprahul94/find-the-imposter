import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local.",
  );
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
  realtime: {
    // ~10 players, a handful of events per round. Keep it low so a burst of
    // reconnects after everyone unlocks their phones doesn't get throttled.
    params: { eventsPerSecond: 20 },
  },
});
