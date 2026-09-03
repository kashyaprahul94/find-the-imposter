"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";

const STROBE_MS = 240 * 8; // Must match the `strobe` keyframe count in globals.css.

/**
 * Full-screen reveal. The imposter gets the strobe; everyone else gets a calm
 * card naming them. Visual only, by design — no audio, no vibration, so the
 * moment lands identically on iOS and Android.
 */
export default function RevealOverlay({
  isImposter,
  imposterName,
  imposterPresent,
  onDismiss,
}: {
  isImposter: boolean;
  imposterName: string;
  imposterPresent: boolean;
  onDismiss: () => void;
}) {
  const [strobing, setStrobing] = useState(isImposter);

  useEffect(() => {
    if (!isImposter) return;
    const t = setTimeout(() => setStrobing(false), STROBE_MS);
    return () => clearTimeout(t);
  }, [isImposter]);

  if (isImposter) {
    return (
      <div
        role="alertdialog"
        aria-label="You are the imposter"
        className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 p-6 text-center ${
          strobing ? "strobe" : "bg-[#ff0033] text-void"
        }`}
      >
        <p
          className={`font-display text-[9vw] leading-tight tracking-tight sm:text-5xl ${
            strobing ? "shake" : "settle"
          }`}
        >
          YOU ARE
          <br />
          THE
          <br />
          IMPOSTER
        </p>
        {!strobing ? (
          <div className="settle w-full max-w-xs">
            <Button tone="ghost" className="!text-void" onClick={onDismiss}>
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
      aria-label="Imposter revealed"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-void/97 p-6 text-center"
    >
      <p className="font-display text-[11px] tracking-widest text-ash">
        THE IMPOSTER WAS
      </p>
      <p className="settle font-display text-[8vw] leading-tight text-neon text-glow-neon sm:text-4xl">
        {imposterName}
      </p>
      {!imposterPresent ? (
        <p className="text-ash">…and they already left the room.</p>
      ) : null}
      <div className="w-full max-w-xs">
        <Button tone="cyan" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
