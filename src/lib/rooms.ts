import { supabase } from "./supabase";
import { generateRoomCode } from "./roomCode";
import type { ConcludedRound, Round } from "./types";

const CREATE_ATTEMPTS = 5;

/**
 * Direct-to-Postgres from the browser, governed by the RLS policies in
 * supabase/schema.sql. Nothing here is on the critical path of a round —
 * rounds are dealt over broadcast — so a failure costs a history row at worst.
 */

export type RoomRecord = { code: string; creatorKey: string };

/** The creator's key is written with the room, so "who opened this" survives a
 * refresh and is the same on every device. */
export async function createRoom(creatorKey: string): Promise<string> {
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const { error } = await supabase
      .from("rooms")
      .insert({ code, creator_key: creatorKey });

    if (!error) return code;
    // 23505 = unique_violation, i.e. a code collision. Anything else is real.
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Could not allocate a room code. Try again.");
}

export async function fetchRoom(code: string): Promise<RoomRecord | null> {
  const { data, error } = await supabase
    .from("rooms")
    .select("code, creator_key")
    .eq("code", code)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return { code: data.code as string, creatorKey: data.creator_key as string };
}

async function roomId(code: string): Promise<number | null> {
  const { data } = await supabase
    .from("rooms")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  return (data?.id as number | undefined) ?? null;
}

/**
 * Records a concluded round. Called by whoever pressed Reveal — the unique
 * (room_id, round_key) makes a double-press, or a dealer/fallback race, a
 * no-op rather than a duplicate row.
 */
export async function recordConcludedRound(code: string, round: Round): Promise<void> {
  const id = await roomId(code);
  if (id === null) return;

  const { error } = await supabase.from("rounds").insert({
    room_id: id,
    round_key: round.roundId,
    others_word: round.othersWord,
    imposter_word: round.imposterWord,
    imposter_keys: round.imposterKeys,
    imposter_names: round.imposterNames,
    dealer_name: round.dealerName,
    started_at: round.startedAt,
  });

  if (error && error.code !== "23505") throw new Error(error.message);
}

/** Newest first. Seeds history and the imposter weighting on join. */
export async function fetchHistory(code: string): Promise<ConcludedRound[]> {
  const id = await roomId(code);
  if (id === null) return [];

  const { data, error } = await supabase
    .from("rounds")
    .select(
      "round_key, others_word, imposter_word, imposter_keys, imposter_names, dealer_name, started_at",
    )
    .eq("room_id", id)
    .order("started_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    roundId: r.round_key as string,
    othersWord: r.others_word as string,
    imposterWord: r.imposter_word as string,
    imposterKeys: (r.imposter_keys as string[]) ?? [],
    imposterNames: (r.imposter_names as string[]) ?? [],
    dealerName: r.dealer_name as string,
    startedAt: Number(r.started_at),
  }));
}
