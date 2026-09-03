import { NextResponse } from "next/server";
import type { RoundView } from "@/lib/types";
import { readToken, resolveCaller } from "@/lib/server/handler";
import { currentRound, playersByIds } from "@/lib/server/store";

/**
 * The per-player view of the live round. This endpoint is the whole security
 * model: it decides what one person is allowed to know, and everything else in
 * the app renders from what it returns.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const resolved = await resolveCaller(code, readToken(request));
  if ("response" in resolved) return resolved.response;

  const { room, player } = resolved;
  const round = await currentRound(room.id);
  if (!round) return NextResponse.json({ round: null });

  const revealed = round.revealed_at !== null;
  const isDealer = round.dealer_player_id === player.id;
  const sittingOut = !round.participant_ids.includes(player.id);
  const isImposter = round.imposter_player_id === player.id;

  const names = await playersByIds([
    round.dealer_player_id,
    round.imposter_player_id,
  ]);

  // The dealer typed both words, so withholding them is pointless — but they
  // are told nothing about *who* drew which until they reveal.
  const bothWords = { others: round.others_word, imposter: round.imposter_word };

  const view: RoundView = {
    roundKey: round.round_key,
    dealerName: names.get(round.dealer_player_id)?.name ?? "someone",
    isDealer,
    startedAt: round.started_at,
    word:
      isDealer || sittingOut
        ? null
        : isImposter
          ? round.imposter_word
          : round.others_word,
    sittingOut,
    words: isDealer || revealed ? bothWords : null,
    revealed,
    imposterName: revealed
      ? (names.get(round.imposter_player_id)?.name ?? "someone")
      : null,
    youWereImposter: revealed && isImposter,
  };

  return NextResponse.json({ round: view });
}
