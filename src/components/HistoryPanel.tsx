"use client";

import { useState } from "react";
import type { ConcludedRound } from "@/lib/types";
import { Panel } from "./ui";

/**
 * Words already played, so nobody re-uses "Beach / Desert" three rounds later.
 * Only concluded rounds appear — an in-flight round is never listed, because
 * listing it would print the answer.
 */
export default function HistoryPanel({ history }: { history: ConcludedRound[] }) {
  const [open, setOpen] = useState(false);

  if (history.length === 0) return null;

  const visible = open ? history : history.slice(0, 1);

  return (
    <Panel className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[9px] tracking-widest text-ash">
          PLAYED ({history.length})
        </span>
        {history.length > 1 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="font-display text-[9px] tracking-wider text-cyan uppercase"
          >
            {open ? "Collapse" : "Show all"}
          </button>
        ) : null}
      </div>

      <ul className="space-y-2">
        {visible.map((entry, i) => (
          <li key={entry.roundId} className="border-l-2 border-edge pl-3">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[9px] text-ash">
                {history.length - i}
              </span>
              <span className="truncate text-bone">{entry.othersWord}</span>
              <span className="text-ash">/</span>
              <span className="truncate text-neon">{entry.imposterWord}</span>
            </div>
            <p className="text-[16px] text-ash">
              {entry.imposterNames.join(", ")}{" "}
              {entry.imposterNames.length > 1 ? "were the imposters" : "was the imposter"}{" "}
              · dealt by {entry.dealerName}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
