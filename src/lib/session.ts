import { nanoid } from "nanoid";

export { sanitizeName } from "./identity";

/**
 * Per-room identity, held in the browser.
 *
 * Scoped to one room rather than global: a stored entry means "this device has
 * already joined *this* room", so a refresh rejoins silently, while a QR into a
 * room you've never played always prompts. A single global name caused people
 * to silently rejoin under a name from weeks ago.
 *
 * localStorage rather than sessionStorage because iOS Safari discards
 * backgrounded tabs, and a player who locks their phone mid-round has to come
 * back as the same person or they lose their word.
 */
export type RoomSession = { playerKey: string; name: string };

const roomKey = (code: string) => `imposter:room:${code}`;
/** Only a default for the next room's name field. */
const LAST_NAME_KEY = "imposter:lastName";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // Private mode / storage disabled.
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Non-fatal: the session just won't survive a reload.
  }
}

export function loadSession(code: string): RoomSession | null {
  const raw = read(roomKey(code));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RoomSession>;
    if (!parsed.playerKey || !parsed.name) return null;
    return parsed as RoomSession;
  } catch {
    return null;
  }
}

/** Creates or updates this device's identity for one room. */
export function startSession(code: string, name: string): RoomSession {
  const existing = loadSession(code);
  const session: RoomSession = {
    playerKey: existing?.playerKey ?? nanoid(12),
    name,
  };
  write(roomKey(code), JSON.stringify(session));
  write(LAST_NAME_KEY, name);
  return session;
}

export function clearSession(code: string): void {
  try {
    window.localStorage.removeItem(roomKey(code));
  } catch {
    // Nothing to do.
  }
}

/** Prefill for the name field. Never used to skip the join prompt. */
export function lastUsedName(): string {
  return read(LAST_NAME_KEY) ?? "";
}
