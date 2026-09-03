import "server-only";

import { admin } from "./admin";
import { hashToken, issueToken } from "./auth";
import { generateRoomCode } from "@/lib/roomCode";
import { dedupeName } from "@/lib/identity";
import type { ConcludedRound } from "@/lib/types";

const CREATE_ATTEMPTS = 5;

export type RoomRow = { id: number; code: string };

export type RoundRow = {
  id: number;
  round_key: string;
  dealer_player_id: number;
  imposter_player_id: number;
  others_word: string;
  imposter_word: string;
  participant_ids: number[];
  started_at: number;
  revealed_at: string | null;
};

export async function createRoom(): Promise<RoomRow> {
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const { data, error } = await admin()
      .from("rooms")
      .insert({ code })
      .select("id, code")
      .single();

    if (!error && data) return data as RoomRow;
    if (error && error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Could not allocate a room code.");
}

export async function findRoom(code: string): Promise<RoomRow | null> {
  const { data, error } = await admin()
    .from("rooms")
    .select("id, code")
    .eq("code", code)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as RoomRow | null) ?? null;
}

/**
 * Joins a room, or re-authenticates an existing player.
 *
 * A valid token means "this is the same person coming back" — a refresh, or a
 * phone whose tab iOS discarded. Without one we mint a brand-new player, which
 * is why an attacker can't take over someone else's identity by guessing their
 * `player_key`: there is nothing to guess, the token is the identity.
 */
export async function joinRoom(
  room: RoomRow,
  name: string,
  token: string | null,
): Promise<{ playerId: number; playerKey: string; name: string; token: string }> {
  const { data: existingRows } = await admin()
    .from("players")
    .select("id, player_key, name")
    .eq("room_id", room.id);

  const existing = existingRows ?? [];

  if (token) {
    const { data: me } = await admin()
      .from("players")
      .select("id, player_key, name")
      .eq("room_id", room.id)
      .eq("token_hash", hashToken(token))
      .maybeSingle();

    if (me) {
      const taken = existing
        .filter((p) => p.id !== me.id)
        .map((p) => p.name as string);
      const unique = dedupeName(name, taken);
      if (unique !== me.name) {
        await admin().from("players").update({ name: unique }).eq("id", me.id);
      }
      return {
        playerId: me.id as number,
        playerKey: me.player_key as string,
        name: unique,
        token,
      };
    }
  }

  // Names are de-duplicated here rather than on the clients, so two people
  // typing "Sam" can't race each other into the same display name.
  const unique = dedupeName(name, existing.map((p) => p.name as string));
  const freshToken = issueToken();
  const playerKey = generatePlayerKey();

  const { data, error } = await admin()
    .from("players")
    .insert({
      room_id: room.id,
      player_key: playerKey,
      name: unique,
      token_hash: hashToken(freshToken),
    })
    .select("id, player_key, name")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not join the room.");

  return {
    playerId: data.id as number,
    playerKey: data.player_key as string,
    name: data.name as string,
    token: freshToken,
  };
}

function generatePlayerKey(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/** The room's live round: most recent, not yet cleared. */
export async function currentRound(roomId: number): Promise<RoundRow | null> {
  const { data, error } = await admin()
    .from("rounds")
    .select(
      "id, round_key, dealer_player_id, imposter_player_id, others_word, imposter_word, participant_ids, started_at, revealed_at",
    )
    .eq("room_id", roomId)
    .is("cleared_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as RoundRow | null) ?? null;
}

export async function playersByIds(
  ids: number[],
): Promise<Map<number, { id: number; playerKey: string; name: string }>> {
  if (ids.length === 0) return new Map();
  const { data } = await admin()
    .from("players")
    .select("id, player_key, name")
    .in("id", ids);

  return new Map(
    (data ?? []).map((p) => [
      p.id as number,
      { id: p.id as number, playerKey: p.player_key as string, name: p.name as string },
    ]),
  );
}

export async function revealRound(roundId: number): Promise<void> {
  const { error } = await admin()
    .from("rounds")
    .update({ revealed_at: new Date().toISOString() })
    .eq("id", roundId)
    .is("revealed_at", null); // Idempotent: a second reveal changes nothing.

  if (error) throw new Error(error.message);
}

export async function clearRound(roundId: number): Promise<void> {
  const { error } = await admin()
    .from("rounds")
    .update({ cleared_at: new Date().toISOString() })
    .eq("id", roundId)
    .is("cleared_at", null);

  if (error) throw new Error(error.message);
}

/** Concluded rounds only — an unrevealed round never appears in history. */
export async function history(roomId: number): Promise<ConcludedRound[]> {
  const { data, error } = await admin()
    .from("rounds")
    .select(
      "round_key, others_word, imposter_word, started_at, imposter_player_id, dealer_player_id",
    )
    .eq("room_id", roomId)
    .not("revealed_at", "is", null)
    .order("started_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const names = await playersByIds([
    ...new Set(
      rows.flatMap((r) => [
        r.imposter_player_id as number,
        r.dealer_player_id as number,
      ]),
    ),
  ]);

  return rows.map((r) => ({
    roundId: r.round_key as string,
    othersWord: r.others_word as string,
    imposterWord: r.imposter_word as string,
    imposterName: names.get(r.imposter_player_id as number)?.name ?? "someone",
    dealerName: names.get(r.dealer_player_id as number)?.name ?? "someone",
    startedAt: Number(r.started_at),
  }));
}
