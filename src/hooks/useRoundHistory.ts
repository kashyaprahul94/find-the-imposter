"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHistory } from "@/lib/rooms";
import type { ConcludedRound, Reveal, Round } from "@/lib/types";

/**
 * The room's played rounds, newest first.
 *
 * Appended locally the instant a reveal lands, built from the round every
 * client already holds — so history and the imposter weighting update with no
 * round-trip. The database is read once on join, to pick up rounds played
 * before this device arrived.
 */
export function useRoundHistory({
  code,
  round,
  reveal,
}: {
  code: string;
  round: Round | null;
  reveal: Reveal | null;
}): ConcludedRound[] {
  const [history, setHistory] = useState<ConcludedRound[]>([]);
  const seen = useRef<Set<string>>(new Set());

  const merge = useCallback((incoming: ConcludedRound[]) => {
    const fresh = incoming.filter((e) => !seen.current.has(e.roundId));
    if (fresh.length === 0) return;
    fresh.forEach((e) => seen.current.add(e.roundId));
    setHistory((prev) => [...prev, ...fresh].sort((a, b) => b.startedAt - a.startedAt));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchHistory(code)
      .then((rows) => {
        if (!cancelled) merge(rows);
      })
      .catch(() => {
        // History is a nicety; a failed read must never block play.
      });
    return () => {
      cancelled = true;
    };
  }, [code, merge]);

  useEffect(() => {
    if (!reveal || !round || reveal.roundId !== round.roundId) return;
    merge([
      {
        roundId: round.roundId,
        othersWord: round.othersWord,
        imposterWord: round.imposterWord,
        imposterKeys: round.imposterKeys,
        imposterNames: round.imposterNames,
        dealerName: round.dealerName,
        startedAt: round.startedAt,
      },
    ]);
  }, [reveal, round, merge]);

  return history;
}
