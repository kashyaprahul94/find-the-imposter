export { sanitizeName } from "./identity";

/**
 * Per-room credentials. The token is the player's identity to the server, so it
 * is scoped to one room and never shared between them.
 *
 * localStorage rather than sessionStorage: iOS Safari discards backgrounded
 * tabs, and a player who locks their phone mid-round must come back as the same
 * person or they lose their word.
 */
export type RoomSession = { token: string; playerKey: string; name: string };

const roomKey = (code: string) => `imposter:room:${code}`;
/** Only a convenience default for the next room's name field. */
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
    if (!parsed.token || !parsed.playerKey || !parsed.name) return null;
    return parsed as RoomSession;
  } catch {
    return null;
  }
}

export function saveSession(code: string, session: RoomSession): void {
  write(roomKey(code), JSON.stringify(session));
  write(LAST_NAME_KEY, session.name);
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
