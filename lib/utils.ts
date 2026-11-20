import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges conditional class names and resolves conflicting Tailwind utilities.
 * Used by the UI components.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** A count as a whole percentage, or a dash when there is nothing to divide by. */
export function pct(correct: number, total: number): string {
  return total ? `${Math.round((100 * correct) / total)}%` : "—";
}

/** A uniformly random integer in [0, n), from the platform's cryptographic generator where available. */
export function randomIndex(n: number): number {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c?.getRandomValues) {
    // Rejection sampling removes modulo bias.
    const limit = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    do c.getRandomValues(buf);
    while (buf[0] >= limit);
    return buf[0] % n;
  }
  return Math.floor(Math.random() * n);
}

/**
 * Fisher–Yates shuffle: every ordering equally likely (sorting with a random
 * comparator is biased and can favour some orders heavily).
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
