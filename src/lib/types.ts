export type Player = {
  /** Public handle, also the realtime presence key. */
  key: string;
  name: string;
  joinedAt: number;
  /**
   * Connected right now. False means their phone locked or they switched apps —
   * they're still in the room and still dealt in, just not reachable this
   * second. See AWAY_GRACE_MS.
   */
  present: boolean;
};

/**
 * A dealt round, broadcast in full to the room.
 *
 * Every client receives the imposters' identities and filters locally. That is
 * a deliberate trade: it makes dealing and revealing feel instant, at the cost
 * of the answer being visible to anyone reading their own network traffic. The
 * room is a group of friends at one table; see CLAUDE.md.
 */
export type Round = {
  roundId: string;
  dealerKey: string;
  dealerName: string;
  /** One or more. Everyone here gets `imposterWord`. */
  imposterKeys: string[];
  imposterNames: string[];
  imposterWord: string;
  othersWord: string;
  /** Who was dealt in. Anyone joining later sits the round out. */
  participantKeys: string[];
  /** The dealer named at least one imposter instead of leaving it to chance. */
  nominated: boolean;
  startedAt: number;
};

export type Reveal = { roundId: string };

export type RoundResetPayload = {
  roundId: string;
  byKey: string;
  byName: string;
};

/** Removing someone from the room. The room creator can't be a target. */
export type KickPayload = {
  targetKey: string;
  byName: string;
};

/** Advisory only: who said they'd deal next. Never blocks anyone else. */
export type PendingDealer = { key: string; name: string };

export type StateRequestPayload = { requesterKey: string };

export type StateSyncPayload = {
  responderKey: string;
  round: Round | null;
  reveal: Reveal | null;
  pendingDealer: PendingDealer | null;
};

/** A round whose imposters are public. Only these are persisted and listed. */
export type ConcludedRound = {
  roundId: string;
  othersWord: string;
  imposterWord: string;
  imposterKeys: string[];
  imposterNames: string[];
  dealerName: string;
  startedAt: number;
};

export const EVENT = {
  roundStart: "round-start",
  reveal: "reveal",
  roundReset: "round-reset",
  kick: "kick",
  stateRequest: "state-request",
  stateSync: "state-sync",
} as const;
