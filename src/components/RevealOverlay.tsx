"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";

const STROBE_MS = 240 * 8; // Must match the `strobe` keyframe count in globals.css.

/**
 * Full-screen reveal. An imposter gets the strobe; everyone else gets a calm
 * card naming them. Visual only, by design — no audio, no vibration, so the
 * moment lands identically on iOS and Android.
 */
export default function RevealOverlay({
  isImposter,
  imposterNames,
  missingNames,
  onDismiss,
}: {
  isImposter: boolean;
  imposterNames: string[];
  /** Imposters who have since left the room. */
  missingNames: string[];
  onDismiss: () => void;
}) {
  const [strobing, setStrobing] = useState(isImposter);
  const many = imposterNames.length > 1;

  useEffect(() => {
    if (!isImposter) return;
    const t = setTimeout(() => setStrobing(false), STROBE_MS);
    return () => clearTimeout(t);
  }, [isImposter]);

  if (isImposter) {
    return (
      <div
        role="alertdialog"
        aria-label="You are an imposter"
        className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 p-6 text-center ${
          strobing ? "strobe" : "bg-reveal text-reveal-ink"
        }`}
      >
        <p
          className={`font-display text-[9vw] leading-tight tracking-tight sm:text-5xl ${
            strobing ? "shake" : "settle"
          }`}
        >
          YOU ARE
          <br />
          {many ? "AN" : "THE"}
          <br />
          IMPOSTER
        </p>
        {!strobing ? (
          <div className="settle w-full max-w-xs space-y-4">
            {many ? (
              <p className="font-display text-[10px] leading-relaxed tracking-widest">
                SO {imposterNames.length - 1 === 1 ? "WAS" : "WERE"}{" "}
                {imposterNames.length - 1} OTHER
                {imposterNames.length - 1 === 1 ? "" : "S"}
              </p>
            ) : null}
            <Button tone="ghost" className="!text-reveal-ink" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-label="Imposters revealed"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-void/97 p-6 text-center"
    >
      <p className="font-display text-[11px] tracking-widest text-ash">
        {many ? "THE IMPOSTERS WERE" : "THE IMPOSTER WAS"}
      </p>
      <div className="settle space-y-2">
        {imposterNames.map((n) => (
          <p
            key={n}
            className={`font-display leading-tight text-neon text-glow-neon ${
              many ? "text-[6vw] sm:text-2xl" : "text-[8vw] sm:text-4xl"
            }`}
          >
            {n}
          </p>
        ))}
      </div>
      {missingNames.length > 0 ? (
        <p className="text-ash">
          {missingNames.join(", ")} already left the room.
        </p>
      ) : null}
      <div className="w-full max-w-xs">
        <Button tone="cyan" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
