import { MAX_NAME_LENGTH } from "./constants";

/**
 * Pure name helpers, shared by the browser (for input handling) and the server
 * (which is where de-duplication is actually enforced).
 */

export function sanitizeName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

/**
 * Two friends both called "Sam" would make the reveal ("the imposter was Sam")
 * useless, so the later arrival becomes "Sam (2)". Applied server-side at join
 * time, so two people typing the same name can't race into it.
 */
export function dedupeName(name: string, taken: string[]): string {
  const lower = taken.map((n) => n.toLowerCase());
  if (!lower.includes(name.toLowerCase())) return name;

  for (let n = 2; n < 100; n++) {
    const candidate = `${name} (${n})`;
    if (!lower.includes(candidate.toLowerCase())) return candidate;
  }
  return name;
}
