"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, ErrorNote, Field, Panel } from "./ui";
import {
  DEFAULT_IMPOSTERS,
  DEGENERATE_PLAYER_COUNT,
  MAX_WORD_LENGTH,
  MIN_PLAYERS_TO_START,
} from "@/lib/constants";
import { chooseImposters, maxImposters } from "@/lib/imposter";
import ImposterPicker from "./ImposterPicker";
import type { ConcludedRound, Player, Round } from "@/lib/types";

export default function RoundSetup({
  players,
  me,
  history,
  onDeal,
}: {
  players: Player[];
  me: Player;
  /** Newest first. Feeds the weighting so the same people don't keep drawing. */
  history: ConcludedRound[];
  onDeal: (round: Round) => Promise<void>;
}) {
  const [othersWord, setOthersWord] = useState("");
  const [imposterWord, setImposterWord] = useState("");
  /**
   * What the stepper is set to. The count actually used is this or the number
   * of people pinned, whichever is larger — pinning six people plainly means
   * six imposters. Keeping them separate means clearing the selection drops
   * back to what the stepper says, instead of leaving it stuck high.
   */
  const [steppedCount, setSteppedCount] = useState(DEFAULT_IMPOSTERS);
  const [pinned, setPinned] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // The dealer typed both words, so drawing them would hand them the answer.
  const candidates = useMemo(
    () => players.filter((p) => p.key !== me.key),
    [players, me.key],
  );
  const tooFew = players.length < MIN_PLAYERS_TO_START;
  const max = maxImposters(candidates.length);
  const count = Math.min(Math.max(steppedCount, pinned.length, 1), max);

  // Supabase presence takes a couple of seconds to converge — measured at
  // ~2.2s for three clients. Dealing inside that window silently leaves a
  // player who *is* in the room out of participantKeys, and they get told to
  // sit out for no visible reason. Warn rather than block.
  const roster = players.map((p) => p.key).sort().join(",");
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    setSettling(true);
    const timer = setTimeout(() => setSettling(false), 1500);
    return () => clearTimeout(timer);
  }, [roster]);

  // People leave. Drop pins that no longer refer to anyone, and never let the
  // count exceed who's actually available.
  useEffect(() => {
    const live = new Set(candidates.map((c) => c.key));
    setPinned((prev) => {
      const kept = prev.filter((k) => live.has(k));
      return kept.length === prev.length ? prev : kept;
    });
    setSteppedCount((c) => Math.min(Math.max(1, c), maxImposters(candidates.length)));
  }, [candidates]);

  function togglePin(key: string) {
    setPinned((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  async function deal() {
    const a = othersWord.trim();
    const b = imposterWord.trim();

    if (!a || !b) return setError("Both words are required.");
    if (a.toLowerCase() === b.toLowerCase()) {
      return setError("The two words must differ, or there's nothing to spot.");
    }

    const pick = chooseImposters(
      candidates,
      history.map((h) => h.imposterKeys),
      count,
      pinned,
    );
    if (!pick || pick.imposters.length === 0) {
      return setError("There's nobody else to be the imposter.");
    }

    setSending(true);
    setError(null);
    try {
      await onDeal({
        roundId: crypto.randomUUID().slice(0, 10),
        dealerKey: me.key,
        dealerName: me.name,
        imposterKeys: pick.imposters.map((i) => i.key),
        imposterNames: pick.imposters.map((i) => i.name),
        imposterWord: b,
        othersWord: a,
        participantKeys: players.map((p) => p.key),
        nominated: pick.nominated,
        startedAt: Date.now(),
      });
      setOthersWord("");
      setImposterWord("");
      setPinned([]);
    } catch {
      setError("Couldn't deal the round. Check your connection.");
    } finally {
      setSending(false);
    }
  }

  const everyoneIsImposter = count >= candidates.length && candidates.length > 1;

  return (
    <Panel className="space-y-4">
      <p className="font-display text-[10px] tracking-widest text-ash">DEAL A ROUND</p>

      <Field
        label="Word for everyone else"
        value={othersWord}
        onChange={(e) => setOthersWord(e.target.value)}
        maxLength={MAX_WORD_LENGTH}
        placeholder="e.g. Beach"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <Field
        label="Word for the imposters"
        value={imposterWord}
        onChange={(e) => setImposterWord(e.target.value)}
        maxLength={MAX_WORD_LENGTH}
        placeholder="e.g. Desert"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />

      <div className="space-y-2">
        <span className="block font-display text-[10px] tracking-widest text-ash uppercase">
          How many imposters
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="One fewer imposter"
            onClick={() => setSteppedCount(Math.max(1, count - 1))}
            disabled={count <= 1 || count <= pinned.length}
            className="btn-arcade size-12 shrink-0 bg-cyan/10 font-display text-[13px] text-cyan disabled:opacity-35"
          >
            −
          </button>
          <span
            aria-live="polite"
            className="min-w-12 text-center font-display text-base text-bone"
          >
            {count}
          </span>
          <button
            type="button"
            aria-label="One more imposter"
            onClick={() => setSteppedCount(Math.min(max, count + 1))}
            disabled={count >= max}
            className="btn-arcade size-12 shrink-0 bg-cyan/10 font-display text-[13px] text-cyan disabled:opacity-35"
          >
            +
          </button>
          <span className="text-[16px] text-ash">of {candidates.length}</span>
        </div>
        {everyoneIsImposter ? (
          <p className="text-[16px] text-amber">
            That&apos;s everyone but you — nobody left to find.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <ImposterPicker
          candidates={candidates}
          selected={pinned}
          onToggle={togglePin}
          onClear={() => setPinned([])}
        />
        <p className="text-[15px] text-ash">
          {pinned.length === 0
            ? "Nobody picked — the app chooses, favouring whoever's waited longest."
            : pinned.length >= count
              ? "You've named them all, so only you know before the reveal."
              : `${pinned.length} named, ${count - pinned.length} drawn at random.`}
        </p>
      </div>

      <Button tone="neon" onClick={deal} disabled={sending || tooFew}>
        {sending ? "Dealing…" : "Deal"}
      </Button>

      {settling && !tooFew ? (
        <p className="text-[16px] text-cyan">
          Roster still settling — give it a second so nobody gets left out.
        </p>
      ) : null}

      {tooFew ? (
        <p className="text-[16px] text-ash">
          {players.length}/{MIN_PLAYERS_TO_START} players. Waiting for more to join.
        </p>
      ) : players.length <= DEGENERATE_PLAYER_COUNT ? (
        <p className="text-[16px] text-amber">
          Only {players.length} in the room — the other player is the imposter every
          time. Fine for a test, no game in it. Get a third in.
        </p>
      ) : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </Panel>
  );
}
