"use client";

import { useEffect } from "react";

/**
 * Keeps the screen awake while a round is live, so a player's phone doesn't
 * lock during discussion and drop them off the channel. Unsupported browsers
 * (and denied requests) fail silently — this is a convenience, not a feature.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        // Denied, or the document wasn't visible. Nothing to do.
      }
    };

    // The lock is dropped whenever the tab is backgrounded; re-take it on return.
    const onVisible = () => {
      if (document.visibilityState === "visible" && !released) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
