/**
 * Loans with irregular events — missed or increased payments, refinancing
 * counts, lender reinvestment, payoff dates — plus the qualitative loan items,
 * modelled on the SOA sample-set question types.
 */
import type { Rng } from "../../random";
import {
  distractor,
  type AuthoredChoice,
  type GeneratedChoiceQuestionItem,
  type GeneratedQuestionItem,
  type QuestionTemplateDefinition,
} from "../types";
import {
  acc,
  adue,
  an,
  cast,
  close,
  dec,
  drawUntil,
  eff,
  gridAmount,
  gridRate,
  mn,
  mpc,
  n,
  nom,
  oneOfFive,
  orderedChoices,
  ord,
  pc,
  sn,
  solve,
  trySolve,
  v,
  word,
  type StatementPair,
} from "./kit";

const LOANS = "LOANS" as const;
const cents = (value: number) => Math.round(value * 100) / 100;
const retro = (L: number, R: number, r: number, k: number) => L * acc(r, k) - R * sn(k, r);
const termFor = (B: number, R: number, r: number) => -Math.log(1 - (B * r) / R) / Math.log(1 + r);

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The last day of the month `index` months after January of `year` (index 0 = January). */
function monthEnd(year: number, index: number): string {
  const y = year + Math.floor(index / 12);
  const m = ((index % 12) + 12) % 12;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m];
  return `${MONTHS[m]} ${days}, ${y}`;
}

