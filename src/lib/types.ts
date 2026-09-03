export type Player = {
  /** Public handle, also the realtime presence key. */
  key: string;
  name: string;
  joinedAt: number;
};

/**
 * A dealt round, broadcast in full to the room.
 *
 * Every client receives the imposter's identity and filters locally. That is a
 * deliberate trade: it makes dealing and revealing feel instant, at the cost of
 * the answer being visible to anyone reading their own network traffic. The
 * room is a group of friends at one table; see CLAUDE.md.
 */
export type Round = {
  roundId: string;
  dealerKey: string;
  dealerName: string;
  imposterKey: string;
  imposterName: string;
  imposterWord: string;
  othersWord: string;
  /** Who was dealt in. Anyone joining later sits the round out. */
  participantKeys: string[];
  /** The dealer named the imposter instead of leaving it to chance. */
  nominated: boolean;
  startedAt: number;
};

export type Reveal = { roundId: string };

export type RoundResetPayload = {
  roundId: string;
  byKey: string;
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

/** A round whose imposter is public. Only these are persisted and listed. */
export type ConcludedRound = {
  roundId: string;
  othersWord: string;
  imposterWord: string;
  imposterKey: string;
  imposterName: string;
  dealerName: string;
  startedAt: number;
};

export const EVENT = {
  roundStart: "round-start",
  reveal: "reveal",
  roundReset: "round-reset",
  stateRequest: "state-request",
  stateSync: "state-sync",
} as const;
