/**
 * Deterministic pseudo-random source for question parameterization.
 *
 * Generators draw every parameter from an injected `Rng` rather than
 * `Math.random()` directly. Passing an explicit seed makes a generated exam
 * exactly reproducible, which the engine test suite relies on and which lets a
 * persisted question be regenerated from its stored seed.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], inclusive. */
  int(min: number, max: number): number;
  /** Uniform float in [min, max) rounded to `decimals` places. */
  float(min: number, max: number, decimals?: number): number;
  /** Uniform element of a non-empty array. */
  choice<T>(items: readonly T[]): T;
  /** A new array holding the same elements in random order. */
  shuffle<T>(items: readonly T[]): T[];
}

/** mulberry32 — a small, fast, well-distributed 32-bit PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turns an arbitrary string seed into a 32-bit integer (FNV-1a). */
export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed?: string | number): Rng {
  const nextFloat =
    seed === undefined
      ? Math.random
      : mulberry32(typeof seed === "number" ? seed : hashSeed(seed));

  const rng: Rng = {
    next: () => nextFloat(),
    int: (min, max) => Math.floor(nextFloat() * (max - min + 1)) + min,
    float: (min, max, decimals = 2) => Number((nextFloat() * (max - min) + min).toFixed(decimals)),
    choice: (items) => items[Math.floor(nextFloat() * items.length)],
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(nextFloat() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };

  return rng;
}

/**
 * Draws a rate in [min, max] that stays at least `gap` away from `avoid`.
 *
 * A bond whose coupon rate equals its yield is priced at par, which makes every
 * "assume it is worth par" distractor correct. Questions that carry such a
 * distractor use this to keep the bond clearly at a premium or a discount.
 */
export function rateAwayFrom(
  rng: Rng,
  min: number,
  max: number,
  avoid: number,
  gap: number,
  decimals = 3
): number {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = rng.float(min, max, decimals);
    if (Math.abs(candidate - avoid) >= gap) return candidate;
  }
  // Deterministic fallback for a range too narrow to satisfy by sampling.
  const below = Number((avoid - gap).toFixed(decimals));
  const above = Number((avoid + gap).toFixed(decimals));
  return below >= min ? below : above;
}
