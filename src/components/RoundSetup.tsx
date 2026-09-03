"use client";

import { useState } from "react";
import { Button, ErrorNote, Field, Panel } from "./ui";
import {
  DEGENERATE_PLAYER_COUNT,
  MAX_WORD_LENGTH,
  MIN_PLAYERS_TO_START,
} from "@/lib/constants";
import { api } from "@/lib/api";
import type { Player } from "@/lib/types";

export default function RoundSetup({
  code,
  token,
  players,
  mePlayerKey,
  onDealt,
}: {
  code: string;
  token: string;
  players: Player[];
  mePlayerKey: string;
  onDealt: (roundKey: string) => Promise<void>;
}) {
  const [othersWord, setOthersWord] = useState("");
  const [imposterWord, setImposterWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Presence drives the button state, but the server re-checks everything —
  // this is only here so the UI doesn't invite a request that will 409.
  const candidates = players.filter((p) => p.key !== mePlayerKey);
  const tooFew = players.length < MIN_PLAYERS_TO_START;
  const onlyOneCandidate = !tooFew && candidates.length === 1;

  async function start() {
    const a = othersWord.trim();
    const b = imposterWord.trim();

    if (!a || !b) return setError("Both words are required.");
    if (a.toLowerCase() === b.toLowerCase()) {
      return setError("The two words must differ, or there's nothing to spot.");
    }

    setSending(true);
    setError(null);
    try {
      const { roundKey } = await api.deal(code, token, {
        othersWord: a,
        imposterWord: b,
        participantKeys: players.map((p) => p.key),
      });
      setOthersWord("");
      setImposterWord("");
      await onDealt(roundKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't deal the round.");
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
        hint={
          onlyOneCandidate
            ? `You deal, so you can't be the imposter — it has to be ${candidates[0].name}.`
            : `You deal, so you can't be the imposter. The server picks from the other ${candidates.length} and won't tell you who.`
        }
      />

      <Button tone="neon" onClick={start} disabled={sending || tooFew}>
        {sending ? "Dealing…" : "Deal"}
      </Button>

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
