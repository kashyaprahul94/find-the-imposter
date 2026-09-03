"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { dedupeName } from "@/lib/identity";
import { AWAY_GRACE_MS, DEALER_ABSENT_MS } from "@/lib/constants";
import {
  absorbPresence,
  isDealerGone,
  reconcileRoster,
  toPlayers,
  type Roster,
} from "@/lib/roster";
import {
  EVENT,
  type PendingDealer,
  type Player,
  type Reveal,
  type Round,
  type RoundResetPayload,
  type StateRequestPayload,
  type StateSyncPayload,
} from "@/lib/types";

export type ConnectionStatus = "connecting" | "joined" | "reconnecting";

/**
 * Live room state, carried entirely over realtime broadcast.
 *
 * Everything a player sees during a round comes from here, never from a fetch —
 * that is what makes dealing and revealing feel instant. The server is written
 * to in the background for durability, but no UI waits on it.
 */
export function useRoom({
  code,
  playerKey,
  name,
}: {
  code: string;
  playerKey: string;
  name: string;
}) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [players, setPlayers] = useState<Player[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [pendingDealer, setPendingDealer] = useState<PendingDealer | null>(null);
  const [dealerAbsent, setDealerAbsent] = useState(false);
  /** The name actually in use, after de-duplication against the room. */
  const [displayName, setDisplayName] = useState(name);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedAtRef = useRef(Date.now());

  // Handlers are registered once and must not close over stale state.
  const roundRef = useRef<Round | null>(null);
  const revealRef = useRef<Reveal | null>(null);
  const pendingRef = useRef<PendingDealer | null>(null);
  const playersRef = useRef<Player[]>([]);

  /**
   * Everyone we've seen in this room, whether or not their socket is currently
   * up. Presence alone would evict a player the moment their phone locks.
   */
  const rosterRef = useRef<Roster>(new Map());
  const presentKeysRef = useRef<Set<string>>(new Set());
  const nameRef = useRef(name);
  nameRef.current = name;
  const displayNameRef = useRef(name);
  displayNameRef.current = displayName;

  /**
   * Folds live presence into the roster and republishes it. Called on every
   * presence sync and once a second, so "away" ages out on its own.
   */
  const rebuildRoster = useCallback(() => {
    const now = Date.now();
    const present = presentKeysRef.current;

    reconcileRoster(rosterRef.current, present, now, AWAY_GRACE_MS);
    const list = toPlayers(rosterRef.current, present);
    playersRef.current = list;
    setPlayers(list);

    const currentRound = roundRef.current;
    setDealerAbsent(
      currentRound
        ? isDealerGone(rosterRef.current, present, currentRound.dealerKey, now, DEALER_ABSENT_MS)
        : false,
    );
  }, []);

  const applyRound = useCallback((incoming: Round) => {
    const current = roundRef.current;
    // A deal that predates what we already hold is a straggler; ignore it so a
    // late broadcast can't resurrect a finished round.
    if (current && incoming.startedAt < current.startedAt) return;
    if (current?.roundId === incoming.roundId) return;

    roundRef.current = incoming;
    setRound(incoming);
    revealRef.current = null;
    setReveal(null);
    pendingRef.current = null;
    setPendingDealer(null);
  }, []);

  const applyReveal = useCallback((incoming: Reveal) => {
    if (revealRef.current?.roundId === incoming.roundId) return; // Idempotent.
    if (roundRef.current && roundRef.current.roundId !== incoming.roundId) return;
    revealRef.current = incoming;
    setReveal(incoming);
  }, []);

  /**
   * Clears the concluded round everywhere. Carries the round being cleared so a
   * late reset can't wipe the round that already replaced it.
   */
  const applyReset = useCallback((payload: RoundResetPayload) => {
    if (roundRef.current && roundRef.current.roundId !== payload.roundId) return;
    roundRef.current = null;
    setRound(null);
    revealRef.current = null;
    setReveal(null);
    const dealer = { key: payload.byKey, name: payload.byName };
    pendingRef.current = dealer;
    setPendingDealer(dealer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const channel = supabase.channel(`room:${code}`, {
      config: { broadcast: { self: true }, presence: { key: playerKey } },
    });
    channelRef.current = channel;

    const track = (as?: string) =>
      channel.track({
        key: playerKey,
        name: as ?? displayNameRef.current,
        joinedAt: joinedAtRef.current,
      });

    // NOTE: supabase-js only maintains presenceState() when a presence listener
    // is bound. Without this, track() succeeds and presence stays empty forever.
    channel.on("presence", { event: "sync" }, () => {
      if (cancelled) return;
      const state = channel.presenceState<Player>();
      const online = Object.values(state)
        .flatMap((entries) => (entries.length ? [entries[0]] : []))
        .filter((p) => typeof p.key === "string" && typeof p.name === "string");

      presentKeysRef.current = new Set(online.map((p) => p.key));
      absorbPresence(rosterRef.current, online, Date.now());
      rebuildRoster();

      const list = playersRef.current;

      // Two friends both called "Sam" would make the reveal ("the imposter was
      // Sam") useless. Whoever arrived later yields and re-tracks as "Sam (2)";
      // ties break on key so both devices agree on which one that is.
      const me = list.find((p) => p.key === playerKey);
      if (!me) return;
      const clash = list.find(
        (p) =>
          p.key !== playerKey &&
          p.name.toLowerCase() === me.name.toLowerCase() &&
          (p.joinedAt < me.joinedAt ||
            (p.joinedAt === me.joinedAt && p.key < playerKey)),
      );
      if (clash) {
        const taken = list.filter((p) => p.key !== playerKey).map((p) => p.name);
        const unique = dedupeName(nameRef.current, taken);
        displayNameRef.current = unique;
        setDisplayName(unique);
        void track(unique);
      } else if (me.name !== displayNameRef.current) {
        displayNameRef.current = me.name;
        setDisplayName(me.name);
      }
    });

    channel.on("broadcast", { event: EVENT.roundStart }, ({ payload }) =>
      applyRound(payload as Round),
    );
    channel.on("broadcast", { event: EVENT.reveal }, ({ payload }) =>
      applyReveal(payload as Reveal),
    );
    channel.on("broadcast", { event: EVENT.roundReset }, ({ payload }) =>
      applyReset(payload as RoundResetPayload),
    );

    // Exactly one client answers a resync request: the dealer if present, else
    // the lowest key. Otherwise every phone in the room replies at once.
    channel.on("broadcast", { event: EVENT.stateRequest }, ({ payload }) => {
      const { requesterKey } = payload as StateRequestPayload;
      if (requesterKey === playerKey) return;
      if (!roundRef.current && !revealRef.current && !pendingRef.current) return;

      const others = playersRef.current.filter((p) => p.key !== requesterKey);
      const dealerHere = others.some((p) => p.key === roundRef.current?.dealerKey);
      const responder = dealerHere
        ? roundRef.current!.dealerKey
        : others.map((p) => p.key).sort()[0];
      if (responder !== playerKey) return;

      const sync: StateSyncPayload = {
        responderKey: playerKey,
        round: roundRef.current,
        reveal: revealRef.current,
        pendingDealer: pendingRef.current,
      };
      void channel.send({ type: "broadcast", event: EVENT.stateSync, payload: sync });
    });

    channel.on("broadcast", { event: EVENT.stateSync }, ({ payload }) => {
      const { round: r, reveal: rv, pendingDealer: pd } = payload as StateSyncPayload;
      if (r) applyRound(r);
      if (rv) applyReveal(rv);
      if (!r && pd && !roundRef.current) {
        pendingRef.current = pd;
        setPendingDealer(pd);
      }
    });

    const requestState = () =>
      channel.send({
        type: "broadcast",
        event: EVENT.stateRequest,
        payload: { requesterKey: playerKey } satisfies StateRequestPayload,
      });

    channel.subscribe((state) => {
      if (cancelled) return;
      if (state === "SUBSCRIBED") {
        setStatus("joined");
        void track().then(() => void requestState());
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
        setStatus("reconnecting");
      }
    });

    // iOS suspends websockets when a phone locks — exactly what happens
    // mid-discussion. Re-announce and resync on return.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void track();
      void requestState();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [code, playerKey, applyRound, applyReveal, applyReset, rebuildRoster]);

  // Presence only fires on change, so "away" and "gone" have to age out on a
  // clock of their own.
  useEffect(() => {
    const timer = setInterval(rebuildRoster, 1000);
    return () => clearInterval(timer);
  }, [rebuildRoster]);

  const startRound = useCallback(
    async (next: Round) => {
      applyRound(next);
      await channelRef.current?.send({
        type: "broadcast",
        event: EVENT.roundStart,
        payload: next,
      });
    },
    [applyRound],
  );

  const sendReveal = useCallback(
    async (next: Reveal) => {
      applyReveal(next);
      await channelRef.current?.send({
        type: "broadcast",
        event: EVENT.reveal,
        payload: next,
      });
    },
    [applyReveal],
  );

  const resetRound = useCallback(
    async (payload: RoundResetPayload) => {
      applyReset(payload);
      await channelRef.current?.send({
        type: "broadcast",
        event: EVENT.roundReset,
        payload,
      });
    },
    [applyReset],
  );

  return useMemo(
    () => ({
      status,
      players,
      round,
      reveal,
      pendingDealer,
      dealerAbsent,
      displayName,
      startRound,
      sendReveal,
      resetRound,
    }),
    [
      status,
      players,
      round,
      reveal,
      pendingDealer,
      dealerAbsent,
      displayName,
      startRound,
      sendReveal,
      resetRound,
    ],
  );
}