export const SOA_ADVANCED_LOAN_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "FM_LOAN_MISSED_PAYMENTS",
    domain: LOANS,
    title: "Missed Loan Payments",
    objective: "Track the effect of missed payments on a loan balance, and the catch-up payments that restore the schedule.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [191, 413],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [borrower] = cast(rng);
      if (rng.next() < 0.5) {
        const years = rng.choice([4, 5, 6]);
        const N = 12 * years;
        const j = gridRate(rng, 0.06, 0.3, 0.06);
        const r = j / 12;
        const R = gridAmount(rng, 200, 1000, 50);
        const missFrom = rng.choice([13, 19, 25]);
        const c = rng.choice([3, 6]);
        const made = missFrom - 1;
        const T = made + 2 * c;
        const B = R * an(N - made, r);
        const X = (B * acc(r, 2 * c) - R * an(N - T, r)) / sn(c, r);
        return {
          questionText: `A ${word(years)}-year loan has ${nom(j, 12)}. It is scheduled to be repaid with level monthly payments of ${n(R)}, beginning one month after the loan is made.
${borrower} misses the ${ord(missFrom)} through ${ord(missFrom + c - 1)} payments, but increases the next ${word(c)} payments to $X$ so that the final ${N - T} payments of ${n(R)} repay the loan.
Calculate $X$.`,
          variables: { variant: "CATCHUP", years, j, R, missFrom, c },
          correctValue: X,
          format: "AMOUNT_0",
          distractors: [
            distractor(2 * R, "SIMPLE_INTEREST_ERROR", "Doubled the payments, ignoring the interest on the missed payments."),
            distractor(R + (R * sn(c, r) * acc(r, c)) / sn(c, r), "CALCULATION_DISTRACTOR", "Accumulated the missed payments for too long before spreading them."),
            distractor((B * acc(r, 2 * c) - R * an(N - T, r)) / (sn(c, r) * (1 + r)), "ANNUITY_DUE_CONFUSION", "Treated the increased payments as made at the start of each month."),
            distractor(R + (R * sn(c, r)) / sn(c, r) * Math.pow(1 + r, c - 1), "OFF_BY_ONE_PERIOD", "Accumulated the missed payments one month short."),
          ],
          solutionSteps: `**Step 1 — Balance after the ${ord(made)} payment.** At $${dec(r, 4)}$ per month, $B = ${mn(R)}\\,a_{\\overline{${N - made}}|} = ${mn(B, 2)}$.

**Step 2 — Balance required when regular payments resume.** After month ${T}, ${N - T} payments of ${n(R)} must repay the loan: $${mn(R)}\\,a_{\\overline{${N - T}}|} = ${mn(R * an(N - T, r), 2)}$.

**Step 3 — Solve.**
$$${mn(B, 2)}(${dec(1 + r, 4)})^{${2 * c}} - X\\,s_{\\overline{${c}}|} = ${mn(R * an(N - T, r), 2)} \\implies X = ${mn(X, 2)}.$$`,
          checks: [{ label: "catch-up exceeds the regular payment", ok: X > R }],
        };
      }
      const N = rng.choice([48, 60, 72]);
      const j = gridRate(rng, 0.03, 0.09, 0.01);
      const r = j / 12;
      // The stem states only the payment, so the loan is what that payment amortizes.
      const R = cents(gridAmount(rng, 10000, 40000, 1000) / an(N, r));
      const L = R * an(N, r);
      const missFrom = rng.int(13, 30);
      const c = rng.choice([1, 2, 3]);
      const at = missFrom + c - 1 + rng.int(6, 14);
      const missed = Array.from({ length: c }, (_, k) => missFrom + k);
      const balance = L * acc(r, at) - R * (sn(at, r) - missed.reduce((sum, m) => sum + acc(r, at - m), 0));
      return {
        questionText: `${borrower} takes out a ${N}-month car loan at ${nom(j, 12)}. The loan provides for a payment of ${n(R, 2)} at the end of each month.
${borrower} fails to make the ${c === 1 ? `${ord(missFrom)} payment` : `${ord(missFrom)} through ${ord(missFrom + c - 1)} payments`}. Beginning with month ${missFrom + c}, ${borrower} resumes payments of ${n(R, 2)} at the end of each month, with a final balloon payment at the end of month ${N} made necessary by the missed payment${c === 1 ? "" : "s"}.
Calculate the outstanding loan balance immediately after the payment at the end of month ${at}.`,
        variables: { variant: "BALANCE", N, j, R, missFrom, c, at },
        correctValue: balance,
        format: "AMOUNT_0",
        distractors: [
          distractor(R * an(N - at, r), "CALCULATION_DISTRACTOR", "Ignored the missed payments."),
          distractor(R * an(N - at, r) + c * R, "SIMPLE_INTEREST_ERROR", "Added the missed payments without interest."),
          distractor(R * an(N - at, r) + R * sn(c, r), "OFF_BY_ONE_PERIOD", "Accumulated the missed payments only to the last missed date."),
          distractor(balance * (1 + r), "OFF_BY_ONE_PERIOD", "Valued the balance a month later."),
        ],
        solutionSteps: `**Step 1 — Loan amount.** $L = ${mn(R, 2)}\\,a_{\\overline{${N}}|${dec(r, 5)}} = ${mn(L, 2)}$.

**Step 2 — Retrospective balance.** Accumulate the loan to month ${at} and subtract only the payments actually made:
$$${mn(L, 2)}(1 + ${dec(r, 5)})^{${at}} - ${mn(R, 2)}\\left[s_{\\overline{${at}}|} - \\sum_{\\text{missed}}(1+j)^{${at} - m}\\right].$$

**Step 3 — Evaluate.** The balance is $${mn(balance, 2)}$, which exceeds the scheduled balance of $${mn(R * an(N - at, r), 2)}$ by the accumulated missed payments.`,
        checks: [{ label: "balance exceeds the scheduled balance", ok: balance > R * an(N - at, r) }],
      };
    },
  },

  {
    id: "FM_LOAN_LENDER_REINVESTMENT",
    domain: LOANS,
    title: "Lender's Yield when Loan Payments Are Reinvested",
    objective: "Accumulate a borrower's payments at the lender's reinvestment rate to find the lender's interest earned or overall yield.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [210, 220, 230, 400],
    generate: (rng: Rng) => {
      const monthly = rng.next() < 0.3;
      const m = monthly ? 12 : 1;
      const L = monthly ? rng.choice([1000, 10000, 50000]) : gridAmount(rng, 10000, 200000, 10000);
      const years = monthly ? rng.choice([5, 10]) : rng.choice([10, 15, 20, 25, 30]);
      const i = gridRate(rng, 0.05, 0.1, 0.01);
      const twoRates = !monthly && rng.next() < 0.35;
      const j1 = twoRates ? i : gridRate(rng, 0.03, i - 0.01, 0.01);
      const j2 = twoRates ? gridRate(rng, 0.04, i - 0.02, 0.01) : j1;
      const T = twoRates ? rng.int(3, years - 3) : 0;
      const askInterest = !twoRates && rng.next() < 0.4;
      const count = m * years;
      const R = L / an(count, i / m);
      // Reinvest each payment until the end of the loan: interest for period k
      // is credited at the rate in force during period k.
      let AV = 0;
      for (let k = 1; k <= count; k += 1) {
        const rate = twoRates && Math.ceil(k / m) > T ? j2 : j1;
        if (k > 1) AV *= 1 + rate / m;
        AV += R;
      }
      const yieldRate = Math.pow(AV / L, 1 / years) - 1;
      const answer = askInterest ? AV - L : yieldRate * 100;
      const reinvest = twoRates
        ? `${eff(j1)} for the first ${word(T)} years and ${eff(j2)} for the remaining ${years - T} years`
        : monthly
          ? nom(j1, 12)
          : eff(j1);
      return {
        questionText: `A bank lends ${n(L)}, to be repaid by level payments at the end of each ${monthly ? "month" : "year"} for ${years} years at ${monthly ? nom(i, 12) : eff(i)}.
The bank immediately reinvests each payment at ${reinvest}.
${askInterest ? "Calculate the total amount of interest earned by the bank over the term of the loan." : `Calculate the bank's annual effective yield rate on the loan over the ${years}-year period.`}`,
        variables: { L, years, m, i, j1, j2, T, askInterest: askInterest ? 1 : 0 },
        correctValue: answer,
        format: askInterest ? "AMOUNT_0" : "PERCENT_1",
        distractors: askInterest
          ? [
              distractor(count * R - L, "CALCULATION_DISTRACTOR", "Counted only the interest paid by the borrower, not the interest earned on reinvestment."),
              distractor(R * sn(count, i / m) - L, "CALCULATION_DISTRACTOR", "Reinvested the payments at the loan rate."),
              distractor(AV, "CALCULATION_DISTRACTOR", "Reported the accumulated value rather than the interest."),
              distractor(R * sn(count, j1 / m) * (1 + j1 / m) - L, "ANNUITY_DUE_CONFUSION", "Accumulated each payment one period too long."),
            ]
          : [
              distractor(i * 100, "CALCULATION_DISTRACTOR", "Reported the loan rate: the reinvestment rate also matters."),
              distractor(j1 * 100, "CALCULATION_DISTRACTOR", "Reported the reinvestment rate."),
              distractor(((i + j2) / 2) * 100, "SIMPLE_INTEREST_ERROR", "Averaged the rates."),
              distractor(((AV / L - 1) / years) * 100, "SIMPLE_INTEREST_ERROR", "Annualised the total growth with simple interest."),
            ],
        solutionSteps: `**Step 1 — Loan payment.** $${mn(L)}/a_{\\overline{${count}}|${monthly ? dec(i / 12, 5) : mpc(i)}} = ${mn(R, 4)}$.

**Step 2 — Accumulate the payments at the reinvestment rate.** Each payment grows from its date to the end of year ${years}; together they are worth $${mn(AV, 2)}$.

**Step 3 — ${askInterest ? "Interest earned" : "Yield"}.** ${askInterest ? `$${mn(AV, 2)} - ${mn(L)} = ${mn(AV - L, 2)}$.` : `$${mn(L)}(1 + y)^{${years}} = ${mn(AV, 2)}$, so $y = ${mpc(yieldRate, 3)}$.`}`,
        checks: [
          {
            label: "yield between the reinvestment and loan rates",
            ok: monthly || (yieldRate > Math.min(j1, j2) - 1e-9 && yieldRate < i + 1e-9),
          },
        ],
      };
    },
  },

  {
    id: "FM_LOAN_REFINANCE_TOTAL_COUNT",
    domain: LOANS,
    title: "Total Number of Payments after Refinancing at a Given Balance",
    objective: "Locate a loan's position from its balance, then count the payments needed after refinancing with the same payment.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [243],
    generate: (rng: Rng) => {
      const L = gridAmount(rng, 30000, 150000, 5000);
      const years = rng.choice([15, 20]);
      const N = 12 * years;
      const j1 = gridRate(rng, 0.06, 0.09, 0.0025);
      const r1 = j1 / 12;
      const X = L / an(N, r1);
      const made = rng.int(24, 72);
      const B = Math.round(X * an(N - made, r1));
      const j2 = gridRate(rng, 0.035, j1 - 0.01, 0.0025);
      const r2 = j2 / 12;
      const remainingNew = termFor(B, X, r2);
      const total = made + Math.ceil(remainingNew);
      return {
        questionText: `A ${years}-year loan of ${n(L)} is to be repaid with payments of $X$ at the end of each month, based on ${nom(j1, 12)}.
When the loan balance is ${n(B)}, the loan is refinanced at ${nom(j2, 12)}. Payments remain at $X$ and are made at the end of each month for as long as necessary, with a smaller final payment.
Calculate the total number of payments, including the smaller final payment.`,
        variables: { L, years, j1, B, j2 },
        correctValue: total,
        format: "AMOUNT_0",
        optionStyle: "LADDER",
        ladderStep: 2,
        distractors: [],
        solutionSteps: `**Step 1 — Monthly payment.** $X = ${mn(L)}/a_{\\overline{${N}}|${dec(r1, 5)}} = ${mn(X, 2)}$.

**Step 2 — Payments already made.** $${mn(X, 2)}\\,a_{\\overline{m}|${dec(r1, 5)}} = ${mn(B)}$ gives $m = ${dec(termFor(B, X, r1), 2)} \\approx ${N - made}$ remaining, so ${made} payments have been made.

**Step 3 — After refinancing.** $${mn(X, 2)}\\,a_{\\overline{n}|${dec(r2, 5)}} = ${mn(B)}$ gives $n = ${dec(remainingNew, 2)}$, so ${Math.ceil(remainingNew)} more payments including the smaller one. The total is $${made} + ${Math.ceil(remainingNew)} = ${total}$.`,
        checks: [{ label: "position recovered from the balance", ok: Math.abs(termFor(B, X, r1) - (N - made)) < 0.05 }],
      };
    },
  },

  {
    id: "FM_LOAN_PRINCIPAL_EQUALS_INTEREST",
    domain: LOANS,
    title: "Payment in which Principal and Interest Are Nearly Equal",
    objective: "Find the payment of an amortized loan whose principal and interest portions are closest to equal.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    soaSamples: [256],
    generate: (rng: Rng) => {
      // The crossing must fall well inside the term; at a low rate over a short
      // term, principal already exceeds interest in the first installment.
      const { L, years, i } = drawUntil(
        () => ({ L: gridAmount(rng, 500, 50000, 500), years: rng.choice([20, 25, 30]), i: gridRate(rng, 0.03, 0.08, 0.005) }),
        (p) => {
          const crossing = p.years + 1 - Math.log(2) / Math.log(1 + p.i);
          return crossing > 3 && crossing < p.years - 2;
        },
        { L: 500, years: 20, i: 0.05 }
      );
      const R = L / an(years, i);
      const diffs = Array.from({ length: years }, (_, k) => Math.abs(R * v(i, years - k) - R * (1 - v(i, years - k))));
      const t = diffs.indexOf(Math.min(...diffs)) + 1;
      const continuous = years + 1 - Math.log(2) / Math.log(1 + i);
      return {
        questionText: `A ${years}-year loan of ${n(L)} at ${eff(i)} is repaid with level installments at the end of each year.
Determine the number of the installment in which the principal and interest portions are most nearly equal.`,
        variables: { L, years, i },
        correctValue: t,
        format: "AMOUNT_0",
        optionStyle: "MODELLED",
        ladderStep: 1,
        distractors: [
          distractor(Math.round(Math.log(2) / Math.log(1 + i)), "CALCULATION_DISTRACTOR", "Counted the doubling time from the start instead of from the end of the loan."),
          distractor(Math.round(years / 2), "SIMPLE_INTEREST_ERROR", "Assumed the crossover is at the midpoint of the term."),
          distractor(t + 1, "OFF_BY_ONE_PERIOD", "Used $v^{n-t}$ instead of $v^{n-t+1}$ for the principal portion."),
          distractor(t - 1, "OFF_BY_ONE_PERIOD", "Stopped one installment early."),
        ],
        solutionSteps: `**Step 1 — Portions of installment $t$.** Principal $Rv^{${years}-t+1}$ and interest $R(1 - v^{${years}-t+1})$ are equal when $v^{${years}-t+1} = \\tfrac12$.

**Step 2 — Solve.** $${years} - t + 1 = \\dfrac{\\ln 2}{\\ln(${dec(1 + i, 3)})} = ${dec(Math.log(2) / Math.log(1 + i), 3)}$, so $t = ${dec(continuous, 2)}$: the ${ord(t)} installment is closest.`,
        // The closest installment by |P - I| can sit on either side of the
        // continuous crossing, because the portions change geometrically.
        checks: [{ label: "adjacent to the crossing", ok: Math.abs(continuous - t) < 1 }],
      };
    },
  },

  {
    id: "FM_LOAN_INCREASED_PAYMENT_EARLY_PAYOFF",
    domain: LOANS,
    title: "Paying a Loan Off Early by Raising the Payment",
    objective: "Relate a raised payment to the shorter remaining term that it produces.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [267, 373],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [borrower] = cast(rng);
      if (rng.next() < 0.5) {
        const years = rng.choice([20, 25, 30]);
        const N = 12 * years;
        const j = gridRate(rng, 0.04, 0.08, 0.005);
        const r = j / 12;
        const early = rng.choice([3, 4, 5]);
        // At least two years of raised payments must remain after the change.
        const after = 12 * rng.choice([5, 10, 15].filter((y) => 12 * (y + early) + 24 <= N));
        const P2 = gridAmount(rng, 1000, 4000, 100);
        const R = (P2 * an(N - after - 12 * early, r)) / an(N - after, r);
        const L = R * an(N, r);
        return {
          questionText: `${borrower} planned to repay a loan of $L$ with level payments at the end of each month for ${years} years. The loan has ${nom(j, 12)}.
Starting with the ${ord(after + 1)} payment, ${borrower} increased the monthly payment to ${n(P2)}, which paid off the loan ${word(early)} years earlier than planned.
Calculate $L$.`,
          variables: { variant: "LOAN", years, j, after, early, P2 },
          correctValue: L,
          format: "AMOUNT_0",
          distractors: [
            distractor(P2 * an(N - 12 * early, r), "CALCULATION_DISTRACTOR", "Assumed the higher payment applied from the start."),
            distractor((P2 * an(N - after - 12 * early, r) / an(N - after, r)) * adue(N, r), "ANNUITY_DUE_CONFUSION", "Valued the original payments as an annuity-due."),
            distractor(((P2 * an(N - after - 12 * early + 1, r)) / an(N - after, r)) * an(N, r), "OFF_BY_ONE_PERIOD", "Counted one extra month at the higher payment."),
            distractor(P2 * an(N - after - 12 * early, r) * acc(r, -after) + R * an(after, r), "CALCULATION_DISTRACTOR", "Mixed the valuation dates of the two phases."),
          ],
          solutionSteps: `**Step 1 — Balance when the payment changes.** After ${after} payments, $B = R\\,a_{\\overline{${N - after}}|}$ at $${dec(r, 5)}$ per month.

**Step 2 — The raised payment clears it.** Paying off ${early} years early leaves ${N - after - 12 * early} payments of ${n(P2)}: $B = ${mn(P2)}\\,a_{\\overline{${N - after - 12 * early}}|} = ${mn(P2 * an(N - after - 12 * early, r), 2)}$, so $R = ${mn(R, 4)}$.

**Step 3 — Loan amount.** $L = R\\,a_{\\overline{${N}}|} = ${mn(L, 2)}$.`,
          checks: [
            { label: "raised payment exceeds the original", ok: P2 > R },
            { label: "raised payments remain", ok: N - after - 12 * early >= 24 },
          ],
        };
      }
      const years = rng.choice([3, 4, 5]);
      const N = 12 * years;
      const j = gridRate(rng, 0.06, 0.12, 0.01);
      const r = j / 12;
      const R = gridAmount(rng, 500, 2000, 100);
      const after = 12;
      const P2 = 2 * R;
      const B = R * an(N - after, r);
      const months = Math.ceil(termFor(B, P2, r));
      return {
        questionText: `A loan is scheduled to be repaid with installments of ${n(R)} at the end of each month for ${word(years)} years, at ${nom(j, 12)}.
After paying one full year of scheduled installments, the borrower increases the monthly payments to ${n(P2)}, with a final drop payment.
Calculate the number of months after the first year that it takes to pay off the loan.`,
        variables: { variant: "MONTHS", years, j, R, after, P2 },
        correctValue: months,
        format: "AMOUNT_0",
        optionStyle: "LADDER",
        ladderStep: 1,
        distractors: [],
        solutionSteps: `**Step 1 — Balance after one year.** $${mn(R)}\\,a_{\\overline{${N - after}}|${dec(r, 4)}} = ${mn(B, 2)}$.

**Step 2 — Term at the higher payment.** $${mn(P2)}\\,a_{\\overline{n}|} = ${mn(B, 2)}$ gives $n = ${dec(termFor(B, P2, r), 2)}$.

**Step 3 — Count.** Full payments plus the drop payment take **${months}** months.`,
        checks: [{ label: "shorter than half the remaining schedule would allow", ok: months <= N - after }],
      };
    },
  },

  {
    id: "FM_LOAN_GEOMETRIC_INCREASING_LOAN",
    domain: LOANS,
    title: "Loan Repaid by Geometrically Increasing Payments",
    objective: "Find the payments of a loan repaid with geometrically increasing installments, then a balance or a principal portion.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [323, 329, 405],
    generate: (rng: Rng) => {
      const monthly = rng.next() < 0.35;
      const L = monthly ? gridAmount(rng, 5000, 30000, 1000) : gridAmount(rng, 10000, 50000, 1000);
      const count = monthly ? rng.choice([36, 48, 60]) : rng.choice([8, 10, 12, 15]);
      const g = monthly ? rng.choice([0.005, 0.01]) : gridRate(rng, 0.03, 0.1, 0.01);
      const j = monthly ? gridRate(rng, 0.06, 0.12, 0.012) : gridRate(rng, 0.05, 0.1, 0.01);
      const r = monthly ? j / 12 : j;
      const firstPayment = L / Array.from({ length: count }, (_, k) => Math.pow(1 + g, k) * v(r, k + 1)).reduce((a, b) => a + b, 0);
      const payment = (t: number) => firstPayment * Math.pow(1 + g, t - 1);
      const balanceAfter = (k: number) => Array.from({ length: count - k }, (_, idx) => payment(k + 1 + idx) * v(r, idx + 1)).reduce((a, b) => a + b, 0);
      const askBalance = !monthly && rng.next() < 0.5;
      const k = askBalance ? rng.int(Math.floor(count / 2), count - 2) : rng.int(1, 3);
      const answer = askBalance ? balanceAfter(k) : payment(k) - r * balanceAfter(k - 1);
      return {
        questionText: `A loan of ${n(L)} is repaid with ${count} increasing payments at the end of each ${monthly ? "month" : "year"}. Each payment is ${pc(g, 1)} greater than the preceding payment.
The payments are based on ${monthly ? nom(j, 12) : eff(j)}.
${askBalance ? `Calculate the loan balance immediately after the ${ord(k)} payment.` : `Calculate the amount of principal repaid in the ${ord(k)} payment.`}`,
        variables: { L, count, g, j, monthly: monthly ? 1 : 0, k, askBalance: askBalance ? 1 : 0 },
        correctValue: answer,
        format: "AMOUNT_0",
        distractors: askBalance
          ? [
              distractor(retro(L, firstPayment, r, k), "CALCULATION_DISTRACTOR", "Treated every payment as equal to the first."),
              distractor(payment(k + 1) * an(count - k, r), "CALCULATION_DISTRACTOR", "Treated the remaining payments as level."),
              distractor(balanceAfter(k - 1), "OFF_BY_ONE_PERIOD", `Stopped after ${k - 1} payments.`),
              distractor(balanceAfter(k) * (1 + r), "ANNUITY_DUE_CONFUSION", "Valued the remaining payments one period early."),
            ]
          : [
              distractor(payment(k), "CALCULATION_DISTRACTOR", "Reported the whole payment."),
              distractor(r * balanceAfter(k - 1), "CALCULATION_DISTRACTOR", "Reported the interest portion."),
              distractor(firstPayment - r * L, "OFF_BY_ONE_PERIOD", "Reported the principal in the first payment."),
              distractor((L / an(count, r)) - r * (k === 1 ? L : balanceAfter(k - 1)), "CALCULATION_DISTRACTOR", "Used a level payment."),
            ],
        solutionSteps: `**Step 1 — First payment.** $L = P\\cdot\\dfrac{1 - \\left(\\frac{${dec(1 + g, 3)}}{${dec(1 + r, 4)}}\\right)^{${count}}}{${dec(r, 4)} - ${dec(g, 3)}}$ gives $P = ${mn(firstPayment, 4)}$.

**Step 2 — ${askBalance ? "Remaining payments" : "Balance before the payment"}.** ${askBalance ? `The ${ord(k + 1)} payment is $${mn(payment(k + 1), 4)}$, and the ${count - k} payments still due are worth $${mn(balanceAfter(k), 2)}$.` : `Just before payment ${k}, the balance is $${mn(balanceAfter(k - 1), 2)}$, so its interest portion is $${dec(r, 4)} \\times ${mn(balanceAfter(k - 1), 2)} = ${mn(r * balanceAfter(k - 1), 4)}$.`}

**Step 3 — Answer.** ${askBalance ? `Balance $= ${mn(answer, 2)}$.` : `Principal $= ${mn(payment(k), 4)} - ${mn(r * balanceAfter(k - 1), 4)} = ${mn(answer, 2)}$.`}`,
        checks: [{ label: "prospective equals retrospective", ok: close(balanceAfter(k), L * acc(r, k) - Array.from({ length: k }, (_, t) => payment(t + 1) * acc(r, k - t - 1)).reduce((a, b) => a + b, 0)) }],
      };
    },
  },

  {
    id: "FM_LOAN_FORGIVEN_INTEREST",
    domain: LOANS,
    title: "Interest Forgone when a Loan Is Forgiven",
    objective: "Separate the remaining scheduled payments into outstanding principal and future interest.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    soaSamples: [368],
    generate: (rng: Rng) => {
      const [lender, borrower] = cast(rng, 2);
      const L = gridAmount(rng, 5000, 30000, 1000);
      const years = rng.choice([3, 4, 5]);
      const m = rng.choice([4, 12]);
      const j = gridRate(rng, 0.04, 0.1, 0.01);
      const r = j / m;
      const N = m * years;
      const R = L / an(N, r);
      const after = rng.int(2, Math.floor(N / 2));
      const B = R * an(N - after, r);
      const forgone = (N - after) * R - B;
      return {
        questionText: `${borrower} borrows ${n(L)} from ${lender} and agrees to repay the ${word(years)}-year loan with equal payments at the end of each ${m === 4 ? "quarter" : "month"}, at ${nom(j, m)}.
Immediately after the ${ord(after)} payment, ${lender} forgives the remaining debt.
Calculate the total interest payments that ${lender} forgoes by forgiving the debt.`,
        variables: { L, years, m, j, after },
        correctValue: forgone,
        format: "AMOUNT_0",
        distractors: [
          distractor(B, "CALCULATION_DISTRACTOR", "Reported the outstanding principal."),
          distractor((N - after) * R, "CALCULATION_DISTRACTOR", "Reported all the remaining payments."),
          distractor(N * R - L, "CALCULATION_DISTRACTOR", "Reported the interest over the whole loan."),
          distractor((N - after + 1) * R - R * an(N - after + 1, r), "OFF_BY_ONE_PERIOD", "Counted one more remaining payment."),
        ],
        solutionSteps: `**Step 1 — Remaining payments and balance.** The payment is $${mn(L)}/a_{\\overline{${N}}|} = ${mn(R, 4)}$; ${N - after} payments remain, and the balance is $${mn(R, 4)}\\,a_{\\overline{${N - after}}|} = ${mn(B, 2)}$.

**Step 2 — Interest forgone.** The remaining payments would have repaid the balance plus interest: $${N - after}(${mn(R, 4)}) - ${mn(B, 2)} = ${mn(forgone, 2)}$.`,
        checks: [{ label: "interest positive", ok: forgone > 0 }],
      };
    },
  },

  {
    id: "FM_LOAN_PAYMENT_FREQUENCY_RATE",
    domain: LOANS,
    title: "Nominal Rate when Payment and Conversion Frequencies Differ",
    objective: "Solve for the payment-period rate of a loan and restate it as a nominal rate on a different conversion frequency.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [370],
    generate: (rng: Rng) => {
      const L = gridAmount(rng, 2000, 20000, 500);
      const [p, c] = rng.choice([
        [4, 12],
        [12, 4],
        [2, 12],
        [2, 4],
      ] as const);
      const years = rng.choice([3, 5, 8]);
      const jTrue = gridRate(rng, 0.04, 0.1, 0.0025);
      const perPay = Math.pow(1 + jTrue / c, c / p) - 1;
      const R = cents(L / an(p * years, perPay));
      const solved = solve((rate) => R * an(p * years, rate) - L, 1e-6, 0.2);
      const j = c * (Math.pow(1 + solved, p / c) - 1);
      const payWord = p === 4 ? "quarter" : p === 12 ? "month" : "six months";
      return {
        questionText: `${n(L)} is borrowed at an annual nominal interest rate of $j$, convertible ${c === 12 ? "monthly" : "quarterly"}. The loan is repaid with payments of ${n(R, 2)} at the end of each ${payWord} for ${years} years.
Calculate $j$.`,
        variables: { L, p, c, years, R },
        correctValue: j * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(solved * p * 100, "NOMINAL_RATE_ERROR", `Reported the nominal rate convertible ${payWord === "month" ? "monthly" : payWord === "quarter" ? "quarterly" : "semiannually"}.`),
          distractor((Math.pow(1 + solved, p) - 1) * 100, "NOMINAL_RATE_ERROR", "Reported the annual effective rate."),
          distractor(solved * 100, "NOMINAL_RATE_ERROR", "Reported the rate per payment period."),
          distractor(c * (Math.pow(1 + solved, c / p) - 1) * 100, "CALCULATION_DISTRACTOR", "Inverted the conversion exponent."),
        ],
        solutionSteps: `**Step 1 — Rate per payment period.** Solve $${mn(R, 2)}\\,a_{\\overline{${p * years}}|} = ${mn(L)}$: the rate is $${dec(solved, 6)}$ per ${payWord}.

**Step 2 — Rate per conversion period.** One ${c === 12 ? "month" : "quarter"} is $${p}/${c}$ of a payment period: $(1 + ${dec(solved, 6)})^{${p}/${c}} - 1 = ${dec(solved === 0 ? 0 : Math.pow(1 + solved, p / c) - 1, 6)}$.

**Step 3 — Nominal rate.** $j = ${c} \\times ${dec(Math.pow(1 + solved, p / c) - 1, 6)} = ${mpc(j, 3)}$.`,
        checks: [{ label: "rate recovered", ok: Math.abs(j - jTrue) < 1e-4 }],
      };
    },
  },

  {
    id: "FM_LOAN_TERM_FROM_PAYMENT",
    domain: LOANS,
    title: "Term Needed when the Principal or Rate Changes",
    objective: "Find how many level payments are needed when the same payment is applied to a larger loan or at a different rate.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    soaSamples: [374, 377],
    generate: (rng: Rng): GeneratedQuestionItem => {
      if (rng.next() < 0.5) {
        const C1 = gridAmount(rng, 20000, 50000, 1000);
        const C2 = C1 + gridAmount(rng, 1000, 5000, 500);
        const months1 = rng.choice([60, 72, 84, 120]);
        const j = gridRate(rng, 0.06, 0.12, 0.01);
        const r = j / 12;
        const R = C1 / an(months1, r);
        const months = Math.ceil(termFor(C2, R, r));
        return {
          questionText: `A car dealership offers a ${months1}-month loan for a blue car costing ${n(C1)}, at ${nom(j, 12)} with level end-of-month payments.
It also offers a loan for a red car costing ${n(C2)}, with the same interest rate and the same monthly payment as the loan for the blue car.
Calculate the number of months needed to pay off the loan for the red car.`,
          variables: { variant: "PRINCIPAL", C1, C2, months1, j },
          correctValue: months,
          format: "AMOUNT_0",
          optionStyle: "MODELLED",
          ladderStep: 1,
          distractors: [
            distractor(Math.ceil((months1 * C2) / C1), "SIMPLE_INTEREST_ERROR", "Scaled the term in proportion to the price."),
            distractor(Math.floor(termFor(C2, R, r)), "OFF_BY_ONE_PERIOD", "Rounded down, leaving part of the loan unpaid."),
            distractor(months1, "CALCULATION_DISTRACTOR", "Kept the same term."),
          ],
          solutionSteps: `**Step 1 — Monthly payment.** $${mn(C1)}/a_{\\overline{${months1}}|${dec(r, 4)}} = ${mn(R, 2)}$.

**Step 2 — Term for the red car.** $${mn(R, 2)}\\,a_{\\overline{n}|} = ${mn(C2)}$ gives $n = ${dec(termFor(C2, R, r), 2)}$, so **${months}** months (the last payment smaller).`,
          checks: [{ label: "longer than the first term", ok: months > months1 }],
        };
      }
      const params = drawUntil(
        () => {
          const r1 = rng.choice([0.005, 0.0075, 0.01]);
          const factor = rng.choice([1.5, 2, 2.01]);
          const n2 = rng.choice([120, 150, 200]);
          const r2 = Number((r1 * factor).toFixed(6));
          const target = factor * an(n2, r2);
          const nStar = -Math.log(1 - target * r1) / Math.log(1 + r1);
          return { r1, factor, n2, r2, nStar };
        },
        (p) => Number.isFinite(p.nStar) && p.nStar > p.n2 && p.nStar < 900,
        { r1: 0.01, factor: 2.01, n2: 200, r2: 0.0201, nStar: 400 }
      );
      const { r1, factor, n2, r2, nStar } = params;
      const answer = Math.round(nStar);
      return {
        questionText: `A bank lends the same amount to each of two borrowers.
The first borrower is charged a monthly effective interest rate of ${pc(r1, 2)} and makes level end-of-month payments of $X$ for $n$ months.
The second borrower is charged a monthly effective interest rate of ${pc(r2, 4)} and makes level end-of-month payments of ${factor}$X$ for ${n2} months.
Calculate $n$.`,
        variables: { variant: "RATE", r1, r2, factor, n2 },
        correctValue: answer,
        format: "AMOUNT_0",
        optionStyle: "LADDER",
        ladderStep: 50,
        distractors: [],
        solutionSteps: `**Step 1 — Equal loan amounts.** $X\\,a_{\\overline{n}|${mpc(r1, 2)}} = ${factor}X\\,a_{\\overline{${n2}}|${mpc(r2, 4)}} = ${factor}(${dec(an(n2, r2), 4)})X$.

**Step 2 — Solve.** $a_{\\overline{n}|} = ${dec(factor * an(n2, r2), 4)}$ at ${pc(r1, 2)} gives $n = ${dec(nStar, 1)} \\approx ${answer}$.`,
        checks: [{ label: "near a whole number", ok: Math.abs(nStar - answer) < 0.5 }],
      };
    },
  },

  {
    id: "FM_LOAN_DROP_PAYMENT",
    domain: LOANS,
    title: "Drop Payment after Level Payments",
    objective: "Count the full level payments a loan supports and size the final drop payment.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [380],
    generate: (rng: Rng) => {
      const params = drawUntil(
        () => {
          const L = gridAmount(rng, 2000, 10000, 100);
          const i = gridRate(rng, 0.035, 0.08, 0.0025);
          const R = gridAmount(rng, 150, 1000, 10);
          const nStar = termFor(L, R, i);
          return { L, i, R, nStar };
        },
        (p) => Number.isFinite(p.nStar) && p.nStar > 8 && p.nStar < 40 && p.nStar % 1 > 0.03 && p.nStar % 1 < 0.95,
        { L: 3400, i: 0.045, R: 240, nStar: termFor(3400, 240, 0.045) }
      );
      const { L, i, R, nStar } = params;
      const full = Math.floor(nStar);
      const drop = (L - R * an(full, i)) * acc(i, full + 1);
      return {
        questionText: `Annual payments of ${n(R)} are made at the end of each year to repay a loan of ${n(L)}. The payments are based on ${eff(i)}. The loan is settled with a drop payment of $X$ one year after the last payment of ${n(R)}.
Calculate $X$.`,
        variables: { L, i, R },
        correctValue: drop,
        format: "AMOUNT_2",
        distractors: [
          distractor(drop / (1 + i), "OFF_BY_ONE_PERIOD", "Accumulated the remainder only to the last full payment."),
          distractor(L - R * an(full, i), "CALCULATION_DISTRACTOR", "Did not accumulate the remainder."),
          distractor(R * (nStar - full), "SIMPLE_INTEREST_ERROR", "Took the fractional part of a payment."),
          distractor(drop * (1 + i), "OFF_BY_ONE_PERIOD", "Accumulated the remainder one year too long."),
        ],
        solutionSteps: `**Step 1 — Number of full payments.** $${mn(R)}\\,a_{\\overline{n}|${mpc(i)}} = ${mn(L)}$ gives $n = ${dec(nStar, 3)}$, so there are ${full} full payments.

**Step 2 — Equation of value.** $${mn(L)} = ${mn(R)}\\,a_{\\overline{${full}}|} + Xv^{${full + 1}}$, and $${mn(R)}\\,a_{\\overline{${full}}|} = ${mn(R * an(full, i), 2)}$.

**Step 3 — Solve.** $X = (${mn(L)} - ${mn(R * an(full, i), 2)})(${dec(1 + i, 4)})^{${full + 1}} = ${mn(drop, 2)}$.`,
        checks: [{ label: "drop smaller than a payment", ok: drop > 0 && drop < R }],
      };
    },
  },

  {
    id: "FM_LOAN_INTEREST_ONLY_THEN_LEVEL_COUNT",
    domain: LOANS,
    title: "Interest-Only Period followed by Level Payments",
    objective: "Count the payments on a loan with an interest-only period followed by level payments at a new rate.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [407],
    generate: (rng: Rng) => {
      const [borrower] = cast(rng);
      const L = gridAmount(rng, 100000, 300000, 10000);
      const ioYears = rng.choice([2, 3, 5]);
      const j1 = gridRate(rng, 0.03, 0.06, 0.005);
      const j2 = gridRate(rng, j1, j1 + 0.03, 0.005);
      const r2 = j2 / 12;
      const R = Math.round((L * r2 * rng.choice([1.3, 1.5, 1.8, 2])) / 50) * 50;
      const later = Math.ceil(termFor(L, R, r2));
      const total = 12 * ioYears + later;
      return {
        questionText: `${borrower} borrows ${n(L)} to buy a house. ${borrower} makes interest-only payments at the end of each month for ${word(ioYears)} years, and then payments of ${n(R)} at the end of each month until the loan is repaid, the last payment being smaller.
Interest accrues at ${nom(j1, 12)} for the first ${word(ioYears)} years and at ${nom(j2, 12)} after that.
Calculate the total number of payments it will take to repay the loan.`,
        variables: { L, ioYears, j1, j2, R },
        correctValue: total,
        format: "AMOUNT_0",
        optionStyle: "MODELLED",
        ladderStep: 1,
        distractors: [
          distractor(later, "CALCULATION_DISTRACTOR", "Counted only the level payments."),
          distractor(12 * ioYears + Math.ceil(termFor(L, R, j1 / 12)), "CALCULATION_DISTRACTOR", "Used the first rate for the level payments."),
          distractor(12 * ioYears + Math.floor(termFor(L, R, r2)), "OFF_BY_ONE_PERIOD", "Left out the final smaller payment."),
          distractor(total + 12 * ioYears, "CALCULATION_DISTRACTOR", "Double counted the interest-only period."),
        ],
        solutionSteps: `**Step 1 — Interest-only period.** The balance stays at ${n(L)} for ${12 * ioYears} payments.

**Step 2 — Level payments.** At $${dec(r2, 5)}$ per month, $${mn(R)}\\,a_{\\overline{n}|} = ${mn(L)}$ gives $n = ${dec(termFor(L, R, r2), 2)}$, so ${later} payments including the smaller final one.

**Step 3 — Total.** $${12 * ioYears} + ${later} = ${total}$.`,
        checks: [{ label: "payment exceeds interest", ok: R > L * r2 }],
      };
    },
  },

  {
    id: "FM_LOAN_SCHEDULES_EQUIVALENCE",
    domain: LOANS,
    title: "Comparing Two Repayment Schedules",
    objective: "Compare loans repaid on different schedules at the same rate, or find the payment of an equivalent schedule.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [415, 422],
    generate: (rng: Rng): GeneratedQuestionItem => {
      if (rng.next() < 0.5) {
        const half = rng.choice([36, 48, 60]);
        const j = gridRate(rng, 0.036, 0.084, 0.012);
        const r = j / 12;
        const [a1, a2]: number[] = rng.choice([[1, 1.5], [1, 1.2], [1.2, 1]]);
        const [b1, b2]: number[] = rng.choice([[1.2, 0.9], [1.1, 1], [1.3, 0.8]]);
        const loanA = a1 * an(half, r) + a2 * v(r, half) * an(half, r);
        const loanB = b1 * adue(half, r) + b2 * v(r, half) * adue(half, r);
        const ratio = loanA / loanB;
        return {
          questionText: `Loan A is a ${2 * half}-month loan at ${nom(j, 12)}. It is repaid with payments of ${a1 === 1 ? "$m$" : `${a1}$m$`} at the end of each of the first ${half} months, followed by payments of ${a2 === 1 ? "$m$" : `${a2}$m$`} at the end of each of the last ${half} months.
Loan B is also a ${2 * half}-month loan at the same rate. It is repaid with payments of ${b1 === 1 ? "$m$" : `${b1}$m$`} at the beginning of each of the first ${half} months, followed by payments of ${b2 === 1 ? "$m$" : `${b2}$m$`} at the beginning of each of the last ${half} months.
Calculate the ratio of the amount of Loan A to the amount of Loan B.`,
          variables: { variant: "RATIO", half, j, a1, a2, b1, b2 },
          correctValue: ratio,
          format: "AMOUNT_3",
          distractors: [
            distractor((a1 * an(half, r) + a2 * v(r, half) * an(half, r)) / (b1 * an(half, r) + b2 * v(r, half) * an(half, r)), "ANNUITY_DUE_CONFUSION", "Valued Loan B's payments at the end of each month."),
            distractor((a1 + a2) / (b1 + b2), "SIMPLE_INTEREST_ERROR", "Compared the undiscounted payments."),
            distractor((a1 * an(half, r) + a2 * an(half, r)) / (b1 * adue(half, r) + b2 * adue(half, r)), "OFF_BY_ONE_PERIOD", "Did not defer the second block of payments."),
          ],
          solutionSteps: `**Step 1 — Loan A.** At $${dec(r, 4)}$ per month: $m\\left[${a1}\\,a_{\\overline{${half}}|} + ${a2}\\,v^{${half}}a_{\\overline{${half}}|}\\right] = ${dec(loanA, 4)}m$.

**Step 2 — Loan B.** $m\\left[${b1}\\,\\ddot{a}_{\\overline{${half}}|} + ${b2}\\,v^{${half}}\\ddot{a}_{\\overline{${half}}|}\\right] = ${dec(loanB, 4)}m$.

**Step 3 — Ratio.** $${dec(loanA, 4)}/${dec(loanB, 4)} = ${dec(ratio, 4)}$.`,
          checks: [{ label: "ratio positive", ok: ratio > 0 }],
        };
      }
      const L = gridAmount(rng, 100000, 400000, 5000);
      const n1 = rng.choice([120, 180]);
      const n2 = 2 * n1;
      const jTrue = gridRate(rng, 0.04, 0.08, 0.0025);
      const R1 = Math.round(L / an(n1, jTrue / 12));
      const r = solve((rate) => R1 * an(n1, rate) - L, 1e-6, 0.05);
      const X = L / adue(n2, r);
      return {
        questionText: `A home buyer borrows ${n(L)} and has two options to repay the loan, both at an annual nominal interest rate of $i$, convertible monthly:
Option 1: level payments of ${n(R1)} at the end of each month for ${n1} months.
Option 2: level payments of $X$ at the beginning of each month for ${n2} months.
Calculate $X$.`,
        variables: { variant: "EQUIVALENT", L, n1, n2, R1 },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(L / an(n2, r), "ANNUITY_DUE_CONFUSION", "Valued option 2 as payments at the end of each month."),
          distractor(R1 / 2, "SIMPLE_INTEREST_ERROR", "Halved the payment because the term doubles."),
          distractor((R1 * an(n1, r)) / adue(n2, r) * (1 + r), "OFF_BY_ONE_PERIOD", "Accumulated the loan by a month before spreading it."),
          distractor(L / an(n2, r) / (1 + r) / (1 + r), "ANNUITY_DUE_CONFUSION", "Discounted the option 2 payments twice."),
        ],
        solutionSteps: `**Step 1 — Rate from option 1.** $${mn(R1)}\\,a_{\\overline{${n1}}|j} = ${mn(L)}$ gives $j = ${dec(r, 6)}$ per month.

**Step 2 — Option 2.** $X\\,\\ddot{a}_{\\overline{${n2}}|j} = ${mn(L)}$ with $\\ddot{a}_{\\overline{${n2}}|} = ${dec(adue(n2, r), 4)}$.

**Step 3 — Solve.** $X = ${mn(L)}/${dec(adue(n2, r), 4)} = ${mn(X, 2)}$.`,
        checks: [{ label: "longer term gives smaller payment", ok: X < R1 }],
      };
    },
  },

  {
    id: "FM_LOAN_REFINANCE_SUM_OF_PAYMENTS",
    domain: LOANS,
    title: "Total Payments after Refinancing Midway",
    objective: "Refinance an outstanding balance at a new rate and total all payments made.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [439],
    generate: (rng: Rng) => {
      const [borrower] = cast(rng);
      const L = gridAmount(rng, 10000, 50000, 1000);
      const years = rng.choice([20, 30, 40]);
      const after = years / 2;
      const i1 = gridRate(rng, 0.06, 0.1, 0.01);
      const i2 = gridRate(rng, 0.03, i1 - 0.01, 0.01);
      const newYears = rng.choice([10, 15, 20].filter((term) => term <= after + 5));
      const R1 = L / an(years, i1);
      const B = R1 * an(years - after, i1);
      const R2 = B / an(newYears, i2);
      const total = after * R1 + newYears * R2;
      return {
        questionText: `${borrower} borrows ${n(L)} at ${eff(i1)} and agrees to repay it with level end-of-year payments for ${years} years.
Immediately after the ${ord(after)} payment, ${borrower} repays the remaining balance by taking out a new loan at ${eff(i2)}, repaid with level end-of-year payments for ${newYears} years.
Calculate the sum of all ${after + newYears} payments made by ${borrower}.`,
        variables: { L, years, after, i1, i2, newYears },
        correctValue: total,
        format: "AMOUNT_0",
        distractors: [
          distractor(years * R1, "CALCULATION_DISTRACTOR", "Ignored the refinancing."),
          distractor(after * R1 + newYears * (B / an(newYears, i1)), "CALCULATION_DISTRACTOR", "Refinanced at the original rate."),
          distractor(after * R1 + B, "CALCULATION_DISTRACTOR", "Added the refinanced balance instead of its payments."),
          distractor(after * R1 + newYears * ((R1 * an(years - after + 1, i1)) / an(newYears, i2)), "OFF_BY_ONE_PERIOD", "Used the balance before the refinancing payment."),
        ],
        solutionSteps: `**Step 1 — Original payment and balance.** $R_1 = ${mn(L)}/a_{\\overline{${years}}|${mpc(i1)}} = ${mn(R1, 4)}$; after ${after} payments the balance is $${mn(R1, 4)}\\,a_{\\overline{${years - after}}|} = ${mn(B, 2)}$.

**Step 2 — New payment.** $R_2 = ${mn(B, 2)}/a_{\\overline{${newYears}}|${mpc(i2)}} = ${mn(R2, 4)}$.

**Step 3 — Total.** $${after}(${mn(R1, 4)}) + ${newYears}(${mn(R2, 4)}) = ${mn(total, 2)}$.`,
        checks: [{ label: "refinancing lowers the rate", ok: R2 * an(newYears, i2) > 0 }],
      };
    },
  },

  {
    id: "FM_LOAN_LAST_INTEREST_TO_FIRST_PRINCIPAL",
    domain: LOANS,
    title: "Principal in the First Payment from Interest in the Last",
    objective: "Use the interest portion of the final level payment to recover the payment and the first principal portion.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    soaSamples: [401],
    generate: (rng: Rng) => {
      const [borrower] = cast(rng);
      const L = gridAmount(rng, 5000, 30000, 50);
      const i = gridRate(rng, 0.04, 0.09, 0.005);
      const years = rng.int(15, 40);
      const R = L / an(years, i);
      const last = cents(R * (1 - v(i, 1)));
      const Rgiven = (last * (1 + i)) / i;
      const principal = Rgiven - i * L;
      return {
        questionText: `${borrower} borrows ${n(L)} at ${eff(i)}. Level payments are made at the end of each year. The interest paid in the last payment is ${n(last, 2)}.
Calculate the principal repaid in the first payment.`,
        variables: { L, i, last },
        correctValue: principal,
        format: "AMOUNT_2",
        distractors: [
          distractor(last / i - i * L, "CALCULATION_DISTRACTOR", "Took the payment to be $I_n/i$ rather than $I_n/(iv)$."),
          distractor(Rgiven * v(i, 1), "CALCULATION_DISTRACTOR", "Reported the principal in the last payment."),
          distractor(Rgiven - last, "CALCULATION_DISTRACTOR", "Subtracted the last payment's interest instead of the first."),
          distractor((last * (1 + i)) / i - i * L * (1 + i), "OFF_BY_ONE_PERIOD", "Accumulated the loan a year before charging interest."),
        ],
        solutionSteps: `**Step 1 — Level payment.** The last payment's interest is $R(1 - v) = Rd$, so $R = ${mn(last, 2)}/d = ${mn(last, 2)} \\times \\dfrac{${dec(1 + i, 3)}}{${dec(i, 3)}} = ${mn(Rgiven, 4)}$.

**Step 2 — First principal portion.** $R - iL = ${mn(Rgiven, 4)} - ${dec(i, 3)}(${mn(L)}) = ${mn(principal, 2)}$.`,
        checks: [{ label: "principal positive", ok: principal > 0 }],
      };
    },
  },

  {
    id: "FM_LOAN_LUMP_VS_LEVEL_INTEREST",
    domain: LOANS,
    title: "Interest Paid: Lump Sum versus Level Payments",
    objective: "Compare the interest paid under lump-sum repayment and under level payments to find the loan amount.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    soaSamples: [255],
    generate: (rng: Rng) => {
      const [borrower] = cast(rng);
      const i = gridRate(rng, 0.03, 0.08, 0.005);
      const N = rng.choice([10, 15, 20]);
      const term = rng.choice([5, 10].filter((t) => t < N));
      const D = gridAmount(rng, 500, 5000, 500);
      const perUnit = acc(i, N) - 1 - (term / an(term, i) - 1);
      const X = D / perUnit;
      return {
        questionText: `${borrower} borrows $X$ at ${eff(i)}. If the principal and all accumulated interest were paid in one lump sum at the end of ${N} years, ${n(D)} more in interest would be paid than if the loan were repaid with level payments at the end of each of the first ${word(term)} years.
Calculate $X$.`,
        variables: { i, N, term, D },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(D / (acc(i, N) - 1), "CALCULATION_DISTRACTOR", "Ignored the interest paid under the level-payment option."),
          distractor(D / (i * N - (term / an(term, i) - 1)), "SIMPLE_INTEREST_ERROR", "Used simple interest for the lump sum."),
          distractor(D / (acc(i, N) - 1 - i * term), "CALCULATION_DISTRACTOR", "Used interest-only payments for the second option."),
          distractor(D / (acc(i, N) - 1 - (term / adue(term, i) - 1)), "ANNUITY_DUE_CONFUSION", "Valued the level payments as an annuity-due."),
        ],
        solutionSteps: `**Step 1 — Interest per unit borrowed.** Lump sum: $(1+i)^{${N}} - 1 = ${dec(acc(i, N) - 1, 6)}$. Level payments: $\\dfrac{${term}}{a_{\\overline{${term}}|}} - 1 = ${dec(term / an(term, i) - 1, 6)}$.

**Step 2 — Solve.** $X(${dec(acc(i, N) - 1, 6)} - ${dec(term / an(term, i) - 1, 6)}) = ${mn(D)}$, so $X = ${mn(X, 2)}$.`,
        checks: [{ label: "positive difference per unit", ok: perUnit > 0 }],
      };
    },
  },

  {
    id: "FM_LOAN_LAST_PAYMENT_DATE",
    domain: LOANS,
    title: "Date of the Final Payment after Extra Payments or Refinancing",
    objective: "Run a monthly loan schedule through extra payments or a refinancing and find the calendar date of the last payment.",
    difficulty: 4,
    topics: ["LOAN_MECHANICS"],
    steps: 4,
    soaSamples: [89, 133],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const [borrower] = cast(rng);
      const startYear = rng.int(2003, 2015);
      const startMonth = rng.choice([0, 6]);
      let lastIndex: number;
      let naiveIndex: number;
      let text: string;
      let solution: string;
      let variables: Record<string, number>;
      if (rng.next() < 0.5) {
        const L = gridAmount(rng, 100000, 300000, 10000);
        const years = rng.choice([20, 25, 30]);
        const j = gridRate(rng, 0.04, 0.07, 0.005);
        const r = j / 12;
        const R = L / an(12 * years, r);
        const extra = gridAmount(rng, 5000, 20000, 5000);
        const extraYears = rng.choice([3, 5]);
        let bal = L;
        let month = 0;
        for (;;) {
          month += 1;
          bal *= 1 + r;
          const calendarMonth = (startMonth + month - 1) % 12;
          const extraNow = calendarMonth === 11 && month <= 12 * extraYears + (11 - startMonth) ? extra : 0;
          if (bal <= R + extraNow + 1e-9) break;
          bal -= R + extraNow;
        }
        lastIndex = startMonth + month - 1;
        naiveIndex = startMonth + 12 * years - 1;
        variables = { L, years, j, extra, extraYears, startYear, startMonth };
        text = `On ${MONTHS[startMonth]} 1, ${startYear}, ${borrower} took out a ${years}-year mortgage of ${n(L)} at ${nom(j, 12)}, repaid by level end-of-month payments with the first payment on ${monthEnd(startYear, startMonth)}.
${borrower} repaid an extra ${n(extra)}, in addition to the regular payment, on each December 31 in the years ${startYear} through ${startYear + extraYears - 1}.
Determine the date on which ${borrower} will make the last payment, which is a drop payment.`;
        solution = `**Step 1 — Regular payment.** $${mn(L)}/a_{\\overline{${12 * years}}|${dec(r, 5)}} = ${mn(R, 2)}$.

**Step 2 — Track the balance.** Run the schedule month by month at $${dec(r, 5)}$, subtracting ${n(R, 2)} each month and an extra ${n(extra)} with each December payment from ${startYear} to ${startYear + extraYears - 1}.

**Step 3 — Remaining term.** After the last extra payment the balance is repaid by level payments; counting them shows the balance first falls below one regular payment ${month} months after the loan was made.

**Step 4 — Date.** The drop payment is the ${ord(month)} payment, made on **${monthEnd(startYear, lastIndex)}**.`;
      } else {
        const L = gridAmount(rng, 50000, 150000, 5000);
        const years = rng.choice([15, 20, 25]);
        const j1 = gridRate(rng, 0.05, 0.08, 0.005);
        const r1 = j1 / 12;
        const R1 = L / an(12 * years, r1);
        const made = 12 * rng.choice([3, 4, 5]);
        const B = R1 * an(12 * years - made, r1);
        const j2 = gridRate(rng, 0.03, j1 - 0.005, 0.001);
        const r2 = j2 / 12;
        // The new payment must comfortably exceed a month's interest, or the loan never ends.
        const P = drawUntil(
          () => Math.round((R1 * rng.choice([0.6, 0.7, 0.8, 0.9])) / 50) * 50,
          (payment) => payment > 1.25 * B * r2,
          Math.ceil((1.5 * B * r2) / 50) * 50
        );
        const nStar = termFor(B, P, r2);
        const count = Math.ceil(nStar);
        lastIndex = startMonth + made - 1 + count;
        naiveIndex = startMonth + 12 * years - 1;
        variables = { L, years, j1, made, j2, P, startYear, startMonth };
        text = `${borrower} took out a ${years}-year loan of ${n(L)} on ${MONTHS[startMonth]} 1, ${startYear}, at ${nom(j1, 12)}, repaid by level payments at the end of each month with the first payment on ${monthEnd(startYear, startMonth)}.
Right after the regular payment on ${monthEnd(startYear, startMonth + made - 1)}, ${borrower} refinanced the loan at ${nom(j2, 12)}. The remaining balance will be repaid with monthly payments beginning ${monthEnd(startYear, startMonth + made)}. Each payment is ${n(P)}, except for a final drop payment.
Determine the date of ${borrower}'s last payment.`;
        solution = `**Step 1 — Original payment.** $${mn(L)}/a_{\\overline{${12 * years}}|${dec(r1, 5)}} = ${mn(R1, 2)}$.

**Step 2 — Balance at refinancing.** After ${made} payments: $${mn(R1, 2)}\\,a_{\\overline{${12 * years - made}}|} = ${mn(B, 2)}$.

**Step 3 — New term.** $${mn(P)}\\,a_{\\overline{n}|${dec(r2, 5)}} = ${mn(B, 2)}$ gives $n = ${dec(nStar, 2)}$, so ${count} payments including the drop payment.

**Step 4 — Date.** The ${ord(count)} new payment falls on **${monthEnd(startYear, lastIndex)}**.`;
      }
      const correct = { text: monthEnd(startYear, lastIndex), sortKey: lastIndex };
      const wrong = [
        { text: monthEnd(startYear, lastIndex - 1), sortKey: lastIndex - 1, explanation: "One payment too few: the drop payment comes after the last full payment." },
        { text: monthEnd(startYear, lastIndex + 1), sortKey: lastIndex + 1, explanation: "One month too late: that would be a further payment." },
        { text: monthEnd(startYear, lastIndex - 2), sortKey: lastIndex - 2, explanation: "Miscounted the months from the first payment date." },
        { text: monthEnd(startYear, lastIndex + 2), sortKey: lastIndex + 2, explanation: "Miscounted the months from the first payment date." },
        { text: monthEnd(startYear, lastIndex + 12), sortKey: lastIndex + 12, explanation: "A year too late." },
        { text: monthEnd(startYear, lastIndex - 12), sortKey: lastIndex - 12, explanation: "A year too early." },
        { text: monthEnd(startYear, naiveIndex), sortKey: naiveIndex, explanation: "The original maturity date, ignoring the change to the schedule." },
      ];
      const choices = orderedChoices(rng, correct, wrong);
      return {
        kind: "CHOICE",
        questionText: text,
        variables,
        choices,
        fixedOrder: true,
        solutionSteps: solution,
        checks: [{ label: "a real payoff date", ok: Number.isFinite(lastIndex) && lastIndex > 0 }],
      };
    },
  },

  {
    id: "FM_LOAN_CONCEPT_AMORTIZATION",
    domain: LOANS,
    title: "Properties of an Amortization Schedule",
    objective: "Recognise the standard relationships in an amortization schedule with level payments.",
    difficulty: 1,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    qualitative: true,
    soaSamples: [364, 23, 64],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const pairs: StatementPair[] = [
        { truth: "The total interest paid equals $n - a_{\\overline{n}|}$.", falsehood: "The total interest paid equals $n\\,i\\,a_{\\overline{n}|}$.", why: "The payments total $n$ and repay principal $a_{\\overline{n}|}$; the rest is interest." },
        { truth: "The principal repaid in payment $t$ equals $v^{n-t+1}$.", falsehood: "The principal repaid in payment $t$ equals $v^{n-t}$.", why: "Payment $t$ has $n - t + 1$ periods to run, so its principal is $v^{n-t+1}$." },
        { truth: "The interest paid in payment $t$ equals $1 - v^{n-t+1}$.", falsehood: "The interest paid in payment $t$ equals $1 - v^{n-t}$.", why: "Interest is $i$ times the balance $a_{\\overline{n-t+1}|}$, which is $1 - v^{n-t+1}$." },
        { truth: "The outstanding balance just after payment $t$ equals $a_{\\overline{n-t}|}$.", falsehood: "The outstanding balance just after payment $t$ equals $a_{\\overline{n-t+1}|}$.", why: "Prospectively, $n - t$ payments of 1 remain." },
        { truth: "The total principal repaid equals $a_{\\overline{n}|}$.", falsehood: "The total principal repaid equals $n - i\\,a_{\\overline{n}|}$.", why: "The principal repaid is the loan amount, $a_{\\overline{n}|}$." },
        { truth: "Successive principal portions increase by a factor of $1 + i$.", falsehood: "Successive principal portions decrease by a factor of $v$.", why: "$v^{n-t}/v^{n-t+1} = 1 + i$." },
        { truth: "The interest paid in payment $t$ plus the principal repaid in payment $t + 1$ equals $1 + v^{n-t}d$.", falsehood: "The interest paid in payment $t$ plus the principal repaid in payment $t + 1$ equals $1 + v^{n-t}i$.", why: "$(1 - v^{n-t+1}) + v^{n-t} = 1 + v^{n-t}(1 - v) = 1 + v^{n-t}d$." },
        { truth: "The balance just after payment $t$ equals $(1+i)^t a_{\\overline{n}|} - s_{\\overline{t}|}$.", falsehood: "The balance just after payment $t$ equals $(1+i)^t a_{\\overline{n}|} - \\ddot{s}_{\\overline{t}|}$.", why: "Retrospectively, the loan accumulates for $t$ periods less the accumulated payments made at the ends of periods." },
      ];
      const { questionText, choices, solutionSteps } = oneOfFive(rng, {
        lead: "Consider an amortization schedule for a loan at interest rate $i$ per period, $i > 0$, repaid with payments of 1 at the end of each period for $n$ periods.",
        pairs,
        askFalse: rng.next() < 0.4,
      });
      return { kind: "CHOICE", questionText, variables: {}, choices, solutionSteps };
    },
  },

  {
    id: "FM_LOAN_CONCEPT_EQUATION_OF_VALUE",
    domain: LOANS,
    title: "Choosing the Equation of Value for a Loan Schedule",
    objective: "Match a loan repayment schedule with extra or stepped payments to a correctly timed equation of value.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    qualitative: true,
    soaSamples: [168, 388],
    generate: (rng: Rng): GeneratedChoiceQuestionItem => {
      const aSym = (term: number | string) => `a_{\\overline{${term}}|}`;
      const sSym = (term: number | string) => `s_{\\overline{${term}}|}`;
      if (rng.next() < 0.5) {
        // The schedule implies the rate; draw until it is a sensible one.
        const { R, E, nYears, k1, k2, c, i } = drawUntil(
          () => {
            const R = gridAmount(rng, 50, 500, 10);
            const E = gridAmount(rng, 20, 300, 10);
            const nYears = rng.choice([15, 20]);
            const k1 = rng.int(4, 8);
            const k2 = k1 + rng.int(3, 5);
            const c = k2 - k1 + 1;
            const i = trySolve((rate) => R * an(nYears, rate) - R * an(k2, rate) - E * v(rate, k1 - 1) * an(c, rate), 1e-4, 1);
            return { R, E, nYears, k1, k2, c, i };
          },
          (p) => Number.isFinite(p.i) && p.i > 0.01 && p.i < 0.15,
          { R: 50, E: 30, nYears: 15, k1: 6, k2: 10, c: 5, i: 0.0 }
        );
        const eq = (rate: number) => R * an(nYears, rate) - R * an(k2, rate) - E * v(rate, k1 - 1) * an(c, rate);
        const safe = i > 0 ? i : solve(eq, 1e-4, 1);
        const cands = [
          { latex: `${R}\\,v^{${nYears - k2}}${sSym(nYears)} = ${R}\\,${sSym(k2)} + ${E}\\,${sSym(c)}`, value: R * v(safe, nYears - k2) * sn(nYears, safe) - R * sn(k2, safe) - E * sn(c, safe), why: `Valued at time ${k2}: the remaining scheduled payments equal the regular and extra payments actually made.` },
          { latex: `${R}\\,${aSym(nYears)} = ${R}\\,${aSym(k2)} + ${E}\\,${aSym(c)}`, value: R * an(nYears, safe) - R * an(k2, safe) - E * an(c, safe), why: `The extra payments start at time ${k1}, so they need a deferral factor $v^{${k1 - 1}}$.` },
          { latex: `${R}\\,${sSym(nYears)} = ${R}\\,${sSym(k2)} + ${E}\\,${sSym(c)}`, value: R * sn(nYears, safe) - R * sn(k2, safe) - E * sn(c, safe), why: "The two sides are accumulated to different dates." },
          { latex: `${R}\\,${sSym(nYears)} = ${R}\\,v^{${nYears - k2}}${sSym(k2)} + ${E}\\,${sSym(c)}`, value: R * sn(nYears, safe) - R * v(safe, nYears - k2) * sn(k2, safe) - E * sn(c, safe), why: "Discounts the wrong side." },
          { latex: `${R}\\,${sSym(nYears)} = ${R}\\,${sSym(k2)} + ${E}(1+i)\\,${sSym(c)}`, value: R * sn(nYears, safe) - R * sn(k2, safe) - E * (1 + safe) * sn(c, safe), why: "Accumulates the extra payments one period too long and mismatches the dates." },
          { latex: `${R}\\,${aSym(nYears)} = ${R}\\,${aSym(k2)} + ${E}\\,v^{${k1}}${aSym(c)}`, value: R * an(nYears, safe) - R * an(k2, safe) - E * v(safe, k1) * an(c, safe), why: "Defers the extra payments one period too long." },
        ];
        const keyIndex = rng.next() < 0.6 ? 0 : -1;
        const key = keyIndex === 0 ? cands[0] : { latex: `${R}\\,${aSym(nYears)} = ${R}\\,${aSym(k2)} + ${E}\\,v^{${k1 - 1}}${aSym(c)}`, value: eq(safe), why: `Valued at time 0: the extra payments form an annuity deferred ${k1 - 1} years.` };
        const wrongs = rng.shuffle(cands.slice(1)).filter((item) => Math.abs(item.value) > 1e-6).slice(0, 4);
        const choices: AuthoredChoice[] = [
          { text: `$${key.latex}$`, isCorrect: true, explanation: key.why },
          ...wrongs.map((item) => ({ text: `$${item.latex}$`, isCorrect: false, type: "OFF_BY_ONE_PERIOD" as const, explanation: item.why })),
        ];
        return {
          kind: "CHOICE",
          questionText: `A borrower takes out a ${nYears}-year loan at an annual effective interest rate of $i$, with payments of ${n(R)} at the end of each year.
The borrower pays the loan off early by making extra payments of ${n(E)} with each of the ${ord(k1)} through ${ord(k2)} regularly scheduled payments. As a result, the loan is paid off at the end of ${k2} years instead of ${nYears}.
Determine which of the following equations of value is correct.`,
          variables: { R, E, nYears, k1, k2 },
          choices,
          solutionSteps: `**Step 1 — What must balance.** The loan equals the present value of the scheduled payments, $${R}\\,${aSym(nYears)}$, and also of the payments actually made: ${k2} regular payments and extra payments at times ${k1} through ${k2}.

**Step 2 — The matching equation.** ${key.why} $$${key.latex}.$$`,
          checks: [
            { label: "the key holds at the implied rate", ok: Math.abs(key.value) < 1e-6 * R },
            { label: "every wrong equation fails", ok: wrongs.length === 4 },
          ],
        };
      }
      const L = gridAmount(rng, 10000, 50000, 5000);
      const n1 = rng.choice([24, 30, 36]);
      const n2 = rng.choice([36, 40, 48]);
      const n3 = rng.choice([48, 50, 60]);
      const [f2, f3] = rng.choice([[1.1, 1.2], [1.2, 1.4], [1.5, 2]] as const);
      const j = gridRate(rng, 0.048, 0.084, 0.012);
      const r = j / 12;
      const rate = dec(r, 3).replace(/0+$/, "");
      const aR = (term: number) => `a_{\\overline{${term}}|${rate}}`;
      const aDueR = (term: number) => `\\ddot{a}_{\\overline{${term}}|${rate}}`;
      const P = L / (an(n1, r) + f2 * v(r, n1) * an(n2, r) + f3 * v(r, n1 + n2) * an(n3, r));
      const lhs = (value: number) => L - value;
      const cands = [
        { latex: `${mn(L)} = P\\,${aR(n1)} + ${f2}P\\,(1.${rate.slice(2)})^{-${n1}}${aR(n2)} + ${f3}P\\,(1.${rate.slice(2)})^{-${n1 + n2}}${aR(n3)}`, value: lhs(P * (an(n1, r) + f2 * v(r, n1) * an(n2, r) + f3 * v(r, n1 + n2) * an(n3, r))), why: `Each block is valued at its start and discounted: the second block starts after ${n1} months, the third after ${n1 + n2}.` },
        { latex: `${mn(L)} = P\\,${aR(n1)} + ${f2}P\\,${aR(n2)} + ${f3}P\\,${aR(n3)}`, value: lhs(P * (an(n1, r) + f2 * an(n2, r) + f3 * an(n3, r))), why: "Does not defer the later blocks." },
        { latex: `${mn(L)} = P\\,${aR(n1)} + ${f2}P\\,(1.${rate.slice(2)})^{-${n1}}${aR(n2)} + ${f3}P\\,(1.${rate.slice(2)})^{-${n2}}${aR(n3)}`, value: lhs(P * (an(n1, r) + f2 * v(r, n1) * an(n2, r) + f3 * v(r, n2) * an(n3, r))), why: `Defers the third block by ${n2} months instead of ${n1 + n2}.` },
        { latex: `${mn(L)} = P\\,${aDueR(n1)} + ${f2}P\\,(1.${rate.slice(2)})^{-${n1}}${aDueR(n2)} + ${f3}P\\,(1.${rate.slice(2)})^{-${n1 + n2}}${aDueR(n3)}`, value: lhs(P * (1 + r) * (an(n1, r) + f2 * v(r, n1) * an(n2, r) + f3 * v(r, n1 + n2) * an(n3, r))), why: "Treats the payments as made at the start of each month." },
        { latex: `${mn(L)} = P\\,${aR(n1)} + ${f2}P\\,(1.${rate.slice(2)})^{-${n1 + 1}}${aR(n2)} + ${f3}P\\,(1.${rate.slice(2)})^{-${n1 + n2 + 1}}${aR(n3)}`, value: lhs(P * (an(n1, r) + f2 * v(r, n1 + 1) * an(n2, r) + f3 * v(r, n1 + n2 + 1) * an(n3, r))), why: "Defers each later block one month too long." },
      ];
      const choices: AuthoredChoice[] = cands.map((item, idx) => ({
        text: `$${item.latex}$`,
        isCorrect: idx === 0,
        type: idx === 0 ? undefined : ("OFF_BY_ONE_PERIOD" as const),
        explanation: item.why,
      }));
      return {
        kind: "CHOICE",
        questionText: `A borrower takes out a ${n1 + n2 + n3}-month loan of ${n(L)} today. The loan is repaid with end-of-month payments of $P$ for each of the first ${n1} months, ${f2}$P$ for each of the next ${n2} months, and ${f3}$P$ for each of the final ${n3} months.
The payments are based on ${nom(j, 12)}.
Determine which of the following is an equation of value that can be used to calculate $P$.`,
        variables: { L, n1, n2, n3, f2, f3, j },
        choices,
        solutionSteps: `**Step 1 — Value each block at its own start.** Each block of level payments is an annuity-immediate at $${rate}$ per month.

**Step 2 — Discount to today.** ${cands[0].why} $$${cands[0].latex}.$$`,
        checks: [
          { label: "the key holds", ok: Math.abs(cands[0].value) < 1e-6 * L },
          { label: "every wrong equation fails", ok: cands.slice(1).every((item) => Math.abs(item.value) > 1e-3) },
        ],
      };
    },
  },
];
