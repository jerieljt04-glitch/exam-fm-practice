/**
 * Loans: amortization, outstanding balances, principal and interest portions,
 * refinancing and reamortization — modelled on the SOA sample-set question
 * types for the loans section of the syllabus.
 */
import type { Rng } from "../../random";
import { distractor, type GeneratedQuestionItem, type QuestionTemplateDefinition } from "../types";
import {
  acc,
  adue,
  amt,
  an,
  cast,
  close,
  dec,
  drawUntil,
  eff,
  gridAmount,
  gridRate,
  mamt,
  mn,
  mpc,
  n,
  nom,
  ord,
  pc,
  sn,
  solve,
  trySolve,
  v,
  word,
} from "./kit";

const LOANS = "LOANS" as const;

/** Round to the cent, as a stated payment would be. */
const cents = (value: number) => Math.round(value * 100) / 100;

/** Retrospective balance after k level payments. */
function retro(L: number, R: number, r: number, k: number): number {
  return L * acc(r, k) - R * sn(k, r);
}

/** Number of level payments R that a principal B supports at rate r (real-valued). */
function termFor(B: number, R: number, r: number): number {
  return -Math.log(1 - (B * r) / R) / Math.log(1 + r);
}

export const SOA_LOAN_TEMPLATES: QuestionTemplateDefinition[] = [
  {
    id: "FM_LOAN_BALANCE_AFTER_K",
    domain: LOANS,
    title: "Outstanding Balance after a Number of Payments",
    objective: "Compute an outstanding loan balance retrospectively from the stated payment.",
    difficulty: 1,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    soaSamples: [462, 212],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const [borrower] = cast(rng);
      if (rng.next() < 0.25) {
        const L = gridAmount(rng, 5000, 50000, 1000);
        const i = gridRate(rng, 0.06, 0.12, 0.01);
        const R = Math.round((L * i * rng.choice([0.7, 0.75, 0.8, 0.85])) / 50) * 50;
        const k = rng.int(8, 15);
        const B = retro(L, R, i, k);
        return {
          questionText: `Payments of ${n(R)} at the end of each year are made on a loan of ${n(L)}. The payments are based on ${eff(i)}.
Calculate the outstanding loan balance immediately after the ${ord(k)} payment.`,
          variables: { L, R, i, k },
          correctValue: B,
          format: "AMOUNT_0",
          distractors: [
            distractor(L + k * (L * i - R), "SIMPLE_INTEREST_ERROR", "Added the annual shortfall of interest without compounding it."),
            distractor(L * acc(i, k) - R * sn(k, i) * (1 + i), "ANNUITY_DUE_CONFUSION", "Accumulated the payments as if made at the start of each year."),
            distractor(retro(L, R, i, k - 1), "OFF_BY_ONE_PERIOD", `Stopped after ${k - 1} payments.`),
            distractor(L - R * k + L * i * k * 0.5, "SIMPLE_INTEREST_ERROR", "Charged interest on the average balance only."),
          ],
          solutionSteps: `**Step 1 — Interest exceeds the payment.** Interest in the first year is $${mn(L)}(${dec(i, 2)}) = ${mn(L * i)}$, more than the payment of ${n(R)}, so the balance grows.

**Step 2 — Retrospective balance.**
$$${mn(L)}(${dec(1 + i, 2)})^{${k}} - ${mn(R)}\\,s_{\\overline{${k}}|${mpc(i)}} = ${mn(L * acc(i, k), 2)} - ${mn(R * sn(k, i), 2)} = ${mn(B, 2)}.$$`,
          checks: [{ label: "balance grows", ok: B > L }],
        };
      }
      const m = rng.choice([1, 2, 4, 12]);
      const years = m === 12 ? rng.choice([5, 10, 15, 20, 30]) : rng.choice([10, 15, 20, 25]);
      const count = m * years;
      const j = gridRate(rng, 0.03, 0.09, 0.0025);
      const r = j / m;
      const L = m === 12 ? gridAmount(rng, 50000, 400000, 5000) : gridAmount(rng, 10000, 5000000, 10000);
      const R = cents(L / an(count, r));
      const k = rng.int(Math.round(count * 0.2), Math.round(count * 0.8));
      const B = retro(L, R, r, k);
      const every = m === 1 ? "each year" : m === 2 ? "every six months" : m === 4 ? "each quarter" : "each month";
      return {
        questionText: `${borrower} takes out a loan of ${n(L)} to be repaid with level payments of ${n(R, 2)} at the end of ${every}, with the first payment due ${m === 1 ? "in one year" : m === 2 ? "in six months" : m === 4 ? "in three months" : "in one month"}.
The payments are based on ${m === 1 ? eff(j) : nom(j, m)}.
Calculate the outstanding loan balance immediately after the ${ord(k)} payment.`,
        variables: { L, R, j, m, k, count },
        correctValue: B,
        format: "AMOUNT_0",
        distractors: [
          distractor(R * an(count - k + 1, r), "OFF_BY_ONE_PERIOD", `Valued ${count - k + 1} remaining payments; ${count - k} remain after the ${ord(k)}.`),
          distractor(L - k * (R - r * L), "SIMPLE_INTEREST_ERROR", "Assumed every payment repays as much principal as the first."),
          distractor(L * acc(r, k) - R * sn(k, r) * (1 + r), "ANNUITY_DUE_CONFUSION", "Accumulated the payments one period too long."),
          distractor(retro(L, R, Math.pow(1 + j, 1 / m) - 1, k), "NOMINAL_RATE_ERROR", `Treated ${pc(j)} as an annual effective rate.`),
        ],
        solutionSteps: `**Step 1 — Rate per payment period.** ${m === 1 ? `$i = ${dec(j, 4)}$.` : `$${dec(j, 4)}/${m} = ${dec(r, 6)}$.`}

**Step 2 — Retrospective balance.** The loan accumulated for ${k} periods less the accumulated payments:
$$${mn(L)}(1 + ${dec(r, 6)})^{${k}} - ${mn(R, 2)}\\,s_{\\overline{${k}}|} = ${mn(L * acc(r, k), 2)} - ${mn(R * sn(k, r), 2)} = ${mn(B, 2)}.$$
(Prospectively, $${mn(R, 2)}\\,a_{\\overline{${count - k}}|} = ${mn(R * an(count - k, r), 2)}$; the tiny difference comes from the payment being rounded to the cent.)`,
        checks: [{ label: "retrospective and prospective agree", ok: Math.abs(B - R * an(count - k, r)) < 0.02 * count }],
      };
    },
  },

  {
    id: "FM_LOAN_INTEREST_MULTIPLE_THEN_LEVEL",
    domain: LOANS,
    title: "Payments as a Multiple of Interest, then Level Payments",
    objective: "Track a balance reduced by payments set as a multiple of the interest due, then amortize the rest with level payments.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [6, 125],
    generate: (rng: Rng) => {
      const [borrower] = cast(rng);
      const L = rng.choice([1000, 10000, 50000, 100000]);
      const i = gridRate(rng, 0.05, 0.1, 0.01);
      const twoPhase = rng.next() < 0.5;
      const n1 = rng.choice([5, 10]);
      const m2 = rng.choice([1.25, 1.5, 2]);
      const n2 = twoPhase ? rng.choice([5, 10]) : 0;
      const n3 = rng.choice([5, 10]);
      const afterFirst = twoPhase ? L : L * Math.pow(1 - (m2 - 1) * i, n1);
      const B = twoPhase ? L * Math.pow(1 - (m2 - 1) * i, n2) : afterFirst;
      const X = B / an(n3, i);
      const total = n1 + n2 + n3;
      const multipleText = (mult: number) => (mult === 1 ? "equals the amount of interest due" : `equals ${Math.round(mult * 100)}% of the amount of interest due`);
      const k = twoPhase ? n2 : n1;
      return {
        questionText: `${borrower} takes out a ${total}-year loan of ${n(L)}, repaid with payments at the end of each year.
${twoPhase ? `Each of the first ${n1} payments ${multipleText(1)}. Each of the next ${n2} payments ${multipleText(m2)}.` : `Each of the first ${n1} payments ${multipleText(m2)}.`} Each of the last ${n3} payments is $X$.
The lender charges ${eff(i)}.
Calculate $X$.`,
        variables: { L, i, n1, m2, n2, n3, twoPhase: twoPhase ? 1 : 0 },
        correctValue: X,
        format: X >= 1000 ? "AMOUNT_0" : "AMOUNT_2",
        distractors: [
          distractor(L / an(n3, i), "CALCULATION_DISTRACTOR", "Ignored the principal repaid by the earlier payments."),
          distractor((L * (1 - k * (m2 - 1) * i)) / an(n3, i), "SIMPLE_INTEREST_ERROR", "Took the principal repaid each year as constant instead of shrinking with the balance."),
          distractor(B / adue(n3, i), "ANNUITY_DUE_CONFUSION", "Amortized the remaining balance as an annuity-due."),
          distractor((L * Math.pow(1 - (m2 - 1) * i, k + 1)) / an(n3, i), "OFF_BY_ONE_PERIOD", "Applied the extra principal for one year too many."),
        ],
        solutionSteps: `**Step 1 — Principal repaid by a payment of $m$ times the interest.** Such a payment is $m\\,i\\,B$, so it repays $(m - 1)iB$ and leaves $B(1 - (m-1)i)$.${twoPhase ? " Interest-only payments leave the balance unchanged." : ""}

**Step 2 — Balance before the level payments.**
$$${mn(L)}\\left(1 - ${dec(m2 - 1, 2)}(${dec(i, 2)})\\right)^{${k}} = ${mn(B, 2)}.$$

**Step 3 — Level payments.** $X = ${mn(B, 2)}/a_{\\overline{${n3}}|${mpc(i)}} = ${mn(B, 2)}/${dec(an(n3, i), 5)} = ${mn(X, 2)}$.`,
        checks: [
          {
            label: "ledger ends at zero",
            ok: (() => {
              let bal = L;
              for (let y = 0; y < n1; y += 1) bal -= (twoPhase ? 0 : (m2 - 1)) * i * bal;
              for (let y = 0; y < n2; y += 1) bal -= (m2 - 1) * i * bal;
              for (let y = 0; y < n3; y += 1) bal = bal * (1 + i) - X;
              return Math.abs(bal) < 1e-6 * L;
            })(),
          },
        ],
      };
    },
  },

  {
    id: "FM_LOAN_LEVEL_VS_PRINCIPAL_PLUS_INTEREST",
    domain: LOANS,
    title: "Level Payments versus Level Principal plus Interest",
    objective: "Compare total payments under amortization and under level principal plus interest, and solve for the second rate.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [12, 250, 289],
    generate: (rng: Rng) => {
      // The level principal repayment L/n is printed, so it must be exact to the cent.
      const { L, years } = drawUntil(
        () => ({ L: rng.choice([1000, 1500, 2000, 5000, 10000]), years: rng.choice([10, 15, 20, 25]) }),
        (p) => Math.abs(Math.round((p.L * 100) / p.years) - (p.L * 100) / p.years) < 1e-9,
        { L: 2000, years: 10 }
      );
      const i1 = gridRate(rng, 0.03, 0.09, 0.0001);
      const R = L / an(years, i1);
      const total = years * R;
      const i = (total - L) / ((L * (years + 1)) / 2);
      const level = L / years;
      return {
        questionText: `A ${years}-year loan of ${n(L)} is repaid with payments at the end of each year. It can be repaid under either of two options:
(i) equal annual payments at ${eff(i1)};
(ii) payments of ${n(level, level % 1 === 0 ? 0 : 2)} each year plus interest on the unpaid balance at an annual effective rate of $i$.
The sum of the payments under option (i) equals the sum of the payments under option (ii).
Calculate $i$.`,
        variables: { L, years, i1 },
        correctValue: i * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(i1 * 100, "CALCULATION_DISTRACTOR", "Assumed the two options must use the same rate."),
          distractor(((total - L) / ((L * years) / 2)) * 100, "OFF_BY_ONE_PERIOD", "Averaged the balances as $n/2$ instead of $(n+1)/2$ times the loan."),
          distractor(((total - L) / (L * years)) * 100, "SIMPLE_INTEREST_ERROR", "Charged interest on the full loan every year."),
          distractor(((total - L) / ((L * (years - 1)) / 2)) * 100, "OFF_BY_ONE_PERIOD", "Summed the balances from the second year only."),
        ],
        solutionSteps: `**Step 1 — Option (i).** The payment is $${mn(L)}/a_{\\overline{${years}}|${mpc(i1, 2)}} = ${mn(R, 4)}$, so the payments total $${years}(${mn(R, 4)}) = ${mn(total, 4)}$.

**Step 2 — Option (ii).** The balances before each payment are ${n(L)}, ${n(L - level)}, ..., ${n(level, 2)}, which sum to $${mn(L)} \\times \\dfrac{${years} + 1}{2} = ${mn((L * (years + 1)) / 2, 2)}$. The payments total $${mn(L)} + ${mn((L * (years + 1)) / 2, 2)}\\,i$.

**Step 3 — Equate.** $i = \\dfrac{${mn(total, 4)} - ${mn(L)}}{${mn((L * (years + 1)) / 2, 2)}} = ${mpc(i, 4)}$.`,
        checks: [
          {
            label: "option (ii) ledger total",
            ok: close(Array.from({ length: years }, (_, k) => level + i * (L - k * level)).reduce((a, b) => a + b, 0), total),
          },
        ],
      };
    },
  },

  {
    id: "FM_LOAN_GEOMETRIC_PAYMENTS_BALANCE",
    domain: LOANS,
    title: "Balance of a Loan with Geometrically Changing Payments",
    objective: "Compute an outstanding balance prospectively when the payments change geometrically.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [13, 287],
    generate: (rng: Rng) => {
      const P1 = gridAmount(rng, 500, 2000, 100);
      const years = rng.choice([4, 5, 6]);
      const count = 12 * years;
      const j = gridRate(rng, 0.06, 0.12, 0.01);
      const r = j / 12;
      // A growth rate equal to the loan rate makes the geometric factor 1; keep them apart.
      const g = rng.choice([-0.02, -0.01, 0.005, 0.01].filter((rate) => Math.abs(rate - r) > 1e-9));
      const k = rng.int(Math.round(count * 0.4), count - 10);
      const payment = (t: number) => P1 * Math.pow(1 + g, t - 1);
      const B = Array.from({ length: count - k }, (_, idx) => payment(k + 1 + idx) * v(r, idx + 1)).reduce((a, b) => a + b, 0);
      const ratio = (1 + g) / (1 + r);
      const direction = g < 0 ? `${pc(-g, 1)} lower` : `${pc(g, 1)} higher`;
      return {
        questionText: `A loan is amortized over ${years} years with monthly payments at ${nom(j, 12)}. The first payment is ${n(P1)}, due one month after the loan is made. Each later monthly payment is ${direction} than the previous payment.
Calculate the outstanding loan balance immediately after the ${ord(k)} payment.`,
        variables: { P1, g, years, j, k },
        correctValue: B,
        format: "AMOUNT_0",
        distractors: [
          distractor(payment(k + 1) * an(count - k, r), "CALCULATION_DISTRACTOR", "Treated the remaining payments as level."),
          distractor(Array.from({ length: count - k + 1 }, (_, idx) => payment(k + idx) * v(r, idx + 1)).reduce((a, b) => a + b, 0), "OFF_BY_ONE_PERIOD", `Included the ${ord(k)} payment among those still to be made.`),
          distractor(B * (1 + r), "ANNUITY_DUE_CONFUSION", "Valued the remaining payments as an annuity-due."),
          distractor(Array.from({ length: count - k }, (_, idx) => P1 * Math.pow(1 - g, k + idx) * v(r, idx + 1)).reduce((a, b) => a + b, 0), "CALCULATION_DISTRACTOR", "Applied the monthly change in the wrong direction."),
        ],
        solutionSteps: `**Step 1 — Work prospectively.** The loan amount is not given, so value the ${count - k} payments still due at $r = ${dec(r, 4)}$ per month.

**Step 2 — The next payment.** The ${ord(k + 1)} payment is $${mn(P1)}(${dec(1 + g, 3)})^{${k}} = ${mn(payment(k + 1), 4)}$.

**Step 3 — Geometric sum.**
$$${mn(payment(k + 1), 4)}\\,v\\cdot\\frac{1 - \\left(\\frac{${dec(1 + g, 3)}}{${dec(1 + r, 4)}}\\right)^{${count - k}}}{1 - \\frac{${dec(1 + g, 3)}}{${dec(1 + r, 4)}}} = ${mn(B, 2)}.$$`,
        checks: [
          {
            label: "closed form",
            ok: close((payment(k + 1) * v(r, 1) * (1 - Math.pow(ratio, count - k))) / (1 - ratio), B),
          },
        ],
      };
    },
  },

  {
    id: "FM_LOAN_THREE_REPAYMENT_METHODS",
    domain: LOANS,
    title: "Interest Paid under Three Repayment Methods",
    objective: "Compare interest paid when a loan is repaid in a lump sum, with interest-only payments, or by amortization.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [21],
    generate: (rng: Rng) => {
      const [a, b, c] = cast(rng, 3);
      const L = gridAmount(rng, 2000, 20000, 1000);
      const years = rng.choice([4, 5, 6, 8]);
      const j = gridRate(rng, 0.06, 0.12, 0.01);
      const m = rng.choice([2, 4]);
      const r = j / m;
      const periods = m * years;
      const lump = L * (acc(r, periods) - 1);
      const interestOnly = L * r * periods;
      const R = L / an(periods, r);
      const amortized = periods * R - L;
      const total = lump + interestOnly + amortized;
      return {
        questionText: `${a}, ${b} and ${c} each borrow ${n(L)} for ${years} years at ${nom(j, m)}.
${a} lets interest accumulate and repays all interest and principal in a lump sum at the end of ${years} years.
${b} pays interest at the end of ${m === 2 ? "every six months" : "each quarter"} as it accrues and repays the principal at the end of ${years} years.
${c} repays the loan with ${periods} level payments at the end of ${m === 2 ? "every six months" : "each quarter"}.
Calculate the total amount of interest paid on all three loans.`,
        variables: { L, years, j, m },
        correctValue: total,
        format: "AMOUNT_0",
        distractors: [
          distractor(L * (acc(j, years) - 1) + L * j * years + (years * (L / an(years, j)) - L), "NOMINAL_RATE_ERROR", "Used the nominal rate as an annual effective rate with annual payments."),
          distractor(lump + interestOnly, "CALCULATION_DISTRACTOR", `Left out ${c}'s interest.`),
          distractor(3 * interestOnly, "SIMPLE_INTEREST_ERROR", "Charged simple interest on every loan."),
          distractor(lump + interestOnly + periods * R, "CALCULATION_DISTRACTOR", `Counted all of ${c}'s payments as interest.`),
        ],
        solutionSteps: `**Step 1 — ${a}.** $${mn(L)}\\left[(1 + ${dec(r, 4)})^{${periods}} - 1\\right] = ${mn(lump, 2)}$.

**Step 2 — ${b}.** $${periods} \\times ${mn(L)}(${dec(r, 4)}) = ${mn(interestOnly, 2)}$.

**Step 3 — ${c}.** The payment is $${mn(L)}/a_{\\overline{${periods}}|} = ${mn(R, 4)}$, so the interest is $${periods}(${mn(R, 4)}) - ${mn(L)} = ${mn(amortized, 2)}$.
The total is $${mn(total, 2)}$.`,
        checks: [{ label: "ordering of interest", ok: lump > interestOnly && interestOnly > amortized }],
      };
    },
  },

  {
    id: "FM_LOAN_PRINCIPAL_FROM_LATER_BALANCE",
    domain: LOANS,
    title: "Principal in a Payment from a Later Balance",
    objective: "Recover the level payment from an outstanding balance and find the principal in an earlier payment.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    soaSamples: [33],
    generate: (rng: Rng) => {
      const [borrower] = cast(rng);
      const years = rng.int(4, 12);
      const i = gridRate(rng, 0.04, 0.1, 0.005);
      const k = rng.int(Math.max(2, years - 4), years - 1);
      const R = gridAmount(rng, 200, 3000, 1);
      const balance = cents(R * an(years - k, i));
      const Rexact = balance / an(years - k, i);
      const t = rng.int(1, Math.min(3, years));
      const principal = Rexact * v(i, years - t + 1);
      return {
        questionText: `${borrower} borrows $X$ for ${word(years)} years at ${eff(i)}, to be repaid with equal payments at the end of each year.
The outstanding loan balance at the end of year ${k} is ${n(balance, 2)}.
Calculate the principal repaid in the ${ord(t)} payment.`,
        variables: { years, i, k, balance, t },
        correctValue: principal,
        format: "AMOUNT_0",
        distractors: [
          distractor(Rexact * (1 - v(i, years - t + 1)), "CALCULATION_DISTRACTOR", "Computed the interest portion instead of the principal."),
          distractor(Rexact * v(i, years - t), "OFF_BY_ONE_PERIOD", `Discounted the payment ${years - t} years instead of ${years - t + 1}.`),
          distractor((balance / an(years - k + 1, i)) * v(i, years - t + 1), "OFF_BY_ONE_PERIOD", `Counted ${years - k + 1} payments remaining at the end of year ${k}.`),
          distractor(Rexact * v(i, years - t + 2), "OFF_BY_ONE_PERIOD", "Discounted the payment one year too many."),
        ],
        solutionSteps: `**Step 1 — Level payment.** ${years - k} payment${years - k === 1 ? "" : "s"} remain after year ${k}, so $R = ${mn(balance, 2)}/a_{\\overline{${years - k}}|${mpc(i)}} = ${mn(Rexact, 4)}$.

**Step 2 — Principal in payment ${t}.** $P_{${t}} = R\\,v^{${years} - ${t} + 1} = ${mn(Rexact, 4)}(${dec(v(i, years - t + 1), 6)}) = ${mn(principal, 2)}$.`,
        checks: [
          {
            label: "ledger",
            ok: (() => {
              const L = Rexact * an(years, i);
              let bal = L;
              let p = 0;
              for (let y = 1; y <= t; y += 1) {
                p = Rexact - bal * i;
                bal -= p;
              }
              return close(p, principal, 1e-8);
            })(),
          },
        ],
      };
    },
  },

  {
    id: "FM_LOAN_TOTAL_INTEREST_FROM_PRINCIPAL_PORTION",
    domain: LOANS,
    title: "Total Interest from One Principal Portion",
    objective: "Use one principal portion to recover the level payment and the loan, then total the interest.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [48],
    generate: (rng: Rng) => {
      const [borrower] = cast(rng);
      const years = rng.choice([6, 8, 10, 12]);
      const i = gridRate(rng, 0.03, 0.08, 0.0025);
      const k = rng.int(2, years - 1);
      const Pk = Number((gridAmount(rng, 300, 3000, 1) + rng.int(1, 99) / 100).toFixed(2));
      const R = Pk * acc(i, years - k + 1);
      const L = R * an(years, i);
      const interest = years * R - L;
      return {
        questionText: `${borrower} takes out a loan today and repays it with ${word(years)} level annual payments, the first one year from today. The payments are based on ${eff(i)}.
The principal portion of the ${ord(k)} payment is ${n(Pk, 2)}.
Calculate the total amount of interest paid on the loan.`,
        variables: { years, i, k, Pk },
        correctValue: interest,
        format: "AMOUNT_0",
        distractors: [
          distractor(years * Pk * acc(i, years - k) - Pk * acc(i, years - k) * an(years, i), "OFF_BY_ONE_PERIOD", `Accumulated the principal portion ${years - k} years instead of ${years - k + 1}.`),
          distractor(years * (R - Pk), "CALCULATION_DISTRACTOR", `Assumed every payment carries the same interest as the ${ord(k)}.`),
          distractor(R * (1 - v(i, years)) * years, "CALCULATION_DISTRACTOR", "Multiplied the first payment's interest by the number of payments."),
          distractor(years * Pk * acc(i, years - k + 2) - Pk * acc(i, years - k + 2) * an(years, i), "OFF_BY_ONE_PERIOD", "Accumulated the principal portion one year too many."),
        ],
        solutionSteps: `**Step 1 — Level payment.** $P_{${k}} = R\\,v^{${years - k + 1}}$, so $R = ${mn(Pk, 2)}(${dec(1 + i, 4)})^{${years - k + 1}} = ${mn(R, 4)}$.

**Step 2 — Loan amount.** $L = R\\,a_{\\overline{${years}}|} = ${mn(L, 2)}$.

**Step 3 — Total interest.** $${years}R - L = ${mn(years * R, 2)} - ${mn(L, 2)} = ${mn(interest, 2)}$.`,
        checks: [
          {
            label: "sum of interest portions",
            ok: close(Array.from({ length: years }, (_, t) => R * (1 - v(i, years - t))).reduce((a, b) => a + b, 0), interest),
          },
        ],
      };
    },
  },

  {
    id: "FM_LOAN_REFINANCE_REMAINING_BALANCE",
    domain: LOANS,
    title: "Refinancing a Loan Partway Through",
    objective: "Find the balance after some payments of a loan with a larger final payment, then the payment on a refinanced loan.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [49],
    generate: (rng: Rng) => {
      const [borrower] = cast(rng);
      const L = gridAmount(rng, 15000, 40000, 500);
      const j1 = gridRate(rng, 0.06, 0.1, 0.006);
      const months = rng.choice([48, 60, 72]);
      const r1 = j1 / 12;
      const R = cents(L / an(months, r1) - rng.choice([0.25, 0.5, 1, 1.5]));
      const k = rng.choice([12, 18, 24]);
      const count2 = rng.choice([18, 24, 36]);
      const j2 = gridRate(rng, 0.036, j1 - 0.012, 0.006);
      const r2 = j2 / 12;
      const B = retro(L, R, r1, k);
      const X = B / an(count2, r2);
      return {
        questionText: `${borrower} buys a car and finances it with a loan of ${n(L)}. ${borrower} will make $n$ monthly payments of ${n(R, 2)}, starting in one month, and one larger payment in $n + 1$ months to pay off the loan. The payments are based on ${nom(j1, 12)}.
Immediately after the ${ord(k)} payment, ${borrower} refinances the remaining balance with ${count2} monthly payments, starting one month later, at ${nom(j2, 12)}.
Calculate the amount of the new monthly payment.`,
        variables: { L, j1, R, k, count2, j2 },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(B / an(count2, r1), "CALCULATION_DISTRACTOR", "Kept the original interest rate."),
          distractor((L - k * R) / an(count2, r2), "SIMPLE_INTEREST_ERROR", "Subtracted the payments from the loan without accounting for interest."),
          distractor(B / adue(count2, r2), "ANNUITY_DUE_CONFUSION", "Treated the new payments as starting immediately."),
          distractor(retro(L, R, r1, k - 1) / an(count2, r2), "OFF_BY_ONE_PERIOD", `Used the balance after ${k - 1} payments.`),
        ],
        solutionSteps: `**Step 1 — Balance after ${k} payments.** Work retrospectively at $${dec(r1, 4)}$ per month (the size of the final payment is not needed):
$$${mn(L)}(${dec(1 + r1, 4)})^{${k}} - ${mn(R, 2)}\\,s_{\\overline{${k}}|} = ${mn(B, 2)}.$$

**Step 2 — New rate.** $${dec(j2, 3)}/12 = ${dec(r2, 4)}$ per month.

**Step 3 — New payment.** $${mn(B, 2)}/a_{\\overline{${count2}}|${dec(r2, 4)}} = ${mn(X, 2)}$.`,
        checks: [{ label: "refinanced loan repays the balance", ok: close(X * an(count2, r2), B) }],
      };
    },
  },

  {
    id: "FM_LOAN_REFINANCE_SOLVE_RATE",
    domain: LOANS,
    title: "Refinance Rate from a Payment Reduction",
    objective: "Find the outstanding balance of a mortgage and the refinanced rate that lowers the payment by a given amount.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [60],
    generate: (rng: Rng) => {
      const L = gridAmount(rng, 100000, 500000, 10000);
      const years = rng.choice([15, 20, 25, 30]);
      const j1 = gridRate(rng, 0.06, 0.1, 0.0025);
      const r1 = j1 / 12;
      const R1 = L / an(12 * years, r1);
      const after = rng.choice([24, 36, 48, 60]);
      const remaining = 12 * years - after;
      const B = R1 * an(remaining, r1);
      const j2True = gridRate(rng, 0.035, j1 - 0.01, 0.0025);
      const reduction = cents(R1 - B / an(remaining, j2True / 12));
      const R2 = R1 - reduction;
      const j = 12 * solve((r) => R2 * an(remaining, r) - B, 1e-6, 0.05);
      return {
        questionText: `A borrower takes out a ${years}-year loan for ${n(L)} with level end-of-month payments at ${nom(j1, 12)}.
Immediately after the ${ord(after)} payment, the borrower refinances at an annual nominal interest rate of $j$, convertible monthly. The remaining term stays at ${remaining / 12} years, with level payments at the end of each month, but each payment is now ${n(reduction, 2)} lower than before.
Calculate $j$.`,
        variables: { L, years, j1, after, reduction },
        correctValue: j * 100,
        format: "PERCENT_2",
        distractors: [
          distractor(12 * trySolve((r) => R2 * an(12 * years, r) - B, 1e-6, 0.05) * 100, "OFF_BY_ONE_PERIOD", "Spread the balance over the original term instead of the remaining term."),
          distractor(12 * trySolve((r) => R2 * an(remaining, r) - L, 1e-6, 0.05) * 100, "CALCULATION_DISTRACTOR", "Refinanced the original loan amount instead of the outstanding balance."),
          distractor((Math.pow(1 + j / 12, 12) - 1) * 100, "NOMINAL_RATE_ERROR", "Reported the annual effective rate instead of the nominal rate."),
          distractor((j1 - (reduction / R1) * j1) * 100, "SIMPLE_INTEREST_ERROR", "Cut the rate in proportion to the payment reduction."),
        ],
        solutionSteps: `**Step 1 — Original payment.** $${mn(L)}/a_{\\overline{${12 * years}}|${dec(r1, 5)}} = ${mn(R1, 4)}$.

**Step 2 — Balance after ${after} payments.** $${mn(R1, 4)}\\,a_{\\overline{${remaining}}|${dec(r1, 5)}} = ${mn(B, 2)}$.

**Step 3 — Solve for the new rate.** The new payment is $${mn(R1, 4)} - ${mn(reduction, 2)} = ${mn(R2, 4)}$, and $${mn(R2, 4)}\\,a_{\\overline{${remaining}}|j/12} = ${mn(B, 2)}$ gives $j/12 = ${dec(j / 12, 6)}$, so $j = ${mpc(j, 3)}$.`,
        checks: [{ label: "new payment amortizes the balance", ok: close(R2 * an(remaining, j / 12), B) }],
      };
    },
  },

  {
    id: "FM_LOAN_IRREGULAR_THEN_LEVEL",
    domain: LOANS,
    title: "Increasing Early Payments followed by Level Payments",
    objective: "Value arithmetically increasing early payments and solve for the level payments that finish the loan.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [67],
    generate: (rng: Rng) => {
      // The early payments must leave a real balance for the level payments:
      // they may cover at most about 70% of the loan's value.
      const { L, step, s, m, i } = drawUntil(
        () => ({
          L: gridAmount(rng, 5000, 30000, 1000),
          step: rng.choice([100, 200, 250, 500]),
          s: rng.choice([4, 5, 6]),
          m: rng.choice([10, 15, 20]),
          i: gridRate(rng, 0.04, 0.08, 0.005),
        }),
        (p) => Array.from({ length: p.s }, (_, k) => p.step * (k + 1) * v(p.i, k + 1)).reduce((a, b) => a + b, 0) < 0.7 * p.L,
        { L: 20000, step: 250, s: 5, m: 15, i: 0.06 }
      );
      const early = Array.from({ length: s }, (_, k) => step * (k + 1) * v(i, k + 1)).reduce((a, b) => a + b, 0);
      const X = (L - early) / (v(i, s) * an(m, i));
      return {
        questionText: `A loan of ${n(L)} is repaid with a payment at the end of each year for ${s + m} years.
The payments are ${Array.from({ length: s }, (_, k) => n(step * (k + 1))).join(", ")} in years 1 through ${s}, respectively. In the next ${m} years, equal annual payments of $X$ are made.
The annual effective interest rate is ${pc(i)}.
Calculate $X$.`,
        variables: { L, step, s, m, i },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor((L - (step * s * (s + 1)) / 2) / (v(i, s) * an(m, i)), "SIMPLE_INTEREST_ERROR", "Subtracted the early payments without discounting them."),
          distractor((L - early) / an(m, i), "OFF_BY_ONE_PERIOD", `Did not defer the level payments by ${s} years.`),
          distractor((L - early) / (v(i, s) * adue(m, i)), "ANNUITY_DUE_CONFUSION", "Valued the level payments as an annuity-due."),
          distractor(L / (v(i, s) * an(m, i)), "CALCULATION_DISTRACTOR", "Ignored the early payments."),
        ],
        solutionSteps: `**Step 1 — Early payments.** $${step}(Ia)_{\\overline{${s}}|${mpc(i)}} = ${mn(early, 2)}$.

**Step 2 — Remaining value.** $${mn(L)} - ${mn(early, 2)} = ${mn(L - early, 2)}$ must be covered by the level payments, which start at time ${s + 1}.

**Step 3 — Solve.** $X\\,v^{${s}}\\,a_{\\overline{${m}}|} = ${mn(L - early, 2)}$, so $X = ${mn(L - early, 2)}/${dec(v(i, s) * an(m, i), 5)} = ${mn(X, 2)}$.`,
        checks: [
          { label: "level payment positive", ok: X > 0 },
          {
            label: "ledger ends at zero",
            ok: (() => {
              let bal = L;
              for (let k = 1; k <= s; k += 1) bal = bal * (1 + i) - step * k;
              for (let k = 1; k <= m; k += 1) bal = bal * (1 + i) - X;
              return Math.abs(bal) < 1e-6 * L;
            })(),
          },
        ],
      };
    },
  },

  {
    id: "FM_LOAN_REAMORTIZE_RATE_CHANGE",
    domain: LOANS,
    title: "Reamortizing a Loan at a New Rate",
    objective: "Find the outstanding balance and reamortize it at a new rate, or find the interest in the first new payment.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [69, 369],
    generate: (rng: Rng): GeneratedQuestionItem => {
      if (rng.next() < 0.5) {
        const L = gridAmount(rng, 50000, 300000, 5000);
        const years = rng.choice([10, 15, 20, 30]);
        const j1 = gridRate(rng, 0.06, 0.1, 0.005);
        const after = rng.choice([12, 24, 36, 60]);
        const j2 = gridRate(rng, 0.03, j1 - 0.01, 0.005);
        const r1 = j1 / 12;
        const r2 = j2 / 12;
        const R1 = L / an(12 * years, r1);
        const B = R1 * an(12 * years - after, r1);
        const R2 = B / an(12 * years - after, r2);
        return {
          questionText: `A borrower takes out a ${years}-year loan for ${n(L)}, with level end-of-month payments at ${nom(j1, 12)}.
Immediately after the ${ord(after)} payment, the remaining balance is reamortized. The maturity date is unchanged, but the rate becomes ${nom(j2, 12)}.
Calculate the new end-of-month payment.`,
          variables: { variant: "PAYMENT", L, years, j1, after, j2 },
          correctValue: R2,
          format: "AMOUNT_0",
          distractors: [
            distractor(L / an(12 * years, r2), "CALCULATION_DISTRACTOR", "Reamortized the original loan over the original term."),
            distractor(B / an(12 * years, r2), "OFF_BY_ONE_PERIOD", "Reamortized the balance over the original full term."),
            distractor(B / an(12 * years - after, r1), "CALCULATION_DISTRACTOR", "Kept the original rate."),
            distractor(R1 * (j2 / j1), "SIMPLE_INTEREST_ERROR", "Scaled the payment in proportion to the rates."),
          ],
          solutionSteps: `**Step 1 — Original payment.** $${mn(L)}/a_{\\overline{${12 * years}}|${dec(r1, 5)}} = ${mn(R1, 4)}$.

**Step 2 — Balance after ${after} payments.** $${mn(R1, 4)}\\,a_{\\overline{${12 * years - after}}|${dec(r1, 5)}} = ${mn(B, 2)}$.

**Step 3 — New payment.** $${mn(B, 2)}/a_{\\overline{${12 * years - after}}|${dec(r2, 5)}} = ${mn(R2, 2)}$.`,
          checks: [{ label: "ledger", ok: close(retro(L, R1, r1, after), B) }],
        };
      }
      const L = gridAmount(rng, 50000, 200000, 5000);
      const years = rng.choice([10, 15, 20]);
      const i1 = gridRate(rng, 0.06, 0.1, 0.0012);
      const after = rng.int(24, 72);
      const i2 = gridRate(rng, 0.03, i1 - 0.012, 0.0012);
      const newYears = rng.choice([15, 20, 25]);
      const r1 = Math.pow(1 + i1, 1 / 12) - 1;
      const r2 = Math.pow(1 + i2, 1 / 12) - 1;
      const R1 = L / an(12 * years, r1);
      const B = R1 * an(12 * years - after, r1);
      const interest = B * r2;
      return {
        questionText: `A loan of ${n(L)} at ${eff(i1)} is repaid with level payments at the end of each month over ${years} years.
Immediately after the ${ord(after)} payment, the outstanding balance is refinanced at ${eff(i2)}. The refinanced loan has a term of ${newYears} years, with level payments at the end of each month.
Calculate the interest portion of the first payment of the refinanced loan.`,
        variables: { variant: "INTEREST", L, years, i1, after, i2, newYears },
        correctValue: interest,
        format: "AMOUNT_0",
        distractors: [
          distractor((B * i2) / 12, "NOMINAL_RATE_ERROR", `Used ${pc(i2)}/12 as the monthly rate.`),
          distractor(B * r1, "CALCULATION_DISTRACTOR", "Used the original rate."),
          distractor(L * r2, "CALCULATION_DISTRACTOR", "Charged interest on the original loan amount."),
          distractor(R1 * an(12 * years - after + 1, r1) * r2, "OFF_BY_ONE_PERIOD", `Used the balance before the ${ord(after)} payment.`),
        ],
        solutionSteps: `**Step 1 — Monthly rates.** $r_1 = (${dec(1 + i1, 4)})^{1/12} - 1 = ${dec(r1, 6)}$ and $r_2 = (${dec(1 + i2, 4)})^{1/12} - 1 = ${dec(r2, 6)}$.

**Step 2 — Balance at refinancing.** The payment is $${mn(L)}/a_{\\overline{${12 * years}}|r_1} = ${mn(R1, 4)}$, and after ${after} payments the balance is $${mn(R1, 4)}\\,a_{\\overline{${12 * years - after}}|r_1} = ${mn(B, 2)}$.

**Step 3 — First interest portion.** $${mn(B, 2)} \\times ${dec(r2, 6)} = ${mn(interest, 2)}$. (The new term does not affect it.)`,
        checks: [{ label: "balance positive", ok: B > 0 && B < L }],
      };
    },
  },

  {
    id: "FM_LOAN_DEFERRED_DROP_PAYMENT",
    domain: LOANS,
    title: "Deferred Loan Repaid with Level Payments and a Drop Payment",
    objective: "Accumulate a loan through a deferral period, count the level payments it supports, and size the drop payment.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [87, 305],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const params = drawUntil(
        () => {
          const m = rng.choice([1, 4]);
          const useDiscount = m === 1 && rng.next() < 0.6;
          const rate = gridRate(rng, 0.04, 0.08, 0.005);
          const i = useDiscount ? rate / (1 - rate) : rate;
          const L = m === 1 ? gridAmount(rng, 1000000, 20000000, 500000) : gridAmount(rng, 20000, 100000, 5000);
          const first = m === 1 ? rng.choice([2, 3, 4]) : rng.choice([1, 1.5, 2]);
          const j = Math.pow(1 + i, 1 / m) - 1;
          const B = L * Math.pow(1 + i, first - 1 / m);
          const R = m === 1 ? Math.round((B / (rng.int(15, 30) + 0.5)) * 1.1 / 50000) * 50000 : Math.round((B / (rng.int(20, 40) + 0.5)) * 1.15 / 25) * 25;
          const nStar = termFor(B, R, j);
          return { m, useDiscount, rate, i, L, first, j, B, R, nStar };
        },
        (p) => Number.isFinite(p.nStar) && p.nStar > 8 && p.nStar < 60 && p.nStar % 1 > 0.1 && p.nStar % 1 < 0.9,
        (() => {
          const i = 0.055 / 0.945;
          const B = 15000000 * Math.pow(1 + i, 2);
          return { m: 1, useDiscount: true, rate: 0.055, i, L: 15000000, first: 3, j: i, B, R: 1200000, nStar: termFor(B, 1200000, i) };
        })()
      );
      const { m, useDiscount, rate, i, L, first, j, B, R, nStar } = params;
      const full = Math.floor(nStar);
      const drop = (B - R * an(full, j)) * acc(j, full + 1);
      const askCount = rng.next() < 0.4;
      const unit = m === 1 ? "annual" : "quarterly";
      const firstText = m === 1 ? `${word(first)} years` : first === 1 ? "one year" : `${first} years`;
      return {
        questionText: `A loan of ${n(L)} is based on ${useDiscount ? `an annual effective discount rate of ${pc(rate)}` : eff(rate)}.
The loan is repaid with ${unit} payments of ${n(R)} and a final drop payment one ${m === 1 ? "year" : "quarter"} after the last payment of ${n(R)}. The first payment is due ${firstText} after the loan is taken out.
${askCount ? `Calculate the number of payments of ${n(R)} made.` : "Calculate the amount of the drop payment."}`,
        variables: { L, rate, useDiscount: useDiscount ? 1 : 0, m, first, R, askCount: askCount ? 1 : 0 },
        correctValue: askCount ? full : drop,
        format: "AMOUNT_0",
        optionStyle: askCount ? "LADDER" : "MIXED",
        ladderStep: askCount ? 1 : undefined,
        distractors: askCount
          ? []
          : [
              distractor(B - R * an(full, j), "CALCULATION_DISTRACTOR", "Left the remaining value at the start of the payments instead of accumulating it."),
              distractor(drop / (1 + j), "OFF_BY_ONE_PERIOD", "Accumulated the remainder to the date of the last full payment."),
              distractor((L * acc(i, first) - R * an(full, j)) * acc(j, full + 1), "OFF_BY_ONE_PERIOD", "Accumulated the loan for the full deferral, one period too long."),
              distractor(R * (nStar - full), "SIMPLE_INTEREST_ERROR", "Took the fractional payment times the level payment."),
            ],
        solutionSteps: `**Step 1 — Rate and balance before the first payment.** ${useDiscount ? `$i = d/(1-d) = ${dec(i, 6)}$. ` : ""}${m === 4 ? `The quarterly rate is $(1+i)^{1/4} - 1 = ${dec(j, 6)}$. ` : ""}One ${m === 1 ? "year" : "quarter"} before the first payment the loan has grown to
$$${mn(L)}(1 + i)^{${dec(first - 1 / m, 2)}} = ${mn(B, 2)}.$$

**Step 2 — Count the payments.** Solving $${mn(R)}\\,a_{\\overline{n}|} = ${mn(B, 2)}$ gives $n = ${dec(nStar, 3)}$, so there are **${full}** payments of ${n(R)}.

**Step 3 — Drop payment.** It is made ${full + 1} periods after that date:
$$\\left(${mn(B, 2)} - ${mn(R)}\\,a_{\\overline{${full}}|}\\right)(1 + ${dec(j, 6)})^{${full + 1}} = ${mn(drop, 2)}.$$`,
        checks: [{ label: "drop payment smaller than a full payment", ok: drop > 0 && drop < R }],
      };
    },
  },

  {
    id: "FM_LOAN_INTEREST_RATIOS_TERM",
    domain: LOANS,
    title: "Loan Term from Ratios of Interest Portions",
    objective: "Use ratios of interest portions of level payments to find the discount factor and the loan term.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [88],
    generate: (rng: Rng) => {
      const [borrower] = cast(rng);
      const { term, r1, r2, vv } = drawUntil(
        () => {
          const i = gridRate(rng, 0.03, 0.08, 0.005);
          const term = rng.int(12, 30);
          const vi = 1 / (1 + i);
          const r1 = Number((1 / (1 + vi * vi)).toFixed(4));
          const vv = Math.sqrt(1 / r1 - 1);
          const r2 = Number(((1 - vv * vv) / (1 - Math.pow(vv, term))).toFixed(4));
          return { term, r1, r2, vv };
        },
        (p) => {
          const est = Math.log(1 - (1 - p.vv * p.vv) / p.r2) / Math.log(p.vv);
          return Math.abs(est - p.term) < 0.3;
        },
        { term: 22, r1: 0.525, r2: 0.1427, vv: Math.sqrt(1 / 0.525 - 1) }
      );
      const exact = Math.log(1 - (1 - vv * vv) / r2) / Math.log(vv);
      return {
        questionText: `${borrower} takes out an $n$-year loan with equal payments at the end of each year.
The interest portion of the payment at time $n - 1$ equals ${dec(r1, 4)} of the interest portion of the payment at time $n - 3$, and also equals ${dec(r2, 4)} of the interest portion of the first payment.
Calculate $n$.`,
        variables: { r1, r2 },
        correctValue: term,
        format: "AMOUNT_0",
        optionStyle: "LADDER",
        ladderStep: 2,
        distractors: [],
        solutionSteps: `**Step 1 — Interest portion of payment $t$.** $I_t = R\\left(1 - v^{n-t+1}\\right)$.

**Step 2 — Discount factor.**
$$\\frac{I_{n-1}}{I_{n-3}} = \\frac{1 - v^2}{1 - v^4} = \\frac{1}{1 + v^2} = ${dec(r1, 4)} \\implies v^2 = ${dec(vv * vv, 6)}.$$

**Step 3 — Term.**
$$\\frac{I_{n-1}}{I_1} = \\frac{1 - v^2}{1 - v^n} = ${dec(r2, 4)} \\implies v^n = 1 - \\frac{${dec(1 - vv * vv, 6)}}{${dec(r2, 4)}} = ${dec(1 - (1 - vv * vv) / r2, 6)},$$
so $n = ${dec(exact, 2)} \\approx ${term}$.`,
        checks: [{ label: "term is a whole number", ok: Math.abs(exact - term) < 0.3 }],
      };
    },
  },

  {
    id: "FM_LOAN_ROUNDED_PAYMENTS_FINAL",
    domain: LOANS,
    title: "Final Payment after Rounded-Up Level Payments",
    objective: "Find the final payment when the level payments are rounded up to a convenient amount.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [90],
    generate: (rng: Rng) => {
      const L = gridAmount(rng, 100000, 1000000, 50000);
      const years = rng.choice([4, 5, 6, 8]);
      const useDiscount = rng.next() < 0.5;
      const rate = gridRate(rng, 0.05, 0.1, 0.01);
      const i = useDiscount ? rate / (1 - rate) : rate;
      const roundTo = L >= 500000 ? 1000 : 500;
      const R = L / an(years, i);
      const rounded = Math.ceil(R / roundTo) * roundTo;
      const X = (L - rounded * an(years - 1, i)) * acc(i, years);
      return {
        questionText: `A ${word(years)}-year loan of ${n(L)} at ${useDiscount ? `an annual effective discount rate of ${pc(rate)}` : eff(rate)} is to be repaid by level end-of-year payments.
If the first ${word(years - 1)} payments had been rounded up to the next multiple of ${n(roundTo)}, the final payment would be $X$.
Calculate $X$.`,
        variables: { L, years, rate, useDiscount: useDiscount ? 1 : 0, roundTo },
        correctValue: X,
        format: "AMOUNT_0",
        distractors: [
          distractor(R - (years - 1) * (rounded - R), "SIMPLE_INTEREST_ERROR", "Subtracted the overpayments without interest."),
          distractor(R - (rounded - R) * sn(years - 1, i), "OFF_BY_ONE_PERIOD", "Accumulated the overpayments only to the fourth payment date."),
          distractor((L - rounded * an(years - 1, rate)) * acc(rate, years), "NOMINAL_RATE_ERROR", "Used the discount rate as if it were an interest rate."),
          distractor(rounded, "CALCULATION_DISTRACTOR", "Assumed the final payment is also rounded."),
        ],
        solutionSteps: `**Step 1 — Level payment.** ${useDiscount ? `$i = d/(1-d) = ${dec(i, 5)}$, so ` : ""}$R = ${mn(L)}/a_{\\overline{${years}}|} = ${mn(R, 2)}$, which rounds up to ${n(rounded)}.

**Step 2 — Equation of value.** $${mn(rounded)}\\,a_{\\overline{${years - 1}}|} + X v^{${years}} = ${mn(L)}$.

**Step 3 — Solve.** $X = \\left(${mn(L)} - ${mn(rounded * an(years - 1, i), 2)}\\right)(${dec(1 + i, 5)})^{${years}} = ${mn(X, 2)}$.`,
        checks: [{ label: "final payment smaller than the rounded payment", ok: X < rounded && X > 0 }],
      };
    },
  },

  {
    id: "FM_LOAN_AMOUNT_FROM_COMPONENTS",
    domain: LOANS,
    title: "Loan Amount from Interest and Principal Portions",
    objective: "Combine a known interest portion and a known principal portion to recover the rate and the loan amount.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [92, 246],
    generate: (rng: Rng) => {
      const years = rng.choice([8, 10, 12, 15]);
      const i = gridRate(rng, 0.05, 0.1, 0.005);
      const L = gridAmount(rng, 20000, 80000, 250);
      const R = L / an(years, i);
      const k = rng.int(3, years - 2);
      const I1 = cents(L * i);
      const Pk = cents((R - L * i) * acc(i, k - 1));
      const rate = solve((r) => (I1 / r / an(years, r) - I1) * acc(r, k - 1) - Pk, 0.001, 0.5);
      const loan = I1 / rate;
      return {
        questionText: `A loan of $X$ is repaid with level annual payments at the end of each year for ${years} years. You are given:
i) the interest paid in the first year is ${n(I1, 2)};
ii) the principal repaid in the ${ord(k)} year is ${n(Pk, 2)}.
Calculate $X$.`,
        variables: { years, I1, Pk, k },
        correctValue: loan,
        format: "AMOUNT_0",
        distractors: [
          distractor(I1 / trySolve((r) => (I1 / r / an(years, r) - I1) * acc(r, k) - Pk, 0.001, 0.5), "OFF_BY_ONE_PERIOD", `Accumulated the first principal portion ${k} years instead of ${k - 1}.`),
          distractor((I1 + Pk) * an(years, rate), "CALCULATION_DISTRACTOR", "Took the level payment to be the sum of the two given portions."),
          distractor(Pk * an(years, rate) * acc(rate, years - k + 1), "CALCULATION_DISTRACTOR", "Treated the principal portion as the full payment."),
          distractor(I1 / trySolve((r) => (I1 / r / an(years, r) - I1) * acc(r, k - 2) - Pk, 0.001, 0.5), "OFF_BY_ONE_PERIOD", "Accumulated the first principal portion one year too few."),
        ],
        solutionSteps: `**Step 1 — Express everything in $i$.** $iX = ${mn(I1, 2)}$, the payment is $R = X/a_{\\overline{${years}}|}$, and principal portions grow by $1+i$ each year: $P_{${k}} = (R - iX)(1+i)^{${k - 1}}$.

**Step 2 — Solve for $i$.** Substituting $X = ${mn(I1, 2)}/i$,
$$\\left(\\frac{${mn(I1, 2)}}{i\\,a_{\\overline{${years}}|}} - ${mn(I1, 2)}\\right)(1+i)^{${k - 1}} = ${mn(Pk, 2)} \\implies i = ${dec(rate, 5)}.$$

**Step 3 — Loan amount.** $X = ${mn(I1, 2)}/${dec(rate, 5)} = ${mn(loan, 2)}$.`,
        checks: [{ label: "recovered loan matches", ok: Math.abs(loan - L) < 5 }],
      };
    },
  },

  {
    id: "FM_LOAN_BALLOON_PAYMENT",
    domain: LOANS,
    title: "Balloon Payment Replacing the Last Level Payment",
    objective: "Count the level payments a loan supports and fold the remainder into a final balloon payment.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [126, 337, 272],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["SIMPLE", "DEFERRED", "STEPPED"] as const);
      if (variant === "STEPPED") {
        const params = drawUntil(
          () => {
            const L = gridAmount(rng, 50000, 150000, 5000);
            const j = gridRate(rng, 0.06, 0.1, 0.01);
            const q = j / 4;
            const years1 = rng.choice([3, 5]);
            const R1 = Math.round((L * q * rng.choice([1.1, 1.2, 1.25])) / 100) * 100;
            const R2 = R1 * 2;
            const B = retro(L, R1, q, 4 * years1);
            const mStar = termFor(B, R2, q);
            return { L, j, q, years1, R1, R2, B, mStar };
          },
          (p) => Number.isFinite(p.mStar) && p.mStar > 8 && p.mStar % 1 > 0.1 && p.mStar % 1 < 0.9,
          (() => {
            const B = retro(100000, 2500, 0.02, 20);
            return { L: 100000, j: 0.08, q: 0.02, years1: 5, R1: 2500, R2: 5000, B, mStar: termFor(B, 5000, 0.02) };
          })()
        );
        const { L, j, q, years1, R1, R2, B, mStar } = params;
        const f = Math.floor(mStar);
        const balloon = R2 + (B - R2 * an(f, q)) * acc(q, f);
        return {
          questionText: `A loan of ${n(L)} has ${nom(j, 4)}. It is repaid with quarterly payments, the first due three months after the loan is made.
For the first ${years1} years each payment is ${n(R1)}. All later payments are ${n(R2)}, except for a final balloon payment, which is less than ${n(2 * R2)}.
Calculate the balloon payment.`,
          variables: { variant, L, j, years1, R1, R2 },
          correctValue: balloon,
          format: "AMOUNT_0",
          distractors: [
            distractor(balloon - R2, "CALCULATION_DISTRACTOR", "Reported only the extra amount, not the whole balloon payment."),
            distractor((B - R2 * an(f, q)) * acc(q, f + 1), "CALCULATION_DISTRACTOR", "Computed a drop payment one quarter after the last regular payment instead of a balloon."),
            distractor(R2 + (B - R2 * an(f, q)) * acc(q, f - 1), "OFF_BY_ONE_PERIOD", "Accumulated the remainder one quarter short."),
          ],
          solutionSteps: `**Step 1 — Balance after the first phase.** At $${dec(q, 3)}$ per quarter, after ${4 * years1} payments of ${n(R1)}:
$$${mn(L)}(${dec(1 + q, 3)})^{${4 * years1}} - ${mn(R1)}\\,s_{\\overline{${4 * years1}}|} = ${mn(B, 2)}.$$

**Step 2 — Count the later payments.** $${mn(R2)}\\,a_{\\overline{m}|} = ${mn(B, 2)}$ gives $m = ${dec(mStar, 2)}$. The balloon replaces the ${ord(f)} payment of ${n(R2)}.

**Step 3 — Balloon.** $${mn(B, 2)} = ${mn(R2)}\\,a_{\\overline{${f}}|} + Yv^{${f}}$ gives the extra $Y = ${mn(balloon - R2, 2)}$, so the balloon is $${mn(R2)} + ${mn(balloon - R2, 2)} = ${mn(balloon, 2)}$.`,
          checks: [{ label: "balloon between the payment and its double", ok: balloon > R2 && balloon < 2 * R2 }],
        };
      }
      const deferred = variant === "DEFERRED";
      const params = drawUntil(
        () => {
          const L = gridAmount(rng, 2000, 10000, 10);
          const i = gridRate(rng, 0.04, 0.08, 0.0025);
          const start = deferred ? rng.choice([3, 4, 5, 6]) : 1;
          const B = L * acc(i, start - 1);
          const R = Math.round((B / (rng.int(8, 30) + 0.5)) * 1.05 / 10) * 10;
          const nStar = termFor(B, R, i);
          return { L, i, start, B, R, nStar };
        },
        (p) => Number.isFinite(p.nStar) && p.nStar > 6 && p.nStar % 1 > 0.05 && p.nStar % 1 < 0.95,
        { L: 5020, i: 0.0625, start: 1, B: 5020, R: 360, nStar: termFor(5020, 360, 0.0625) }
      );
      const { L, i, start, B, R, nStar } = params;
      const f = Math.floor(nStar);
      const balloon = R + (B - R * an(f, i)) * acc(i, f);
      return {
        questionText: `A loan of ${n(L)} at ${eff(i)} is repaid with annual payments${deferred ? `, starting at the end of year ${start}` : " at the end of each year"}. Each payment is ${n(R)}, except for a final balloon payment, which is less than ${n(2 * R)}.
Calculate the balloon payment.`,
        variables: { variant, L, i, start, R },
        correctValue: balloon,
        format: "AMOUNT_0",
        distractors: [
          distractor(balloon - R, "CALCULATION_DISTRACTOR", "Reported only the amount added to the last regular payment."),
          distractor((B - R * an(f, i)) * acc(i, f + 1), "CALCULATION_DISTRACTOR", "Computed a drop payment a year after the last regular payment."),
          distractor(R + (L - R * an(f, i)) * acc(i, f), "OFF_BY_ONE_PERIOD", deferred ? "Ignored the interest that accrues before the first payment." : "Accumulated the remainder to the wrong date."),
          distractor(R + (B - R * an(f, i)) * acc(i, f + 1), "OFF_BY_ONE_PERIOD", "Accumulated the remainder one year too long."),
        ],
        solutionSteps: `**Step 1 — Value one year before the first payment.** ${deferred ? `$${mn(L)}(${dec(1 + i, 4)})^{${start - 1}} = ${mn(B, 2)}$.` : `The loan itself, ${n(L)}.`}

**Step 2 — Count the payments.** $${mn(R)}\\,a_{\\overline{n}|${mpc(i)}} = ${mn(B, 2)}$ gives $n = ${dec(nStar, 2)}$. With a balloon rather than a drop payment, the ${ord(f)} payment is enlarged.

**Step 3 — Balloon.** $${mn(B, 2)} = ${mn(R)}\\,a_{\\overline{${f}}|} + Yv^{${f}}$ gives $Y = ${mn(balloon - R, 2)}$, so the balloon is $${mn(R)} + ${mn(balloon - R, 2)} = ${mn(balloon, 2)}$.`,
        checks: [{ label: "balloon between the payment and its double", ok: balloon > R && balloon < 2 * R }],
      };
    },
  },

  {
    id: "FM_LOAN_RATE_CHANGE_LEVEL_PAYMENT",
    domain: LOANS,
    title: "Level Payment on a Loan whose Rate Changes",
    objective: "Find the level payment of a loan charged one rate for some years and another afterwards.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    soaSamples: [127],
    generate: (rng: Rng) => {
      const L = gridAmount(rng, 10000, 50000, 1000);
      const years = rng.choice([8, 10, 12, 15]);
      const T = rng.int(3, years - 3);
      const i1 = gridRate(rng, 0.05, 0.12, 0.01);
      const i2 = gridRate(rng, 0.04, 0.13, 0.01);
      const factor = an(T, i1) + v(i1, T) * an(years - T, i2);
      const X = L / factor;
      return {
        questionText: `A loan of ${n(L)} is repaid by a payment of $X$ at the end of each year for ${years} years. The loan has ${eff(i1)} for the first ${T} years and ${eff(i2)} thereafter.
Calculate $X$.`,
        variables: { L, years, T, i1, i2 },
        correctValue: X,
        format: "AMOUNT_1",
        distractors: [
          distractor(L / (an(T, i1) + v(i2, T) * an(years - T, i2)), "CALCULATION_DISTRACTOR", `Discounted the later payments at ${pc(i2)} all the way back to time 0.`),
          distractor(L / an(years, (i1 * T + i2 * (years - T)) / years), "SIMPLE_INTEREST_ERROR", "Used a time-weighted average rate."),
          distractor(L / an(years, i1), "CALCULATION_DISTRACTOR", `Used ${pc(i1)} throughout.`),
          distractor(L / (adue(T, i1) + v(i1, T) * adue(years - T, i2)), "ANNUITY_DUE_CONFUSION", "Valued the payments as an annuity-due."),
        ],
        solutionSteps: `**Step 1 — Annuity factor across the rate change.**
$$a_{\\overline{${T}}|${mpc(i1)}} + v_{${mpc(i1)}}^{${T}}\\,a_{\\overline{${years - T}}|${mpc(i2)}} = ${dec(an(T, i1), 5)} + ${dec(v(i1, T), 5)}(${dec(an(years - T, i2), 5)}) = ${dec(factor, 5)}.$$

**Step 2 — Solve.** $X = ${mn(L)}/${dec(factor, 5)} = ${mn(X, 2)}$.`,
        checks: [
          {
            label: "ledger ends at zero",
            ok: (() => {
              let bal = L;
              for (let y = 1; y <= years; y += 1) bal = bal * (1 + (y <= T ? i1 : i2)) - X;
              return Math.abs(bal) < 1e-6 * L;
            })(),
          },
        ],
      };
    },
  },

  {
    id: "FM_LOAN_STEP_PAYMENTS_BALANCE",
    domain: LOANS,
    title: "Balance of a Loan with Stepped Payments",
    objective: "Use the growth in the balance after the first payment to find the rate, then compute a later balance.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [128],
    generate: (rng: Rng) => {
      const params = drawUntil(
        () => {
          const A = gridAmount(rng, 100, 500, 50);
          const B = A * rng.choice([2, 3]);
          const half = rng.choice([6, 8, 10]);
          const iTrue = gridRate(rng, 0.06, 0.12, 0.001);
          const L = A * an(half, iTrue) + B * v(iTrue, half) * an(half, iTrue);
          const increase = Math.round(L * iTrue - A);
          const f = (i: number) => (A + increase) / i - (A * an(half, i) + B * v(i, half) * an(half, i));
          const roots: number[] = [];
          for (let k = 1; k < 400; k += 1) {
            const lo = k / 1000;
            const hi = (k + 1) / 1000;
            if (f(lo) * f(hi) < 0) roots.push(solve(f, lo, hi));
          }
          return { A, B, half, increase, roots };
        },
        (p) => p.roots.length === 1 && p.increase > 5,
        { A: 100, B: 300, half: 8, increase: 25, roots: [0.0785] }
      );
      const { A, B, half, increase, roots } = params;
      const i = roots[0];
      const L = (A + increase) / i;
      const balance = B * an(half, i);
      return {
        questionText: `A ${2 * half}-year loan of $L$ is repaid with a payment at the end of each year. During the first ${half} years the payment is ${n(A)}; during the final ${half} years it is ${n(B)}. Interest is charged at an annual effective rate of $i$.
After the first payment of ${n(A)} is made, the outstanding principal is $L + ${increase}$.
Calculate the outstanding balance immediately after the ${ord(half)} payment of ${n(A)}.`,
        variables: { A, B, half, increase },
        correctValue: balance,
        format: "AMOUNT_0",
        distractors: [
          distractor(A * an(half, i) + B * v(i, half) * an(half, i), "CALCULATION_DISTRACTOR", "Reported the original loan amount."),
          distractor(B * an(half, i) + A, "OFF_BY_ONE_PERIOD", `Included the ${ord(half)} payment of ${n(A)} in the balance.`),
          distractor(L + half * increase, "SIMPLE_INTEREST_ERROR", "Assumed the balance grows by the same amount every year."),
          distractor(B * an(half - 1, i), "OFF_BY_ONE_PERIOD", `Counted ${half - 1} payments of ${n(B)} remaining.`),
        ],
        solutionSteps: `**Step 1 — Interest in the first year.** $L(1+i) - ${n(A)} = L + ${increase}$, so $iL = ${A + increase}$.

**Step 2 — Solve for $i$.** $L = ${n(A)}\\,a_{\\overline{${half}}|} + ${n(B)}\\,v^{${half}}a_{\\overline{${half}}|}$ and $L = ${A + increase}/i$ together give $i = ${dec(i, 5)}$ (so $L = ${mn(L, 2)}$).

**Step 3 — Balance after year ${half}.** Prospectively, $${n(B)}\\,a_{\\overline{${half}}|} = ${mn(balance, 2)}$.`,
        checks: [{ label: "retrospective agrees", ok: close(retro(L, A, i, half), balance, 1e-7) }],
      };
    },
  },

  {
    id: "FM_LOAN_FROM_PRINCIPAL_PORTIONS",
    domain: LOANS,
    title: "Rate, Term and Drop Payment from Early Principal Portions",
    objective: "Infer the monthly rate from successive principal portions or balances, then count payments or size the drop payment.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [129, 187, 296],
    generate: (rng: Rng): GeneratedQuestionItem => {
      const variant = rng.choice(["DROP", "COUNT_BAL", "COUNT_PAY"] as const);
      // The rate is read off the printed principal portions, so they must
      // reproduce it exactly at two decimals: the drop payment is a small
      // remainder and would drift with any rounding.
      const params = drawUntil(
        () => {
          const L = gridAmount(rng, 20000, 200000, 5000);
          const r = rng.choice([0.004, 0.005, 0.006, 0.0075, 0.008, 0.01, 0.012]);
          const R = Math.round((L * r * rng.choice([1.2, 1.3, 1.5, 1.8, 2])) / 50) * 50;
          const nStar = termFor(L, R, r);
          return { L, r, R, nStar };
        },
        (p) =>
          Number.isFinite(p.nStar) &&
          p.nStar > 40 &&
          p.nStar < 360 &&
          p.nStar % 1 > 0.1 &&
          p.nStar % 1 < 0.9 &&
          Math.abs(cents((p.R - p.L * p.r) * (1 + p.r)) - (p.R - p.L * p.r) * (1 + p.r)) < 1e-9,
        { L: 60000, r: 0.01, R: 2000, nStar: termFor(60000, 2000, 0.01) }
      );
      const { L, r, R, nStar } = params;
      const P1 = R - L * r;
      const P2 = P1 * (1 + r);
      const full = Math.floor(nStar);
      const count = full + 1;
      const drop = (L - R * an(full, r)) * acc(r, full + 1);
      if (variant === "DROP") {
        return {
          questionText: `A borrower takes out a loan of ${n(L)} at a nominal annual interest rate compounded monthly. The loan is repaid with level monthly payments plus a final drop payment, all at the end of the month.
The principal portion of the payment is ${amt(P1)} in the first month and ${amt(P2)} in the second month.
Calculate the drop payment.`,
          variables: { variant, L, P1: cents(P1), P2: cents(P2) },
          correctValue: drop,
          format: "AMOUNT_0",
          distractors: [
            distractor(drop / (1 + r), "OFF_BY_ONE_PERIOD", "Accumulated the remainder to the last full payment only."),
            distractor(L - R * an(full, r), "CALCULATION_DISTRACTOR", "Did not accumulate the remainder to the drop date."),
            distractor(R - drop / 3, "CALCULATION_DISTRACTOR", "Subtracted part of the remainder from a full payment."),
            distractor(R * (nStar - full), "SIMPLE_INTEREST_ERROR", "Took the fractional part of a payment."),
          ],
          solutionSteps: `**Step 1 — Monthly rate.** Principal portions grow by $1 + j$: $1 + j = ${amt(P2)}/${amt(P1)}$, so $j = ${dec(r, 4)}$.

**Step 2 — Payment and term.** $R = P_1 + jL = ${mamt(P1)} + ${dec(r, 4)}(${mn(L)}) = ${mn(R)}$. Solving $${mn(R)}\\,a_{\\overline{n}|} = ${mn(L)}$ gives $n = ${dec(nStar, 2)}$: ${full} full payments.

**Step 3 — Drop payment.** $\\left(${mn(L)} - ${mn(R)}\\,a_{\\overline{${full}}|}\\right)(${dec(1 + r, 4)})^{${full + 1}} = ${mn(drop, 2)}$.`,
          checks: [{ label: "drop smaller than a payment", ok: drop > 0 && drop < R }],
        };
      }
      if (variant === "COUNT_BAL") {
        const B1 = L - P1;
        const B2 = B1 - P2;
        return {
          questionText: `A mortgage of ${n(L)} has level payments at the end of each month and an annual nominal interest rate compounded monthly.
The balances owed immediately after the first and second payments are ${amt(B1)} and ${amt(B2)}, respectively.
Calculate the number of payments needed to pay off the mortgage.`,
          variables: { variant, L, B1: cents(B1), B2: cents(B2) },
          correctValue: count,
          format: "AMOUNT_0",
          optionStyle: "LADDER",
          ladderStep: 1,
          distractors: [],
          solutionSteps: `**Step 1 — Principal portions.** $P_1 = ${mn(L)} - ${mamt(B1)} = ${mamt(P1)}$ and $P_2 = ${mamt(B1)} - ${mamt(B2)} = ${mamt(P2)}$, so $j = P_2/P_1 - 1 = ${dec(r, 4)}$.

**Step 2 — Payment.** $R = P_1 + jL = ${mn(R)}$.

**Step 3 — Count.** $${mn(R)}\\,a_{\\overline{n}|${dec(r, 4)}} = ${mn(L)}$ gives $n = ${dec(nStar, 2)}$, so ${full} full payments and one smaller payment: **${count}** payments.`,
          checks: [{ label: "count exceeds the real-valued term", ok: count > nStar }],
        };
      }
      const B1 = L - P1;
      return {
        questionText: `On the first of the month, a business owner takes out a loan of ${n(L)} with payments at the end of each month based on an annual nominal interest rate compounded monthly. Each payment is ${n(R)}, except for a final drop payment.
Immediately after the first payment, the balance owed is ${amt(B1)}.
Calculate the number of payments needed to pay off the loan.`,
        variables: { variant, L, R, B1: cents(B1) },
        correctValue: count,
        format: "AMOUNT_0",
        optionStyle: "LADDER",
        ladderStep: 2,
        distractors: [],
        solutionSteps: `**Step 1 — Interest in the first payment.** $${mn(R)} - (${mn(L)} - ${mamt(B1)}) = ${mamt(L * r)}$, so $j = ${mamt(L * r)}/${mn(L)} = ${dec(r, 4)}$.

**Step 2 — Term.** $${mn(R)}\\,a_{\\overline{n}|} = ${mn(L)}$ gives $n = ${dec(nStar, 2)}$.

**Step 3 — Count.** ${full} full payments plus the drop payment: **${count}**.`,
        checks: [{ label: "count exceeds the real-valued term", ok: count > nStar }],
      };
    },
  },

  {
    id: "FM_LOAN_ACCUMULATED_BORROWING",
    domain: LOANS,
    title: "Balance of a Loan Drawn Down Monthly",
    objective: "Accumulate monthly borrowings through a change in the interest rate.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    soaSamples: [130],
    generate: (rng: Rng) => {
      const B = gridAmount(rng, 500, 2000, 100);
      const years1 = rng.choice([1, 2, 3]);
      const years2 = rng.choice([1, 2]);
      const j1 = gridRate(rng, 0.04, 0.08, 0.01);
      const j2 = gridRate(rng, j1 + 0.01, j1 + 0.03, 0.01);
      const r1 = j1 / 12;
      const r2 = j2 / 12;
      const first = B * sn(12 * years1, r1) * acc(r2, 12 * years2);
      const second = B * sn(12 * years2, r2);
      const total = first + second;
      return {
        questionText: `A student borrows ${n(B)} at the end of each month for ${years1 + years2} years. No payments are made on the loan during this time.
The loan accumulates interest at ${nom(j1, 12)} for the first ${word(years1)} year${years1 === 1 ? "" : "s"} and at ${nom(j2, 12)} for the following ${word(years2)} year${years2 === 1 ? "" : "s"}.
Calculate the loan balance at the end of ${years1 + years2} years, immediately after the final amount is borrowed.`,
        variables: { B, years1, years2, j1, j2 },
        correctValue: total,
        format: "AMOUNT_0",
        distractors: [
          distractor(B * sn(12 * (years1 + years2), r1), "CALCULATION_DISTRACTOR", `Used ${pc(j1)} for the whole period.`),
          distractor(B * sn(12 * (years1 + years2), r2), "CALCULATION_DISTRACTOR", `Used ${pc(j2)} for the whole period.`),
          distractor(B * sn(12 * years1, r1) + second, "OFF_BY_ONE_PERIOD", "Did not accumulate the early borrowing through the later period."),
          distractor(total * (1 + r2), "ANNUITY_DUE_CONFUSION", "Treated the borrowings as made at the start of each month."),
        ],
        solutionSteps: `**Step 1 — Early borrowings.** At $${dec(r1, 4)}$ per month they total $${mn(B)}\\,s_{\\overline{${12 * years1}}|} = ${mn(B * sn(12 * years1, r1), 2)}$ at the rate change, then grow at $${dec(r2, 4)}$: $${mn(first, 2)}$.

**Step 2 — Later borrowings.** $${mn(B)}\\,s_{\\overline{${12 * years2}}|${dec(r2, 4)}} = ${mn(second, 2)}$. The total is $${mn(total, 2)}$.`,
        checks: [{ label: "between single-rate bounds", ok: total > B * sn(12 * (years1 + years2), r1) && total < B * sn(12 * (years1 + years2), r2) }],
      };
    },
  },

  {
    id: "FM_LOAN_PRINCIPAL_LATER_PAYMENT",
    domain: LOANS,
    title: "Principal and Interest in a Later Payment",
    objective: "Use the geometric growth of principal portions to find a later principal or interest portion.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    soaSamples: [131, 251, 279, 161],
    generate: (rng: Rng): GeneratedQuestionItem => {
      if (rng.next() < 0.6) {
        const i = gridRate(rng, 0.06, 0.12, 0.01);
        const a = rng.int(2, 12);
        const b = a + rng.choice([12, 18, 24, 30]);
        const Pa = gridAmount(rng, 300, 1000, 50);
        const r = Math.pow(1 + i, 1 / 12) - 1;
        const Pb = Pa * acc(r, b - a);
        return {
          questionText: `A loan is amortized with level payments at the end of each month at ${eff(i)}. The principal repaid in the ${ord(a)} month is ${n(Pa)}.
Calculate the principal repaid in the ${ord(b)} month.`,
          variables: { variant: "PRINCIPAL", i, a, b, Pa },
          correctValue: Pb,
          format: "AMOUNT_0",
          distractors: [
            distractor(Pa * acc(i / 12, b - a), "NOMINAL_RATE_ERROR", `Used ${pc(i)}/12 as the monthly rate.`),
            distractor(Pa * (1 + (i * (b - a)) / 12), "SIMPLE_INTEREST_ERROR", "Grew the principal portion with simple interest."),
            distractor(Pa * acc(r, b - a + 1), "OFF_BY_ONE_PERIOD", "Grew the principal portion one month too many."),
            distractor(Pa * acc(i, b - a), "NOMINAL_RATE_ERROR", "Applied the annual rate each month."),
          ],
          solutionSteps: `**Step 1 — Monthly rate.** $j = (${dec(1 + i, 2)})^{1/12} - 1 = ${dec(r, 6)}$.

**Step 2 — Principal portions grow geometrically.** $P_{${b}} = P_{${a}}(1 + j)^{${b - a}} = ${mn(Pa)}(${dec(1 + i, 2)})^{${b - a}/12} = ${mn(Pb, 2)}$.`,
          checks: [{ label: "principal grows", ok: Pb > Pa }],
        };
      }
      const nominal = gridRate(rng, 0.06, 0.12, 0.02);
      const m = rng.choice([4, 12]);
      const years = rng.choice([5, 10]);
      const r = nominal / m;
      const count = m * years;
      const a = rng.int(5, Math.floor(count / 2));
      const b = a + rng.int(5, Math.floor(count / 3));
      const Pa = cents(gridAmount(rng, 1000, 12000, 1) + rng.int(1, 99) / 100);
      const R = Pa * acc(r, count - a + 1);
      const interestB = R - Pa * acc(r, b - a);
      return {
        questionText: `A small business takes out a ${years}-year loan with level end-of-${m === 4 ? "quarter" : "month"} payments based on ${nom(nominal, m)}.
The principal repaid in the ${ord(a)} payment is ${n(Pa, 2)}.
Calculate the interest paid in the ${ord(b)} payment.`,
        variables: { variant: "INTEREST", nominal, m, years, a, b, Pa },
        correctValue: interestB,
        format: "AMOUNT_0",
        distractors: [
          distractor(Pa * acc(r, b - a), "CALCULATION_DISTRACTOR", "Computed the principal in that payment instead of the interest."),
          distractor(R - Pa * acc(r, b - a + 1), "OFF_BY_ONE_PERIOD", "Grew the principal portion one period too many."),
          distractor(Pa * acc(r, count - a) - Pa * acc(r, b - a), "OFF_BY_ONE_PERIOD", "Understated the level payment by one period of growth."),
          distractor(R - Pa, "CALCULATION_DISTRACTOR", `Used the interest in the ${ord(a)} payment.`),
        ],
        solutionSteps: `**Step 1 — Level payment.** $P_{${a}} = R\\,v^{${count} - ${a} + 1}$, so $R = ${mn(Pa, 2)}(${dec(1 + r, 4)})^{${count - a + 1}} = ${mn(R, 2)}$.

**Step 2 — Payment ${b}.** Its principal is $${mn(Pa, 2)}(${dec(1 + r, 4)})^{${b - a}} = ${mn(Pa * acc(r, b - a), 2)}$, so its interest is $${mn(R, 2)} - ${mn(Pa * acc(r, b - a), 2)} = ${mn(interestB, 2)}$.`,
        checks: [{ label: "interest positive", ok: interestB > 0 }],
      };
    },
  },

  {
    id: "FM_LOAN_STEP_DOWN_INTEREST_RATIO",
    domain: LOANS,
    title: "Interest Portions of a Loan whose Payments Step Down",
    objective: "Relate interest portions before and after a change in the payment to find an interest portion without the rate.",
    difficulty: 3,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [132],
    generate: (rng: Rng) => {
      const [borrower] = cast(rng);
      const params = drawUntil(
        () => {
          const A = gridAmount(rng, 600, 2000, 50);
          const B = gridAmount(rng, 400, A - 100, 50);
          const k = rng.choice([1.5, 2, 2.5, 3]);
          const x = (k * B - A) / B;
          return { A, B, k, x };
        },
        (p) => p.x > 0.35 && p.x < 0.85,
        { A: 1200, B: 900, k: 2, x: 2 / 3 }
      );
      const { A, B, k, x } = params;
      const I21 = B * (1 - x);
      return {
        questionText: `${borrower} repays a 30-year loan with a payment at the end of each year. Each of the first 20 payments is ${n(A)}, and each of the last 10 payments is ${n(B)}. Interest is charged at an annual effective rate of $i$, $i > 0$.
The interest portion of the 11th payment is ${k} times the interest portion of the 21st payment.
Calculate the interest portion of the 21st payment.`,
        variables: { A, B, k },
        correctValue: I21,
        format: "AMOUNT_0",
        distractors: [
          distractor(A * (1 - x), "CALCULATION_DISTRACTOR", "Applied the first payment amount to the last ten years."),
          distractor(B * x, "CALCULATION_DISTRACTOR", "Reported the principal portion of the 21st payment."),
          distractor(k * I21, "CALCULATION_DISTRACTOR", "Reported the interest portion of the 11th payment."),
          distractor((A - B) / k, "SIMPLE_INTEREST_ERROR", "Divided the payment difference by the ratio."),
        ],
        solutionSteps: `**Step 1 — Balances.** With $x = v^{10}$: $B_{20} = ${n(B)}\\,a_{\\overline{10}|}$ and $B_{10} = ${n(A)}\\,a_{\\overline{10}|} + ${n(B)}\\,x\\,a_{\\overline{10}|}$.

**Step 2 — Interest portions.** $I_{21} = iB_{20} = ${n(B)}(1 - x)$ and $I_{11} = iB_{10} = (${n(A)} + ${n(B)}x)(1 - x)$.

**Step 3 — Use the ratio.** $${n(A)} + ${n(B)}x = ${k}(${n(B)})$ gives $x = ${dec(x, 4)}$, so $I_{21} = ${n(B)}(1 - ${dec(x, 4)}) = ${mn(I21, 2)}$. The rate is never needed.`,
        checks: [{ label: "ratio holds", ok: close((A + B * x) * (1 - x), k * B * (1 - x)) }],
      };
    },
  },

  {
    id: "FM_LOAN_EXTRA_PAYMENT_REAMORTIZE",
    domain: LOANS,
    title: "Extra Payment followed by a Shorter Repayment Period",
    objective: "Reduce the outstanding balance by an extra payment and reamortize it over a new term.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [134, 218, 288],
    generate: (rng: Rng) => {
      const years = rng.choice([15, 20, 25]);
      const R = gridAmount(rng, 300, 2000, 50);
      const i = gridRate(rng, 0.05, 0.09, 0.01);
      const k = rng.int(4, 8);
      const extra = R * rng.choice([2, 2.5, 3]);
      const remaining = rng.choice([5, 10, 15].filter((term) => term < years - k));
      const B = R * an(years - k, i) - extra;
      const X = B / an(remaining, i);
      return {
        questionText: `A ${years}-year loan is being repaid with payments of ${n(R)} at the end of each year, based on ${eff(i)}.
The borrower pays an additional ${n(extra)} at the time of the ${ord(k)} payment, and then repays the remaining balance with a payment of $X$ at the end of each of the next ${remaining} years.
Calculate $X$.`,
        variables: { years, R, i, k, extra, remaining },
        correctValue: X,
        format: "AMOUNT_2",
        distractors: [
          distractor((R * an(years - k + 1, i) - extra) / an(remaining, i), "OFF_BY_ONE_PERIOD", `Counted ${years - k + 1} payments still due after the ${ord(k)}.`),
          distractor((R * an(years - k, i) - extra * acc(i, 1)) / an(remaining, i), "OFF_BY_ONE_PERIOD", "Accumulated the extra payment by a year before subtracting it."),
          distractor(R * an(years - k, i) / an(remaining, i), "CALCULATION_DISTRACTOR", "Forgot to subtract the extra payment."),
          distractor(B / adue(remaining, i), "ANNUITY_DUE_CONFUSION", "Treated the new payments as an annuity-due."),
        ],
        solutionSteps: `**Step 1 — Balance after the ${ord(k)} regular payment.** $${mn(R)}\\,a_{\\overline{${years - k}}|${mpc(i)}} = ${mn(R * an(years - k, i), 2)}$.

**Step 2 — Subtract the extra payment.** $${mn(R * an(years - k, i), 2)} - ${mn(extra)} = ${mn(B, 2)}$.

**Step 3 — New payment.** $X = ${mn(B, 2)}/a_{\\overline{${remaining}}|} = ${mn(X, 2)}$.`,
        checks: [{ label: "balance positive", ok: B > 0 }],
      };
    },
  },

  {
    id: "FM_LOAN_STEPPED_INTEREST_FIRST_PAYMENTS",
    domain: LOANS,
    title: "Interest in the Early Payments of a Stepped Loan",
    objective: "Find the loan from stepped payments and total the interest in the first block of payments.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 3,
    soaSamples: [177],
    generate: (rng: Rng) => {
      const A = gridAmount(rng, 500, 3000, 500);
      const B = A * rng.choice([1.5, 2, 3]);
      const h = rng.choice([4, 5, 6]);
      const i = gridRate(rng, 0.05, 0.1, 0.01);
      const L = A * an(h, i) + B * v(i, h) * an(h, i);
      const balanceAfter = B * an(h, i);
      const interest = h * A - (L - balanceAfter);
      return {
        questionText: `A ${2 * h}-year loan is repaid with payments at the end of each year. Each of the first ${h} payments is ${n(A)}, and each of the next ${h} payments is ${n(B)}.
Interest is charged at ${eff(i)}.
Calculate the total interest paid in the first ${word(h)} payments.`,
        variables: { A, B, h, i },
        correctValue: interest,
        format: "AMOUNT_0",
        distractors: [
          distractor(h * A, "CALCULATION_DISTRACTOR", "Treated the first payments as pure interest."),
          distractor(L * i * h, "SIMPLE_INTEREST_ERROR", "Charged interest on the original loan every year."),
          distractor(h * A - (L - balanceAfter) * v(i, 1), "CALCULATION_DISTRACTOR", "Discounted the principal repaid."),
          distractor(L - A * an(h, i), "CALCULATION_DISTRACTOR", "Reported the balance repaid by the later payments."),
        ],
        solutionSteps: `**Step 1 — Loan amount.** $${mn(A)}\\,a_{\\overline{${h}}|} + ${mn(B)}\\,v^{${h}}a_{\\overline{${h}}|} = ${mn(L, 2)}$.

**Step 2 — Principal repaid in the first ${h} payments.** The balance after them is $${mn(B)}\\,a_{\\overline{${h}}|} = ${mn(balanceAfter, 2)}$, so $${mn(L - balanceAfter, 2)}$ of principal was repaid.

**Step 3 — Interest.** $${h}(${mn(A)}) - ${mn(L - balanceAfter, 2)} = ${mn(interest, 2)}$.`,
        checks: [
          {
            label: "ledger",
            ok: (() => {
              let bal = L;
              let total = 0;
              for (let y = 0; y < h; y += 1) {
                total += bal * i;
                bal = bal * (1 + i) - A;
              }
              return close(total, interest);
            })(),
          },
        ],
      };
    },
  },

  {
    id: "FM_LOAN_DROP_INTEREST_IN_PAYMENT",
    domain: LOANS,
    title: "Interest in a Payment of a Loan with a Drop Payment",
    objective: "Compute the interest portion of a given payment from the retrospective balance.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    soaSamples: [190],
    generate: (rng: Rng) => {
      const L = gridAmount(rng, 5000, 20000, 1000);
      const j = gridRate(rng, 0.08, 0.16, 0.02);
      const m = rng.choice([4, 12]);
      const r = j / m;
      const R = Math.round((L / rng.int(12, 20)) / 100) * 100;
      const nStar = termFor(L, R, r);
      const k = rng.int(4, Math.max(5, Math.floor(nStar) - 2));
      const interest = r * retro(L, R, r, k - 1);
      return {
        questionText: `A loan of ${n(L)} is being repaid by payments of ${n(R)} at the end of each ${m === 4 ? "quarter" : "month"} for as long as necessary, plus a drop payment.
The annual nominal rate of interest on the loan is ${pc(j)} convertible ${m === 4 ? "quarterly" : "monthly"}.
Calculate the amount of interest in the ${ord(k)} payment.`,
        variables: { L, j, m, R, k },
        correctValue: interest,
        format: "AMOUNT_0",
        distractors: [
          distractor(r * retro(L, R, r, k), "OFF_BY_ONE_PERIOD", `Used the balance after the ${ord(k)} payment.`),
          distractor(R - r * retro(L, R, r, k - 1), "CALCULATION_DISTRACTOR", "Computed the principal portion instead."),
          distractor(j * retro(L, R, r, k - 1), "NOMINAL_RATE_ERROR", "Applied the annual nominal rate to one period."),
          distractor(r * (L - (k - 1) * R), "SIMPLE_INTEREST_ERROR", "Reduced the balance by the full payments, ignoring interest."),
        ],
        solutionSteps: `**Step 1 — Balance just after payment ${k - 1}.** At $${dec(r, 4)}$ per period,
$$${mn(L)}(${dec(1 + r, 4)})^{${k - 1}} - ${mn(R)}\\,s_{\\overline{${k - 1}}|} = ${mn(retro(L, R, r, k - 1), 2)}.$$

**Step 2 — Interest in payment ${k}.** $${dec(r, 4)} \\times ${mn(retro(L, R, r, k - 1), 2)} = ${mn(interest, 2)}$.`,
        checks: [{ label: "interest below the payment", ok: interest > 0 && interest < R }],
      };
    },
  },

  {
    id: "FM_LOAN_MIDYEAR_SIMPLE_INTEREST",
    domain: LOANS,
    title: "Balance Partway through a Year with Simple Interest within the Year",
    objective: "Compute a balance between payment dates when the lender uses simple interest within each year.",
    difficulty: 2,
    topics: ["LOAN_MECHANICS"],
    steps: 2,
    soaSamples: [203],
    generate: (rng: Rng) => {
      const L = gridAmount(rng, 5000, 50000, 1000);
      const years = rng.choice([8, 10, 12, 15]);
      const i = gridRate(rng, 0.05, 0.1, 0.01);
      const year = rng.int(2, years - 2);
      const fraction = rng.choice([0.25, 0.5, 0.75]);
      const R = L / an(years, i);
      const start = retro(L, R, i, year - 1);
      const balance = start * (1 + fraction * i);
      const label = fraction === 0.5 ? "halfway through" : fraction === 0.25 ? "one quarter of the way through" : "three quarters of the way through";
      return {
        questionText: `A loan of ${n(L)} is to be repaid by level payments at the end of each year for ${years} years. The loan's annual effective interest rate is ${pc(i)}, which the lender uses to compute the payment and the balance at the end of each year.
For balances during a year, the lender uses an annual simple interest rate of ${pc(i)}.
Calculate the balance of the loan ${label} the ${ord(year)} year.`,
        variables: { L, years, i, year, fraction },
        correctValue: balance,
        format: "AMOUNT_0",
        distractors: [
          distractor(start * Math.pow(1 + i, fraction), "SIMPLE_INTEREST_ERROR", "Used compound interest within the year."),
          distractor(retro(L, R, i, year) * (1 + fraction * i), "OFF_BY_ONE_PERIOD", `Started from the balance at the end of year ${year}.`),
          distractor(start, "CALCULATION_DISTRACTOR", "Ignored interest accrued during the year."),
          distractor(retro(L, R, i, year - 2) * (1 + fraction * i), "OFF_BY_ONE_PERIOD", `Started from the balance at the end of year ${year - 2}.`),
        ],
        solutionSteps: `**Step 1 — Balance at the start of year ${year}.** The payment is $${mn(L)}/a_{\\overline{${years}}|} = ${mn(R, 2)}$, so after ${year - 1} payments the balance is $${mn(start, 2)}$.

**Step 2 — Simple interest for part of the year.** $${mn(start, 2)}\\left(1 + ${fraction}(${dec(i, 2)})\\right) = ${mn(balance, 2)}$.`,
        checks: [{ label: "between start and end balances", ok: balance > start }],
      };
    },
  },
];
