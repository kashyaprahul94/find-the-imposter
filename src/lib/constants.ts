/** Hard cap on players in a room. Enforced in the UI only. */
export const MAX_PLAYERS = 10;

/**
 * The round starter is never eligible to be the imposter (they typed both
 * words), so a round needs the starter plus at least one candidate.
 *
 * At exactly 2 the single candidate is the imposter every time — no guessing
 * left in it. Allowed anyway because it's the only way to test with two
 * devices; the UI warns when the room is this small.
 */
export const MIN_PLAYERS_TO_START = 2;

/** Below this the round works but has no hidden information. */
export const DEGENERATE_PLAYER_COUNT = 2;

export const MAX_NAME_LENGTH = 16;
export const MAX_WORD_LENGTH = 24;

/** Room code length. Alphabet below excludes I, O, 0 and 1. */
export const ROOM_CODE_LENGTH = 5;

/**
 * How long someone stays on the roster after their connection drops.
 *
 * A locked phone or an app switch suspends the page within seconds, killing the
 * websocket — the OS gives a web page no way to avoid this. But a player whose
 * screen went dark is still sitting at the table, so they're shown as "away"
 * rather than removed, and are still dealt into new rounds.
 */
export const AWAY_GRACE_MS = 120_000;

/**
 * How long the dealer must be gone before the reveal button falls back to
 * everyone else. Comfortably longer than a glance at another app, so a locked
 * phone mid-discussion doesn't hand the reveal away.
 */
export const DEALER_ABSENT_MS = 45_000;

/**
 * Two `round-start` broadcasts landing inside this window are treated as a
 * race between two players hitting Start at the same moment rather than as a
 * deliberate new round. See `resolveRoundConflict`.
 */
export const ROUND_RACE_WINDOW_MS = 2_000;
