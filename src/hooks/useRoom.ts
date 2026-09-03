"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { SIGNAL_EVENT, type Player, type Signal } from "@/lib/types";

export type ConnectionStatus = "connecting" | "joined" | "reconnecting";

/**
 * Presence and signalling only.
 *
 * Since the server became authoritative, this channel carries no words and no
 * imposter — just who is in the room and a nudge to refetch. Anyone can read
 * every byte of it and learn nothing.
 */
export function useRoom({
  code,
  playerKey,
  name,
  onSignal,
}: {
  code: string;
  playerKey: string;
  name: string;
  /** Fired on any room change, and on reconnect. */
  onSignal: () => void;
}): {
  status: ConnectionStatus;
  players: Player[];
  broadcast: (signal: Signal) => Promise<void>;
} {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [players, setPlayers] = useState<Player[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedAtRef = useRef(Date.now());

  // Registered once; must not close over stale props.
  const nameRef = useRef(name);
  nameRef.current = name;
  const signalRef = useRef(onSignal);
  signalRef.current = onSignal;

  useEffect(() => {
    let cancelled = false;

    const channel = supabase.channel(`room:${code}`, {
      config: {
        broadcast: { self: true },
        presence: { key: playerKey },
      },
    });
    channelRef.current = channel;

    const track = () =>
      channel.track({
        key: playerKey,
        name: nameRef.current,
        joinedAt: joinedAtRef.current,
      });

    // NOTE: supabase-js only maintains presenceState() when a presence listener
    // is bound. Without this handler, track() succeeds and presence stays
    // silently empty forever.
    channel.on("presence", { event: "sync" }, () => {
      if (cancelled) return;
      const state = channel.presenceState<Player>();
      setPlayers(
        Object.values(state)
          .flatMap((entries) => (entries.length ? [entries[0]] : []))
          .filter((p) => typeof p.key === "string" && typeof p.name === "string")
          .map((p) => ({ key: p.key, name: p.name, joinedAt: p.joinedAt }))
          .sort((a, b) => a.joinedAt - b.joinedAt || a.key.localeCompare(b.key)),
      );
    });

    channel.on("broadcast", { event: SIGNAL_EVENT }, () => {
      signalRef.current();
    });

    channel.subscribe((state) => {
      if (cancelled) return;
      if (state === "SUBSCRIBED") {
        setStatus("joined");
        void track().then(() => signalRef.current());
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
        setStatus("reconnecting");
      }
    });

    // iOS suspends websockets when a phone locks, which is exactly what happens
    // mid-discussion. Re-announce and resync on return.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void track();
      signalRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [code, playerKey]);

  // Re-track when the server hands back a de-duplicated name.
  useEffect(() => {
    if (status !== "joined") return;
    void channelRef.current?.track({
      key: playerKey,
      name,
      joinedAt: joinedAtRef.current,
    });
  }, [name, playerKey, status]);

  const broadcast = useCallback(async (signal: Signal) => {
    await channelRef.current?.send({
      type: "broadcast",
      event: SIGNAL_EVENT,
      payload: signal,
    });
  }, []);

  return useMemo(() => ({ status, players, broadcast }), [status, players, broadcast]);
}
