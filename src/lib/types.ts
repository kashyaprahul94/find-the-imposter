export type Player = {
  /** Public handle. Proves nothing on its own — the token is the identity. */
  key: string;
  name: string;
  joinedAt: number;
};

/**
 * What one player is allowed to know about the live round.
 *
 * Built per-request on the server. A non-dealer participant receives `word` and
 * nothing else — not the other word, not who the imposter is, not even whether
 * it's them. `words` and `imposterName` stay null until the dealer reveals.
 */
export type RoundView = {
  roundKey: string;
  dealerName: string;
  isDealer: boolean;
  startedAt: number;
  /** This player's word. Null for the dealer and for anyone sitting out. */
  word: string | null;
  /** Joined after the deal, so not in this round. */
  sittingOut: boolean;
  /** Both words: the dealer always, everyone else only after the reveal. */
  words: { others: string; imposter: string } | null;
  revealed: boolean;
  imposterName: string | null;
  youWereImposter: boolean;
};

/** A round whose imposter is public. Only these are ever listed as history. */
export type ConcludedRound = {
  roundId: string;
  othersWord: string;
  imposterWord: string;
  imposterName: string;
  dealerName: string;
  startedAt: number;
};

/**
 * Realtime now carries signals, never answers: "something changed, go ask the
 * server". Nothing here is secret, so it doesn't matter who reads it.
 */
export type Signal = {
  kind: "dealt" | "revealed" | "cleared";
  roundKey: string;
  byName: string;
};

export const SIGNAL_EVENT = "signal";
