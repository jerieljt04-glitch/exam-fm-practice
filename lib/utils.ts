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
