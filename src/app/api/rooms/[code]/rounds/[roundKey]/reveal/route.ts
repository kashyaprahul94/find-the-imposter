import { NextResponse } from "next/server";
import { fail, readToken, resolveCaller } from "@/lib/server/handler";
import { admin } from "@/lib/server/admin";
import { playersByIds, revealRound } from "@/lib/server/store";

/**
 * Reveals the imposter. Dealer only — enforced here, not in the UI, so hiding
 * the button is a convenience rather than the actual control.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; roundKey: string }> },
) {
  const { code, roundKey } = await params;
  const resolved = await resolveCaller(code, readToken(request));
  if ("response" in resolved) return resolved.response;
  const { room, player } = resolved;

  const { data: round } = await admin()
    .from("rounds")
    .select("id, dealer_player_id, imposter_player_id, cleared_at")
    .eq("room_id", room.id)
    .eq("round_key", roundKey)
    .maybeSingle();

  if (!round) return fail("No such round.", 404);
  if (round.cleared_at) return fail("That round is over.", 409);
  if (round.dealer_player_id !== player.id) {
    return fail("Only the dealer can reveal this round.", 403);
  }

  await revealRound(round.id as number);

  const names = await playersByIds([round.imposter_player_id as number]);
  return NextResponse.json({
    imposterName: names.get(round.imposter_player_id as number)?.name ?? "someone",
  });
}
