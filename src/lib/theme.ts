/**
 * Themes are pure token swaps: every colour and face in the app comes from a
 * CSS variable, so switching one re-skins the whole thing with no component
 * changes. See the `html[data-theme=...]` blocks in globals.css.
 */
export const THEMES = [
  {
    id: "arcade",
    name: "Arcade",
    note: "Neon cabinet in a dark room",
    swatch: ["#07060d", "#ff2d95", "#22e0ff"],
  },
  {
    id: "phosphor",
    name: "Terminal",
    note: "One green, brightness does the rest",
    swatch: ["#050a06", "#33ff66", "#b9ffcb"],
  },
  {
    id: "synth",
    name: "Synthwave",
    note: "Purple ground, magenta into orange",
    swatch: ["#150b2b", "#ff2d95", "#ffb347"],
  },
  {
    id: "gameboy",
    name: "Game Boy",
    note: "Four-tone LCD, readable in daylight",
    swatch: ["#0f380f", "#8bac0f", "#9bbc0f"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "synth";
export const THEME_KEY = "imposter:theme";

export function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function loadTheme(): ThemeId {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME; // Private mode / storage disabled.
  }
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
  try {
    window.localStorage.setItem(THEME_KEY, id);
  } catch {
    // Non-fatal: the choice just won't survive a reload.
  }
}

/**
 * Runs before first paint, inlined in <head>. Without it the page renders in
 * the default theme and then snaps to the chosen one — a visible flash on
 * every load, which is exactly the sort of thing a strobe-based game should
 * not be doing.
 */
export const THEME_BOOT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem(${JSON.stringify(THEME_KEY)});
    var ok = ${JSON.stringify(THEMES.map((t) => t.id))};
    document.documentElement.dataset.theme =
      ok.indexOf(t) > -1 ? t : ${JSON.stringify(DEFAULT_THEME)};
  } catch (e) {
    document.documentElement.dataset.theme = ${JSON.stringify(DEFAULT_THEME)};
  }
})();
`.trim();
