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
