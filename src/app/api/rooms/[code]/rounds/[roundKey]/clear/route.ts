import { NextResponse } from "next/server";
import { fail, readToken, resolveCaller } from "@/lib/server/handler";
import { admin } from "@/lib/server/admin";
import { clearRound } from "@/lib/server/store";

/**
 * Ends a concluded round for the whole room ("Begin new round").
 *
 * Any member may do this, not just the dealer: a round whose dealer has closed
 * their tab can never be revealed, and the room must still be able to move on.
 * Clearing an *unrevealed* round is allowed for exactly that reason.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string; roundKey: string }> },
) {
  const { code, roundKey } = await params;
  const resolved = await resolveCaller(code, readToken(request));
  if ("response" in resolved) return resolved.response;

  const { data: round } = await admin()
    .from("rounds")
    .select("id")
    .eq("room_id", resolved.room.id)
    .eq("round_key", roundKey)
    .maybeSingle();

  if (!round) return fail("No such round.", 404);

  await clearRound(round.id as number);
  return NextResponse.json({ ok: true });
}
