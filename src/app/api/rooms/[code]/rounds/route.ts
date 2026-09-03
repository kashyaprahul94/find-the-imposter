import { randomInt, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { MAX_WORD_LENGTH, MIN_PLAYERS_TO_START } from "@/lib/constants";
import { fail, readToken, resolveCaller } from "@/lib/server/handler";
import { admin } from "@/lib/server/admin";
import { currentRound, clearRound } from "@/lib/server/store";

/**
 * Deals a round. The server — not the dealer's browser — chooses the imposter,
 * and the choice is never sent to anyone until the reveal.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const resolved = await resolveCaller(code, readToken(request));
  if ("response" in resolved) return resolved.response;
  const { room, player } = resolved;

  let body: { othersWord?: unknown; imposterWord?: unknown; participantKeys?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Expected a JSON body.", 400);
  }

  const othersWord = String(body.othersWord ?? "").trim().slice(0, MAX_WORD_LENGTH);
  const imposterWord = String(body.imposterWord ?? "").trim().slice(0, MAX_WORD_LENGTH);

  if (!othersWord || !imposterWord) return fail("Both words are required.", 400);
  if (othersWord.toLowerCase() === imposterWord.toLowerCase()) {
    return fail("The two words must differ.", 400);
  }

  const keys = Array.isArray(body.participantKeys)
    ? body.participantKeys.filter((k): k is string => typeof k === "string")
    : [];
  if (keys.length === 0) return fail("No players in the round.", 400);

  // The browser says who is present; the server decides who actually counts.
  // Anything not a real member of this room is dropped on the floor.
  const { data: rows } = await admin()
    .from("players")
    .select("id, player_key")
    .eq("room_id", room.id)
    .in("player_key", keys);

  const participants = rows ?? [];
  if (participants.length < MIN_PLAYERS_TO_START) {
    return fail(`Need at least ${MIN_PLAYERS_TO_START} players.`, 409);
  }

  // The dealer typed both words, so drawing them would hand them the answer.
  const candidates = participants.filter((p) => p.id !== player.id);
  if (candidates.length === 0) {
    return fail("There's nobody else to be the imposter.", 409);
  }

  const imposter = candidates[randomInt(candidates.length)];

  // One live round per room: whatever was on the table is done.
  const live = await currentRound(room.id);
  if (live) await clearRound(live.id);

  const roundKey = randomUUID().slice(0, 10);
  const { error } = await admin().from("rounds").insert({
    room_id: room.id,
    round_key: roundKey,
    dealer_player_id: player.id,
    imposter_player_id: imposter.id,
    others_word: othersWord,
    imposter_word: imposterWord,
    participant_ids: participants.map((p) => p.id),
    started_at: Date.now(),
  });

  if (error) return fail(error.message, 500);

  // Note what is NOT returned: the imposter. Not even to the dealer.
  return NextResponse.json({ roundKey });
}
