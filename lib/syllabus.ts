/**
 * SOA Exam FM syllabus, as configurable data.
 *
 * Source: SOA Exam FM syllabus, December 2026 sitting
 * https://www.soa.org/globalassets/assets/files/edu/2026/fall/syllabi/2026-12-exam-fm-syllabus.pdf
 *
 * Everything the generator, the blueprint and the report need to know about the
 * examination lives here. When the SOA publishes a new syllabus, update this
 * file (structure, weights, outcomes); nothing else hard-codes these figures.
 */

export type TopicId = "TVM" | "ANNUITIES" | "LOANS" | "BONDS" | "ALM";

export interface LearningOutcome {
  id: string;
  topic: TopicId;
  label: string;
}

export interface TopicDefinition {
  id: TopicId;
  label: string;
  /** Published weight band, as fractions of the examination. */
  weight: { min: number; max: number };
  outcomes: LearningOutcome[];
}

export const SYLLABUS_VERSION = "SOA Exam FM — December 2026";

export const EXAM_STRUCTURE = {
  durationMinutes: 150,
  questionCount: 30,
  optionCount: 5,
  optionKeys: ["A", "B", "C", "D", "E"] as const,
};

export type OptionKey = (typeof EXAM_STRUCTURE.optionKeys)[number];

function outcomes(topic: TopicId, entries: Array<[string, string]>): LearningOutcome[] {
  return entries.map(([id, label]) => ({ id: `${topic}.${id}`, topic, label }));
}

export const TOPICS: TopicDefinition[] = [
  {
    id: "TVM",
    label: "Time Value of Money",
    weight: { min: 0.05, max: 0.15 },
    outcomes: outcomes("TVM", [
      ["simple_compound", "Simple and compound interest"],
      ["accumulation_discount", "Accumulation and discount functions"],
      ["present_future_value", "Present, current and future values"],
      ["effective_nominal", "Effective and nominal interest rates, convertible rates"],
      ["discount_rates", "Effective and nominal discount rates"],
      ["force_of_interest", "Force of interest"],
      ["inflation_real", "Inflation and real interest rates"],
      ["equation_of_value", "Equations of value"],
      ["variable_force", "Variable force of interest"],
    ]),
  },
  {
    id: "ANNUITIES",
    label: "Annuities and Non-Contingent Cash Flows",
    weight: { min: 0.2, max: 0.3 },
    outcomes: outcomes("ANNUITIES", [
      ["immediate_due", "Annuity-immediate and annuity-due"],
      ["perpetuities", "Perpetuities"],
      ["level_payment", "Level-payment annuities"],
      ["arithmetic", "Arithmetic increasing and decreasing annuities"],
      ["geometric", "Geometric increasing and decreasing annuities"],
      ["streams", "Finite and perpetual cash-flow streams"],
      ["non_level", "Non-level and unconventional cash-flow sequences"],
      ["frequency_timing", "Different payment frequencies and payment timings"],
    ]),
  },
  {
    id: "LOANS",
    label: "Loans",
    weight: { min: 0.15, max: 0.25 },
    outcomes: outcomes("LOANS", [
      ["principal_interest", "Principal and interest"],
      ["amortization", "Amortization"],
      ["outstanding_balance", "Outstanding balances"],
      ["payment_components", "Interest and principal components of payments"],
      ["final_payments", "Final, drop and balloon payments"],
      ["unknown_variables", "Unknown loan variables"],
      ["refinancing", "Refinancing calculations"],
    ]),
  },
  {
    id: "BONDS",
    label: "Bonds",
    weight: { min: 0.15, max: 0.25 },
    outcomes: outcomes("BONDS", [
      ["price_redemption", "Bond prices and redemption values"],
      ["book_market", "Book value and market value"],
      ["coupons", "Coupons and coupon rates"],
      ["yield", "Yield rates"],
      ["amortization", "Premium amortization and discount accumulation"],
      ["reinvestment", "Accumulated value with coupon reinvestment"],
      ["callable", "Callable bonds"],
      ["terms", "Bond terms and specified yield requirements"],
    ]),
  },
  {
    id: "ALM",
    label: "General Cash Flows, Portfolios and Asset-Liability Management",
    weight: { min: 0.2, max: 0.3 },
    outcomes: outcomes("ALM", [
      ["rates_of_return", "Rates of return"],
      ["spot_forward", "Spot rates and forward rates"],
      ["yield_curves", "Yield curves"],
      ["duration", "Macaulay and modified duration"],
      ["convexity", "Convexity"],
      ["approx_pv_change", "Approximate changes in present value"],
      ["cash_flow_matching", "Cash-flow matching"],
      ["full_immunization", "Full immunization"],
      ["redington", "Redington immunization"],
      ["portfolio", "Portfolio construction"],
    ]),
  },
];

export const TOPIC_ORDER: TopicId[] = TOPICS.map((topic) => topic.id);

export const TOPIC_LABELS: Record<TopicId, string> = Object.fromEntries(
  TOPICS.map((topic) => [topic.id, topic.label])
) as Record<TopicId, string>;

export const OUTCOMES: Record<string, LearningOutcome> = Object.fromEntries(
  TOPICS.flatMap((topic) => topic.outcomes).map((outcome) => [outcome.id, outcome])
);

/**
 * Baseline 30-question distribution for an exam simulation. Every count sits
 * inside its published band (3/30 = 10%, 7/30 = 23%, 6/30 = 20%, 6/30 = 20%,
 * 8/30 = 27%); `assertBlueprint` checks that on load.
 */
export const EXAM_DISTRIBUTION: Record<TopicId, number> = {
  TVM: 3,
  ANNUITIES: 7,
  LOANS: 6,
  BONDS: 6,
  ALM: 8,
};

/**
 * Topic counts for a session of any length, scaled from the baseline split by
 * largest remainder. Ties go to whichever topic `tieBreak` orders first, so the
 * caller can randomise which topic receives a rounding question.
 */
export function distributionFor(total: number, tieBreak: TopicId[] = TOPIC_ORDER): Record<TopicId, number> {
  const baseline = TOPIC_ORDER.reduce((sum, topic) => sum + EXAM_DISTRIBUTION[topic], 0);
  const raw = TOPIC_ORDER.map((topic) => ({ topic, exact: (EXAM_DISTRIBUTION[topic] * total) / baseline }));
  const counts = Object.fromEntries(raw.map(({ topic, exact }) => [topic, Math.floor(exact)])) as Record<TopicId, number>;
  let remaining = total - Object.values(counts).reduce((a, b) => a + b, 0);
  const order = [...raw].sort((a, b) => {
    const diff = (b.exact % 1) - (a.exact % 1);
    if (Math.abs(diff) > 1e-9) return diff;
    return tieBreak.indexOf(a.topic) - tieBreak.indexOf(b.topic);
  });
  for (const { topic } of order) {
    if (remaining <= 0) break;
    counts[topic] += 1;
    remaining -= 1;
  }
  return counts;
}

function assertBlueprint(): void {
  const total = Object.values(EXAM_DISTRIBUTION).reduce((a, b) => a + b, 0);
  if (total !== EXAM_STRUCTURE.questionCount) {
    throw new Error(`Exam distribution sums to ${total}, not ${EXAM_STRUCTURE.questionCount}.`);
  }
  for (const topic of TOPICS) {
    const share = EXAM_DISTRIBUTION[topic.id] / total;
    if (share < topic.weight.min - 1e-9 || share > topic.weight.max + 1e-9) {
      throw new Error(`${topic.id} has ${share} of the exam, outside its band ${topic.weight.min}–${topic.weight.max}.`);
    }
  }
}

assertBlueprint();
