"use client";

import { useState } from "react";

/**
 * Hold-to-view. Ten people are sitting shoulder to shoulder around a table, so
 * a word printed permanently on screen is the easiest way to lose a round to an
 * accidental glance.
 */
export default function WordCard({ word }: { word: string }) {
  const [held, setHeld] = useState(false);

  return (
    <button
      type="button"
      onPointerDown={() => setHeld(true)}
      onPointerUp={() => setHeld(false)}
      onPointerLeave={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
      // Stops iOS long-press from firing text selection / the callout menu.
      onContextMenu={(e) => e.preventDefault()}
      aria-label={held ? `Your word is ${word}` : "Hold to see your word"}
      className="flex min-h-44 w-full touch-none select-none flex-col items-center justify-center gap-3 border-2 border-edge bg-panel p-6 text-center"
    >
      {held ? (
        <span className="font-display text-[7vw] leading-tight break-all text-cyan text-glow-cyan sm:text-3xl">
          {word}
        </span>
      ) : (
        <>
          <span className="font-display text-[11px] tracking-widest text-ash">
            HOLD TO SEE YOUR WORD
          </span>
          <span className="text-[17px] text-ash/70">Keep it covered.</span>
        </>
      )}
    </button>
  );
}
