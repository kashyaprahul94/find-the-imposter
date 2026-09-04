"use client";

import { useState } from "react";
import { MAX_PLAYERS } from "@/lib/constants";
import type { Player } from "@/lib/types";
import { Panel } from "./ui";

export default function PlayerList({
  players,
  meKey,
  creatorKey,
  dealerName,
  onRemove,
}: {
  players: Player[];
  meKey: string;
  /** Whoever opened the room. Can't be removed. */
  creatorKey: string | null;
  /** Names are de-duplicated, so matching on one is unambiguous. */
  dealerName?: string;
  onRemove: (key: string) => void;
}) {
  // Removing someone is one tap away from a misfire on a phone, so it takes
  // two: the ✕ arms, a second tap confirms.
  const [arming, setArming] = useState<string | null>(null);

  return (
    <Panel className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[10px] tracking-widest text-ash">
          IN THE ROOM
        </span>
        <span
          className={`font-display text-[10px] ${
            players.length > MAX_PLAYERS ? "text-neon" : "text-ash"
          }`}
        >
          {players.length}/{MAX_PLAYERS}
        </span>
      </div>

      <ul className="space-y-1.5">
        {players.map((p) => {
          const isMe = p.key === meKey;
          const isCreator = p.key === creatorKey;
          const removable = !isMe && !isCreator;
          const armed = arming === p.key;

          return (
            <li key={p.key} className="flex items-center gap-2">
              <span className={isMe ? "text-cyan" : "text-ash"}>{isMe ? "▸" : "·"}</span>
              <span
                className={`truncate ${isMe ? "text-cyan" : "text-bone"} ${
                  p.present ? "" : "opacity-45"
                }`}
              >
                {p.name}
                {isMe ? " (you)" : ""}
              </span>

              <span className="ml-auto flex shrink-0 items-center gap-2">
                {dealerName && p.name === dealerName ? (
                  <span className="font-display text-[8px] tracking-widest text-amber">
                    DEALER
                  </span>
                ) : null}
                {isCreator ? (
                  <span className="font-display text-[8px] tracking-widest text-cyan/70">
                    HOST
                  </span>
                ) : null}
                {!p.present ? (
                  // Phone locked or on another app. Still dealt in.
                  <span className="font-display text-[8px] tracking-widest text-ash/70">
                    AWAY
                  </span>
                ) : null}

                {removable ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (armed) {
                        onRemove(p.key);
                        setArming(null);
                      } else {
                        setArming(p.key);
                      }
                    }}
                    onBlur={() => setArming((k) => (k === p.key ? null : k))}
                    aria-label={armed ? `Confirm removing ${p.name}` : `Remove ${p.name}`}
                    className={`min-h-9 px-2 font-display text-[8px] tracking-widest uppercase ${
                      armed ? "bg-neon/20 text-neon" : "text-ash/60"
                    }`}
                  >
                    {armed ? "Sure?" : "✕"}
                  </button>
                ) : null}
              </span>
            </li>
          );
        })}
        {players.length === 0 ? (
          <li className="text-ash">Waiting for the channel…</li>
        ) : null}
      </ul>

      {players.some((p) => !p.present) ? (
        <p className="text-[15px] text-ash">
          Away = screen locked or on another app. They&apos;re still dealt in.
        </p>
      ) : null}

      {players.length > MAX_PLAYERS ? (
        <p className="text-[16px] text-neon">
          Over {MAX_PLAYERS} players — the game gets slow. Consider splitting up.
        </p>
      ) : null}
    </Panel>
  );
}
