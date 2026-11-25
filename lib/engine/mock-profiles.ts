/**
 * Mock-exam profiles offered by the launcher and shown on reports, mapped
 * onto difficulty settings. Kept free of engine imports so client components
 * can use it without bundling the question bank.
 */
export type MockProfile = "STANDARD" | "MIXED" | "HARD_7" | "ELITE_9";

type Setting = 1 | 2 | 3 | 4 | "mixed" | "hard" | "elite";

export const MOCK_PROFILES: Record<MockProfile, { difficulty: Setting; label: string; target: string; summary: string }> = {
  STANDARD: { difficulty: 1, label: "Standard", target: "SOA level", summary: "Every question at the SOA examination standard." },
  MIXED: { difficulty: "mixed", label: "Mixed", target: "EL 4–6", summary: "Mostly SOA standard, with Advanced and Challenge items." },
  HARD_7: { difficulty: "hard", label: "Hard", target: "EL 7–8", summary: "No standard or Advanced items: half Challenge, half Elite." },
  ELITE_9: { difficulty: "elite", label: "Elite", target: "EL 8.5–10", summary: "Every calculation at Elite level — four to six chained stages — with at most four Challenge concept traps." },
};

export const MOCK_PROFILE_ORDER: MockProfile[] = ["STANDARD", "MIXED", "HARD_7", "ELITE_9"];

export function mockProfileOf(difficulty: string | number): MockProfile | null {
  const key = String(difficulty);
  return MOCK_PROFILE_ORDER.find((p) => String(MOCK_PROFILES[p].difficulty) === key) ?? null;
}
