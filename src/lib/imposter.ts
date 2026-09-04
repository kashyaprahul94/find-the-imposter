/**
 * Choosing who the imposters are.
 *
 * A uniform random pick is "fair" in the statistical sense and feels terrible
 * in practice: with four candidates the same person comes up twice in a row a
 * quarter of the time, and a table reads that as the app being broken. So the
 * pick is deliberately *less* random than uniform — weighted towards whoever
 * has waited longest, and never repeating the previous round's imposters.
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
 * How many rounds ago this player was an imposter.
 * `recentRounds` is newest-first, one entry per round. Never ⇒ Infinity.
 */
function roundsSince(key: string, recentRounds: string[][]): number {
  const idx = recentRounds.findIndex((keys) => keys.includes(key));
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

/** One weighted draw, favouring whoever has waited longest. */
function drawOne(pool: Candidate[], recentRounds: string[][]): Candidate {
  const maxWeight = pool.length + 1;
  const weights = pool.map((c) =>
    Math.min(roundsSince(c.key, recentRounds) + 1, maxWeight),
  );
  const total = weights.reduce((sum, w) => sum + w, 0);

  let ticket = randomIndex(total);
  for (let i = 0; i < pool.length; i++) {
    ticket -= weights[i];
    if (ticket < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export type Pick = {
  imposters: Candidate[];
  /** At least one was named by the dealer rather than drawn. */
  nominated: boolean;
};

/** The most imposters a round can have: everyone except the dealer. */
export function maxImposters(candidateCount: number): number {
  return Math.max(1, candidateCount);
}

/**
 * @param candidates everyone eligible (the dealer must already be excluded)
 * @param recentRounds newest-first, each entry a past round's imposter keys
 * @param count how many imposters this round
 * @param nominatedKeys players the dealer pinned; the rest are drawn
 */
export function chooseImposters(
  candidates: Candidate[],
  recentRounds: string[][] = [],
  count = 1,
  nominatedKeys: string[] = [],
): Pick | null {
  if (candidates.length === 0) return null;

  const wanted = Math.min(Math.max(1, Math.floor(count)), candidates.length);

  // Pinned players first. Anyone who has since left the room is dropped rather
  // than failing the deal.
  const pinned = nominatedKeys
    .map((k) => candidates.find((c) => c.key === k))
    .filter((c): c is Candidate => Boolean(c))
    .slice(0, wanted);

  const chosen = [...pinned];
  const taken = new Set(chosen.map((c) => c.key));
  let remaining = candidates.filter((c) => !taken.has(c.key));

  if (chosen.length < wanted) {
    // Never a straight repeat of last round — but only while that still leaves
    // enough people to draw from, otherwise the choice would be forced.
    const lastRound = new Set(recentRounds[0] ?? []);
    const rested = remaining.filter((c) => !lastRound.has(c.key));
    const needed = wanted - chosen.length;
    if (candidates.length >= 3 && rested.length >= needed) remaining = rested;

    while (chosen.length < wanted && remaining.length > 0) {
      const drawn = drawOne(remaining, recentRounds);
      chosen.push(drawn);
      remaining = remaining.filter((c) => c.key !== drawn.key);
    }
  }

  return { imposters: chosen, nominated: pinned.length > 0 };
}
