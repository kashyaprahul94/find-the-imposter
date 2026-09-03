import "server-only";

import { NextResponse } from "next/server";
import { normalizeRoomCode, isValidRoomCode } from "@/lib/roomCode";
import { authenticate, type AuthedPlayer } from "./auth";
import { findRoom, type RoomRow } from "./store";

export function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Resolves `[code]` to a room, or returns the 400/404 to send back. */
export async function resolveRoom(
  codeParam: string,
): Promise<{ room: RoomRow } | { response: NextResponse }> {
  const code = normalizeRoomCode(decodeURIComponent(codeParam));
  if (!isValidRoomCode(code)) return { response: fail("Malformed room code.", 400) };

  const room = await findRoom(code);
  if (!room) return { response: fail("No such room.", 404) };
  return { room };
}

/**
 * Resolves room + caller in one step. Every endpoint that exposes anything
 * round-specific goes through this; there is no path that trusts a player id
 * supplied by the browser.
 */
export async function resolveCaller(
  codeParam: string,
  token: string | null,
): Promise<{ room: RoomRow; player: AuthedPlayer } | { response: NextResponse }> {
  const resolved = await resolveRoom(codeParam);
  if ("response" in resolved) return resolved;

  const player = await authenticate(token, resolved.room.id);
  if (!player) return { response: fail("Not a member of this room.", 401) };

  return { room: resolved.room, player };
}

/** Bearer token, falling back to a query param for GETs. */
export function readToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return new URL(request.url).searchParams.get("token");
}
