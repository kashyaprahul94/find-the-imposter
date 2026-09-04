"use client";

import { useMemo, useState } from "react";
import type { Player } from "@/lib/types";

/** Above this many candidates, the list gets a filter box. */
const SEARCH_THRESHOLD = 8;

/**
 * Choosing specific imposters.
 *
 * Collapsed by default: most rounds let the app draw, and at twenty players an
 * always-open list is ten rows of chrome for a feature nobody touched. The
 * summary line carries the current state so opening it is never necessary just
 * to see what's set.
 */
export default function ImposterPicker({
  candidates,
  selected,
  onToggle,
  onClear,
}: {
  candidates: Player[];
  selected: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const chosen = useMemo(
    () => candidates.filter((c) => selected.includes(c.key)),
    [candidates, selected],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => c.name.toLowerCase().includes(q));
  }, [candidates, query]);

  const summary =
    chosen.length === 0
      ? "App picks for you"
      : chosen.map((c) => c.name).join(", ");

  return (
    <div className="space-y-2">
      <span className="block font-display text-[10px] tracking-widest text-ash uppercase">
        Pick them yourself
      </span>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-2 border-2 border-edge bg-panel px-3 py-2 text-left"
      >
        <span
          className={`flex-1 truncate text-[17px] ${
            chosen.length === 0 ? "text-ash" : "text-neon"
          }`}
        >
          {summary}
        </span>
        {chosen.length > 0 ? (
          <span className="shrink-0 font-display text-[9px] text-neon">
            {chosen.length}
          </span>
        ) : null}
        <span className="shrink-0 text-ash">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="space-y-2 border-2 border-edge bg-panel/60 p-2">
          {candidates.length > SEARCH_THRESHOLD ? (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter names…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full border-2 border-edge bg-void px-2 py-2 text-bone caret-neon outline-none placeholder:text-ash/50 focus:border-cyan"
            />
          ) : null}

          {/* Capped so a full room scrolls inside the panel rather than
              pushing the Deal button off the screen. */}
          <ul className="max-h-[38vh] overflow-y-auto">
            {shown.map((c) => {
              const on = selected.includes(c.key);
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => onToggle(c.key)}
                    className={`flex min-h-11 w-full items-center gap-2 px-2 py-2 text-left text-[17px] ${
                      on ? "text-neon" : "text-ash"
                    }`}
                  >
                    <span aria-hidden>{on ? "◼" : "◻"}</span>
                    <span className={`flex-1 truncate ${on ? "" : "text-bone"}`}>
                      {c.name}
                    </span>
                    {!c.present ? (
                      <span className="shrink-0 font-display text-[8px] tracking-widest text-ash/70">
                        AWAY
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {shown.length === 0 ? (
              <li className="px-2 py-3 text-ash">Nobody matches “{query}”.</li>
            ) : null}
          </ul>

          <div className="flex gap-2">
            {chosen.length > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className="min-h-11 flex-1 border-2 border-edge px-3 font-display text-[9px] tracking-wider text-ash uppercase"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 flex-1 border-2 border-cyan px-3 font-display text-[9px] tracking-wider text-cyan uppercase"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
