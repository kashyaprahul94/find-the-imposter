"use client";

import { useEffect, useState } from "react";
import { applyTheme, loadTheme, THEMES, type ThemeId } from "@/lib/theme";

/**
 * Four swatches, one per theme. Deliberately not a dropdown — the choice is
 * visual, so the control should be too, and four options fit a phone row.
 */
export default function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const [active, setActive] = useState<ThemeId | null>(null);

  // The boot script in <head> already set the attribute; this only syncs React
  // to it after mount, so the server and client markup agree.
  useEffect(() => {
    setActive(loadTheme());
  }, []);

  function choose(id: ThemeId) {
    applyTheme(id);
    setActive(id);
  }

  return (
    <div className="space-y-2">
      <span className="block font-display text-[10px] tracking-widest text-ash uppercase">
        Look
      </span>
      <div role="group" aria-label="Theme" className="grid grid-cols-4 gap-2">
        {THEMES.map((theme) => {
          const on = active === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={on}
              onClick={() => choose(theme.id)}
              title={theme.note}
              className={`flex min-h-16 flex-col items-center gap-1.5 border-2 px-1 py-2 ${
                on ? "border-cyan" : "border-edge"
              }`}
            >
              <span aria-hidden className="flex">
                {theme.swatch.map((colour) => (
                  <span
                    key={colour}
                    style={{ background: colour }}
                    className="size-3.5 border border-black/25"
                  />
                ))}
              </span>
              <span
                className={`truncate text-[14px] leading-none ${
                  on ? "text-cyan" : "text-ash"
                }`}
              >
                {theme.name}
              </span>
            </button>
          );
        })}
      </div>
      {!compact ? (
        <p className="text-[15px] text-ash">
          Only changes your screen — everyone else keeps theirs.
        </p>
      ) : null}
    </div>
  );
}
