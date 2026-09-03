/**
 * Choosing who the imposter is.
 *
 * A uniform random pick is "fair" in the statistical sense and feels terrible
 * in practice: with four candidates the same person comes up twice in a row a
 * quarter of the time, and a table reads that as the app being broken. So the
 * pick is deliberately *less* random than uniform — weighted towards whoever
 * has waited longest, and never the same person twice running.
 */

export type Candidate = { key: string; name: string };

/** Unbiased index in [0, n) by rejection sampling on a 32-bit draw. */
function randomIndex(n: number): number {
  const limit = Math.floor(0xffffffff / n) * n;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % n;
}

/**
 * How many rounds ago this player was the imposter.
 * `recent` is newest-first. Never been the imposter ⇒ Infinity.
 */
function roundsSince(key: string, recent: string[]): number {
  const idx = recent.indexOf(key);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

export type Pick = {
  imposter: Candidate;
  /** True when the dealer named them rather than leaving it to chance. */
  nominated: boolean;
};

/**
 * @param candidates everyone eligible (the dealer must already be excluded)
 * @param recentImposterKeys newest-first keys from this room's history
 * @param nominatedKey dealer's explicit override, if any
 */
export function chooseImposter(
  candidates: Candidate[],
  recentImposterKeys: string[] = [],
  nominatedKey?: string | null,
): Pick | null {
  if (candidates.length === 0) return null;

  if (nominatedKey) {
    const named = candidates.find((c) => c.key === nominatedKey);
    if (named) return { imposter: named, nominated: true };
    // Nominee has left the room; fall through to a random pick rather than
    // failing the deal.
  }

  if (candidates.length === 1) {
    return { imposter: candidates[0], nominated: false };
  }

  // Never back-to-back. Only enforced when dropping them still leaves a real
  // choice — with two candidates, alternating would be perfectly predictable.
  const lastImposter = recentImposterKeys[0];
  const pool =
    candidates.length >= 3 && lastImposter
      ? candidates.filter((c) => c.key !== lastImposter)
      : candidates;

  // Weight by how long each has waited. Someone who has never been the
  // imposter gets the maximum weight, so newcomers are picked early.
  const maxWeight = pool.length + 1;
  const weights = pool.map((c) => {
    const since = roundsSince(c.key, recentImposterKeys);
    return Math.min(since + 1, maxWeight);
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  // Draw a point in [0, total) at integer resolution, then walk the buckets.
  let ticket = randomIndex(total);
  for (let i = 0; i < pool.length; i++) {
    ticket -= weights[i];
    if (ticket < 0) return { imposter: pool[i], nominated: false };
  }
  return { imposter: pool[pool.length - 1], nominated: false };
}
