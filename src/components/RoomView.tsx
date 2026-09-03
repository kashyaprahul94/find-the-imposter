"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRoom } from "@/hooks/useRoom";
import { useRoundHistory } from "@/hooks/useRoundHistory";
import { useWakeLock } from "@/hooks/useWakeLock";
import { recordConcludedRound } from "@/lib/rooms";
import type { RoomSession } from "@/lib/session";
import type { Round } from "@/lib/types";
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
  const { playerKey, name } = session;

  const {
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
  } = useRoom({ code, playerKey, name });

  const history = useRoundHistory({ code, round, reveal });

  const [dismissed, setDismissed] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const concluded = Boolean(round && reveal && reveal.roundId === round.roundId);
  const live = Boolean(round) && !concluded;

  useWakeLock(live);

  // A round arriving supersedes whatever this device was doing.
  useEffect(() => {
    if (!round) return;
    setComposing(false);
  }, [round?.roundId, round]);

  const me = players.find((p) => p.key === playerKey) ?? {
    key: playerKey,
    name: displayName,
    joinedAt: Date.now(),
    present: true,
  };

  const isDealer = round?.dealerKey === playerKey;
  const amImposter = round?.imposterKey === playerKey;
  const sittingOut = round ? !round.participantKeys.includes(playerKey) : false;
  const myWord = !round || sittingOut ? null : amImposter ? round.imposterWord : round.othersWord;
  const canReveal = live && (isDealer || dealerAbsent);
  const showOverlay = concluded && round && dismissed !== round.roundId;

  async function handleDeal(next: Round) {
    await startRound(next);
  }

  async function handleReveal() {
    if (!round) return;
    // Broadcast first — the room sees the reveal immediately. The write is
    // fire-and-forget, and only happens now: an unrevealed round never touches
    // the database, so the table can't leak an answer that's still in play.
    await sendReveal({ roundId: round.roundId });
    void recordConcludedRound(code, round).catch(() => {});
  }

  async function handleBeginNewRound() {
    setComposing(true);
    if (!round) return;
    await resetRound({ roundId: round.roundId, byKey: playerKey, byName: displayName });
  }

  const showSetup = composing || (!round && history.length === 0);
  const someoneElseDealing =
    !round && pendingDealer !== null && pendingDealer.key !== playerKey;

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
          {sittingOut ? (
            <Panel className="text-center">
              <p className="font-display text-[10px] tracking-widest text-amber">
                ROUND IN PROGRESS
              </p>
              <p className="mt-2 text-ash">
                You joined after the deal, so you sit this one out. You&apos;re in for the
                next round.
              </p>
            </Panel>
          ) : myWord ? (
            <WordCard word={myWord} />
          ) : null}

          <Panel className="space-y-1 text-center">
            <p className="text-ash">
              Dealt by <span className="text-bone">{round.dealerName}</span>
            </p>
            {isDealer ? (
              <p className="text-[16px] text-amber">
                You dealt — you know the word and can&apos;t be the imposter.
              </p>
            ) : null}
          </Panel>

          {canReveal ? (
            <div className="space-y-2">
              <Button tone="amber" onClick={handleReveal}>
                Reveal imposter
              </Button>
              {!isDealer && dealerAbsent ? (
                <p className="text-center text-[16px] text-ash">
                  {round.dealerName} left, so anyone can call it.
                </p>
              ) : null}
            </div>
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
            {round.othersWord} <span className="text-ash">/</span>{" "}
            <span className="text-neon">{round.imposterWord}</span>
          </p>
          {dismissed === round.roundId ? (
            <Button tone="ghost" onClick={() => setDismissed(null)}>
              Show reveal again
            </Button>
          ) : null}
          <Button tone="neon" onClick={handleBeginNewRound}>
            Begin new round
          </Button>
          <p className="text-[16px] text-ash">
            Clears this round for everyone. Anyone can deal the next one.
          </p>
        </Panel>
      ) : null}

      {showSetup ? (
        <>
          <RoundSetup players={players} me={me} history={history} onDeal={handleDeal} />
          {composing ? (
            <Button tone="ghost" onClick={() => setComposing(false)}>
              Cancel
            </Button>
          ) : null}
        </>
      ) : live ? (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="font-display text-[9px] tracking-wider text-ash uppercase underline"
        >
          Replace this round
        </button>
      ) : concluded ? null : (
        <div className="space-y-2">
          {someoneElseDealing ? (
            <p className="text-center text-[17px] text-cyan">
              {pendingDealer.name} is dealing the next round…
            </p>
          ) : null}
          <Button tone="neon" onClick={() => setComposing(true)}>
            Deal a round
          </Button>
        </div>
      )}

      <HistoryPanel history={history} />

      <PlayerList players={players} meKey={playerKey} dealerName={round?.dealerName} />

      {showOverlay && round ? (
        <RevealOverlay
          isImposter={amImposter}
          imposterName={round.imposterName}
          imposterPresent={players.some((p) => p.key === round.imposterKey)}
          onDismiss={() => setDismissed(round.roundId)}
        />
      ) : null}
    </main>
  );
}
