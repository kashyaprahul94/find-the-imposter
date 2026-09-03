"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRoom } from "@/hooks/useRoom";
import { useRoundState } from "@/hooks/useRoundState";
import { useWakeLock } from "@/hooks/useWakeLock";
import { api } from "@/lib/api";
import type { RoomSession } from "@/lib/session";
import { Button, Logo, Panel } from "./ui";
import HistoryPanel from "./HistoryPanel";
import PlayerList from "./PlayerList";
import RevealOverlay from "./RevealOverlay";
import RoundSetup from "./RoundSetup";
import SharePanel from "./SharePanel";
import WordCard from "./WordCard";

export default function RoomView({
  code,
  session,
  onLeave,
}: {
  code: string;
  session: RoomSession;
  onLeave: () => void;
}) {
  const { token, playerKey, name } = session;
  const { round, history, refresh } = useRoundState(code, token);

  const onSignal = useCallback(() => {
    void refresh();
  }, [refresh]);

  const { status, players, broadcast } = useRoom({
    code,
    playerKey,
    name,
    onSignal,
  });

  const [dismissed, setDismissed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);

  const live = Boolean(round) && !round!.revealed;
  const concluded = Boolean(round?.revealed);

  useWakeLock(live);

  // A round arriving supersedes whatever this device was doing.
  useEffect(() => {
    if (!round) return;
    setComposing(false);
  }, [round?.roundKey, round]);

  async function handleReveal() {
    if (!round) return;
    setBusy(true);
    try {
      await api.reveal(code, token, round.roundKey);
      await broadcast({ kind: "revealed", roundKey: round.roundKey, byName: name });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleBeginNewRound() {
    setComposing(true);
    if (!round) return;
    setBusy(true);
    try {
      await api.clear(code, token, round.roundKey);
      await broadcast({ kind: "cleared", roundKey: round.roundKey, byName: name });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const showOverlay = concluded && round && dismissed !== round.roundKey;
  const showSetup = composing || (!round && history.length === 0);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4 pb-10">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" onClick={onLeave} aria-label="Leave room">
          <Logo small />
        </Link>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`size-2 rounded-full ${
              status === "joined" ? "bg-cyan" : "animate-pulse bg-amber"
            }`}
          />
          <span className="font-display text-[11px] tracking-[0.3em] text-bone">
            {code}
          </span>
        </div>
      </header>

      {status !== "joined" ? (
        <p className="border-l-4 border-amber bg-amber/10 px-3 py-2 text-[17px] text-amber">
          {status === "connecting" ? "Connecting…" : "Reconnecting…"}
        </p>
      ) : null}

      <SharePanel code={code} />

      {live && round ? (
        <>
          {round.isDealer ? (
            <Panel className="space-y-2 text-center">
              <p className="font-display text-[10px] tracking-widest text-amber">
                YOU DEALT THIS ROUND
              </p>
              <p className="text-bone">
                {round.words?.others}{" "}
                <span className="text-ash">/</span>{" "}
                <span className="text-neon">{round.words?.imposter}</span>
              </p>
              <p className="text-[16px] text-ash">
                Even you don&apos;t know who drew which. You find out when you reveal.
              </p>
            </Panel>
          ) : round.sittingOut ? (
            <Panel className="text-center">
              <p className="font-display text-[10px] tracking-widest text-amber">
                ROUND IN PROGRESS
              </p>
              <p className="mt-2 text-ash">
                You joined after the deal, so you sit this one out. You&apos;re in for the
                next round.
              </p>
            </Panel>
          ) : round.word ? (
            <WordCard word={round.word} />
          ) : null}

          {!round.isDealer ? (
            <Panel className="text-center">
              <p className="text-ash">
                Dealt by <span className="text-bone">{round.dealerName}</span>
              </p>
            </Panel>
          ) : null}

          {round.isDealer ? (
            <Button tone="amber" onClick={handleReveal} disabled={busy}>
              {busy ? "Revealing…" : "Reveal imposter"}
            </Button>
          ) : (
            <p className="text-center text-[16px] text-ash">
              {round.dealerName} calls the reveal.
            </p>
          )}
        </>
      ) : null}

      {concluded && round ? (
        <Panel className="space-y-3 text-center">
          <p className="font-display text-[10px] tracking-widest text-ash">
            IMPOSTER WAS
          </p>
          <p className="font-display text-sm text-neon text-glow-neon">
            {round.imposterName}
          </p>
          <p className="text-ash">
            {round.words?.others} <span className="text-ash">/</span>{" "}
            <span className="text-neon">{round.words?.imposter}</span>
          </p>
          {dismissed === round.roundKey ? (
            <Button tone="ghost" onClick={() => setDismissed(null)}>
              Show reveal again
            </Button>
          ) : null}
          <Button tone="neon" onClick={handleBeginNewRound} disabled={busy}>
            {busy ? "Clearing…" : "Begin new round"}
          </Button>
          <p className="text-[16px] text-ash">
            Clears this round for everyone. Anyone can deal the next one.
          </p>
        </Panel>
      ) : null}

      {showSetup ? (
        <>
          <RoundSetup
            code={code}
            token={token}
            players={players}
            mePlayerKey={playerKey}
            onDealt={async (roundKey) => {
              await broadcast({ kind: "dealt", roundKey, byName: name });
              await refresh();
            }}
          />
          {composing ? (
            <Button tone="ghost" onClick={() => setComposing(false)}>
              Cancel
            </Button>
          ) : null}
        </>
      ) : live ? (
        // A round whose dealer has closed their tab can never be revealed, so
        // everyone keeps a way to move the room on.
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="font-display text-[9px] tracking-wider text-ash uppercase underline"
        >
          Replace this round
        </button>
      ) : concluded ? null : (
        <Button tone="neon" onClick={() => setComposing(true)}>
          Deal a round
        </Button>
      )}

      <HistoryPanel history={history} />

      <PlayerList players={players} meKey={playerKey} dealerName={round?.dealerName} />

      {showOverlay && round ? (
        <RevealOverlay
          isImposter={round.youWereImposter}
          imposterName={round.imposterName ?? "someone"}
          imposterPresent={players.some((p) => p.name === round.imposterName)}
          onDismiss={() => setDismissed(round.roundKey)}
        />
      ) : null}
    </main>
  );
}
