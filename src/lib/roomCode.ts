import { customAlphabet } from "nanoid";
import { ROOM_CODE_LENGTH } from "./constants";

/**
 * Crockford-ish alphabet: no I, O, 0 or 1, so a code read aloud across a noisy
 * room or typed from a photo can't land on a look-alike character.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const generate = customAlphabet(ALPHABET, ROOM_CODE_LENGTH);

export function generateRoomCode(): string {
  return generate();
}

/**
 * Normalises what a human types or pastes: case, whitespace, and the hyphens
 * that survive a copied link. Characters outside the alphabet are kept, not
 * silently dropped — dropping them would quietly produce a *different* valid
 * code. `isValidRoomCode` rejects them instead so the player sees an error.
 */
export function normalizeRoomCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return (
    code.length === ROOM_CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c))
  );
}

/**
 * Pulls a room code out of whatever a QR happens to contain.
 *
 * Ours encode a full join URL, but a scanner will happily read any QR in view —
 * a wifi card, a menu, someone's business card — so anything that isn't one of
 * our codes must come back null rather than sending the player somewhere odd.
 */
export function extractRoomCode(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;

  // Deliberately not normalizeRoomCode: that truncates to the code length,
  // which is right while someone types but disastrous here. Truncating would
  // turn /room/ABCDEFGH into the valid-but-unrelated "ABCDE", and the words
  // "Just some text" into "JUSTS" — scanning any old QR would join a real room.
  const canonical = (s: string) => s.toUpperCase().replace(/[\s\-_]/g, "");

  try {
    const path = new URL(raw).pathname;
    const match = path.match(/\/room\/([^/?#]+)/i);
    if (!match) return null; // A URL, but not one of ours.
    const fromUrl = canonical(decodeURIComponent(match[1]));
    return isValidRoomCode(fromUrl) ? fromUrl : null;
  } catch {
    // Not a URL — fall through and treat it as a bare code.
  }

  const bare = canonical(raw);
  return isValidRoomCode(bare) ? bare : null;
}
