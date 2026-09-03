import { NextResponse } from "next/server";
import { sanitizeName } from "@/lib/identity";
import { MAX_PLAYERS } from "@/lib/constants";
import { fail, resolveRoom } from "@/lib/server/handler";
import { joinRoom } from "@/lib/server/store";
import { admin } from "@/lib/server/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const resolved = await resolveRoom(code);
  if ("response" in resolved) return resolved.response;

  let body: { name?: unknown; token?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Expected a JSON body.", 400);
  }

  const name = sanitizeName(typeof body.name === "string" ? body.name : "");
  if (!name) return fail("A name is required.", 400);

  const token = typeof body.token === "string" ? body.token : null;

  // Soft cap. Only counts brand-new joins, so a returning player is never
  // locked out of a full room they already belong to.
  if (!token) {
    const { count } = await admin()
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", resolved.room.id);

    if ((count ?? 0) >= MAX_PLAYERS) {
      return fail(`This room already has ${MAX_PLAYERS} players.`, 409);
    }
  }

  try {
    const player = await joinRoom(resolved.room, name, token);
    return NextResponse.json({
      playerKey: player.playerKey,
      name: player.name,
      token: player.token,
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not join.", 500);
  }
}
