"use client";

import { MAX_PLAYERS } from "@/lib/constants";
import type { Player } from "@/lib/types";
import { Panel } from "./ui";

export default function PlayerList({
  players,
  meKey,
  dealerName,
}: {
  players: Player[];
  meKey: string;
  /** Names are de-duplicated server-side, so matching on one is unambiguous. */
  dealerName?: string;
}) {
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
              {dealerName && p.name === dealerName ? (
                <span className="ml-auto shrink-0 font-display text-[8px] tracking-widest text-amber">
                  DEALER
                </span>
              ) : !p.present ? (
                // Phone locked or switched apps. Still in the room, still dealt in.
                <span className="ml-auto shrink-0 font-display text-[8px] tracking-widest text-ash/70">
                  AWAY
                </span>
              ) : null}
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
