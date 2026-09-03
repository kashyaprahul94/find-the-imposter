import type { Player } from "./types";

/**
 * Who is in the room, as distinct from who is currently connected.
 *
 * Locking a phone or switching apps suspends the page within seconds, which
 * kills the websocket and drops the player out of Supabase presence. There is
 * no way for a web page to prevent that. But someone whose screen went dark is
 * still sitting at the table, so the roster keeps them — marked away — until
 * they've been unreachable long enough to have genuinely left.
 */
export type RosterEntry = {
  key: string;
  name: string;
  joinedAt: number;
  /** Last time we saw them connected. */
  lastSeen: number;
};

export type Roster = Map<string, RosterEntry>;

/** Folds a presence snapshot into the roster, refreshing whoever is online. */
export function absorbPresence(
  roster: Roster,
  online: { key: string; name: string; joinedAt: number }[],
  now: number,
): Roster {
  for (const p of online) {
    roster.set(p.key, { key: p.key, name: p.name, joinedAt: p.joinedAt, lastSeen: now });
  }
  return roster;
}

/**
 * Refreshes everyone still connected and drops anyone unreachable past the
 * grace period.
 *
 * The refresh matters: presence only fires on *change*, so a player sitting
 * quietly connected for longer than the grace period would otherwise carry a
 * stale `lastSeen` and be evicted the instant their phone locked, instead of
 * getting the full grace they're owed.
 */
export function reconcileRoster(
  roster: Roster,
  present: Set<string>,
  now: number,
  graceMs: number,
): Roster {
  for (const [key, entry] of roster) {
    if (present.has(key)) entry.lastSeen = now;
    else if (now - entry.lastSeen > graceMs) roster.delete(key);
  }
  return roster;
}

/** The roster as the UI sees it: stable order, each flagged present or away. */
export function toPlayers(roster: Roster, present: Set<string>): Player[] {
  return [...roster.values()]
    .map((e) => ({
      key: e.key,
      name: e.name,
      joinedAt: e.joinedAt,
      present: present.has(e.key),
    }))
    .sort((a, b) => a.joinedAt - b.joinedAt || a.key.localeCompare(b.key));
}

/**
 * Whether the reveal should fall back to the rest of the room. Deliberately
 * slower than "away": a dealer glancing at another app must not hand the
 * reveal away, but a dealer who closed the tab must not strand the round.
 */
export function isDealerGone(
  roster: Roster,
  present: Set<string>,
  dealerKey: string,
  now: number,
  absentMs: number,
): boolean {
  if (present.has(dealerKey)) return false;
  const entry = roster.get(dealerKey);
  if (!entry) return true; // Aged off the roster entirely.
  return now - entry.lastSeen > absentMs;
}
