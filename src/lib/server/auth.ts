import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { admin } from "./admin";

export type AuthedPlayer = {
  id: number;
  roomId: number;
  playerKey: string;
  name: string;
};

/** 256 bits of entropy, url-safe. The browser keeps this; we store only its hash. */
export function issueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Resolves a raw token to a player, scoped to one room.
 *
 * Every privileged call goes through this. A `player_key` on its own is never
 * enough — that is what stops one player asking the server for another
 * player's word.
 *
 * The lookup is an indexed equality on the SHA-256 of a 256-bit random token,
 * so there is no meaningful timing channel to defend against here.
 */
export async function authenticate(
  token: string | null | undefined,
  roomId: number,
): Promise<AuthedPlayer | null> {
  if (!token) return null;

  const { data, error } = await admin()
    .from("players")
    .select("id, room_id, player_key, name")
    .eq("room_id", roomId)
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as number,
    roomId: data.room_id as number,
    playerKey: data.player_key as string,
    name: data.name as string,
  };
}
