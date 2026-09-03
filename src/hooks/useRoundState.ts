"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ConcludedRound, RoundView } from "@/lib/types";

/**
 * The round and history, both fetched from the server.
 *
 * Every client refetches on a realtime signal rather than reading a broadcast
 * payload, which is what keeps the imposter server-side. Refetches are
 * serialised so a burst of signals (everyone unlocking their phones at once)
 * can't interleave into a stale result.
 */
export function useRoundState(code: string, token: string) {
  const [round, setRound] = useState<RoundView | null>(null);
  const [history, setHistory] = useState<ConcludedRound[]>([]);
  const [loaded, setLoaded] = useState(false);

  const inFlight = useRef(false);
  const queued = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    try {
      const { round: next } = await api.state(code, token);
      setRound(next);

      // History only changes when a round concludes, so it rides along with the
      // state fetch rather than getting its own signal.
      if (!next || next.revealed) {
        const { history: rows } = await api.history(code, token);
        setHistory(rows);
      }
    } catch {
      // Leave the last good state on screen; the next signal will retry.
    } finally {
      setLoaded(true);
      inFlight.current = false;
      if (queued.current) {
        queued.current = false;
        void refresh();
      }
    }
  }, [code, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { round, history, loaded, refresh };
}
