"use client";

import { useEffect, useState } from "react";
import { Button, ErrorNote, Field, Panel } from "./ui";
import {
  DEGENERATE_PLAYER_COUNT,
  MAX_WORD_LENGTH,
  MIN_PLAYERS_TO_START,
} from "@/lib/constants";
import { chooseImposter } from "@/lib/imposter";
import type { ConcludedRound, Player, Round } from "@/lib/types";

const RANDOM = "__random__";

export default function RoundSetup({
  players,
  me,
  history,
  onDeal,
}: {
  players: Player[];
  me: Player;
  /** Newest first. Feeds the weighting so the same person doesn't keep drawing. */
  history: ConcludedRound[];
  onDeal: (round: Round) => Promise<void>;
}) {
  const [othersWord, setOthersWord] = useState("");
  const [imposterWord, setImposterWord] = useState("");
  const [nominee, setNominee] = useState<string>(RANDOM);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // The dealer typed both words, so drawing them would hand them the answer.
  const candidates = players.filter((p) => p.key !== me.key);
  const tooFew = players.length < MIN_PLAYERS_TO_START;
  const onlyOneCandidate = !tooFew && candidates.length === 1;

  // Supabase presence takes a couple of seconds to converge — measured at
  // ~2.2s for three clients. Dealing inside that window silently leaves a
  // player who *is* in the room out of participantKeys, and they get told to
  // sit out for no visible reason. Warn rather than block: the roster is
  // usually long settled by the time anyone deals.
  const roster = players.map((p) => p.key).sort().join(",");
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    setSettling(true);
    const timer = setTimeout(() => setSettling(false), 1500);
    return () => clearTimeout(timer);
  }, [roster]);

  async function deal() {
    const a = othersWord.trim();
    const b = imposterWord.trim();

    if (!a || !b) return setError("Both words are required.");
    if (a.toLowerCase() === b.toLowerCase()) {
      return setError("The two words must differ, or there's nothing to spot.");
    }

    const pick = chooseImposter(
      candidates,
      history.map((h) => h.imposterKey).filter(Boolean),
      nominee === RANDOM ? null : nominee,
    );
    if (!pick) return setError("There's nobody else to be the imposter.");

    setSending(true);
    setError(null);
    try {
      await onDeal({
        roundId: crypto.randomUUID().slice(0, 10),
        dealerKey: me.key,
        dealerName: me.name,
        imposterKey: pick.imposter.key,
        imposterName: pick.imposter.name,
        imposterWord: b,
        othersWord: a,
        participantKeys: players.map((p) => p.key),
        nominated: pick.nominated,
        startedAt: Date.now(),
      });
      setOthersWord("");
      setImposterWord("");
      setNominee(RANDOM);
    } catch {
      setError("Couldn't deal the round. Check your connection.");
    } finally {
      setSending(false);
    }
  }

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
        label="Word for the imposter"
        value={imposterWord}
        onChange={(e) => setImposterWord(e.target.value)}
        maxLength={MAX_WORD_LENGTH}
        placeholder="e.g. Desert"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />

      <label className="block">
        <span className="mb-1 block font-display text-[10px] tracking-widest text-ash uppercase">
          Who&apos;s the imposter
        </span>
        <select
          value={nominee}
          onChange={(e) => setNominee(e.target.value)}
          className="w-full appearance-none border-2 border-edge bg-panel px-3 py-3 text-bone outline-none focus:border-cyan"
        >
          <option value={RANDOM}>
            Pick for me{onlyOneCandidate ? "" : " (favours whoever's waited longest)"}
          </option>
          {candidates.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
              {c.present ? "" : " (away)"}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[15px] text-ash">
          {nominee === RANDOM
            ? onlyOneCandidate
              ? `Only ${candidates[0]?.name} can be it.`
              : "Never the same person twice running."
            : "You've named them, so only you know before the reveal."}
        </span>
      </label>

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
