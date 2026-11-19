/**
 * Quick checks: short true-or-false statements about what the formulas mean,
 * when they apply and how the quantities move — the conceptual content of the
 * two reference sheets, plus the standard results behind them. Each is
 * answered with instant feedback: the verdict, the reason and where it is on
 * the sheets.
 *
 * Where a statement is quantitative it carries `check`, which recomputes it
 * at sample values; `scripts/tests/study.test.ts` requires `check()` to equal
 * the stated truth value, so no statement can be marked with the wrong verdict.
 */
import { Da, Ia, adue, an, sdue, sn, v } from "../engine/finance";
import type { FormulaArea } from "../formulas/types";
import type { TopicId } from "../syllabus";

export interface SheetRef {
  doc: "TIA" | "ACTEX";
  /** PDF page (TIA: A.1 p4 … G.3 p15; ACTEX: p2–p5). */
  page: number;
  section: string;
}

export interface QuickCheck {
  id: string;
  topic: TopicId;
  area: FormulaArea;
  /** The statement (markup). */
  text: string;
  truth: boolean;
  /** Why it is true or false (markup). */
  why: string;
  sources?: SheetRef[];
  /** Formula library id, for the link to the full entry. */
  formula?: string;
  /** Recomputes the statement at sample values; must return `truth`. */
  check?: () => boolean;
}

const tia = (page: number, section: string): SheetRef => ({ doc: "TIA", page, section });
const actex = (page: number, section: string): SheetRef => ({ doc: "ACTEX", page, section });

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const RATES = [0.01, 0.04, 0.07, 0.12];
const iM = (i: number, m: number) => m * (Math.pow(1 + i, 1 / m) - 1);
const dM = (i: number, m: number) => m * (1 - Math.pow(1 + i, -1 / m));
const dOf = (i: number) => i / (1 + i);
const flows = (coupon: number, n: number, face = 100) => Array.from({ length: n }, (_, k) => ({ t: k + 1, amount: coupon + (k + 1 === n ? face : 0) }));
const price = (fl: { t: number; amount: number }[], i: number) => fl.reduce((a, f) => a + f.amount * v(i, f.t), 0);
const macaulay = (fl: { t: number; amount: number }[], i: number) => fl.reduce((a, f) => a + f.t * f.amount * v(i, f.t), 0) / price(fl, i);

export const QUICK_CHECKS: QuickCheck[] = [
  // ============================================================ TVM
  {
    id: "simple-rate-falls",
    topic: "TVM",
    area: "A",
    text: "Under simple interest the amount of interest earned each year is constant, but the effective annual rate of interest falls over time.",
    truth: true,
    why: "Each year earns $i$ on the original principal, but the opening balance $1 + i(t-1)$ keeps growing, so $i_t = i/(1 + i(t-1))$ falls.",
    sources: [tia(4, "Simple interest"), actex(2, "Simple Interest")],
    formula: "A.simple",
    check: () => {
      const rates = [1, 2, 3, 4, 5].map((t) => 0.05 / (1 + 0.05 * (t - 1)));
      return rates.every((r, k) => k === 0 || r < rates[k - 1]);
    },
  },
  {
    id: "compound-amount-constant",
    topic: "TVM",
    area: "A",
    text: "Under compound interest the *amount* of interest earned each period is constant.",
    truth: false,
    why: "Under compound interest the effective *rate* is constant; the amount of interest grows because interest earns interest.",
    sources: [tia(4, "Compound interest")],
    formula: "A.compound",
  },
  {
    id: "a0-one",
    topic: "TVM",
    area: "A",
    text: "Every accumulation function satisfies $a(0) = 1$.",
    truth: true,
    why: "$a(t)$ is the value at $t$ of 1 invested at 0, so at time 0 it is 1 by definition. The amount function is $A(t) = K\\,a(t)$ with $A(0) = K$.",
    sources: [tia(4, "Accumulation factor"), actex(2, "Accumulation and Amount Functions")],
    formula: "A.accumulation",
  },
  {
    id: "dt-uses-start",
    topic: "TVM",
    area: "A",
    text: "The effective rate of discount $d_t$ divides the interest earned in period $t$ by the amount at the *start* of the period.",
    truth: false,
    why: "That describes $i_t$. The discount rate divides by the amount at the *end* of the period: $d_t = \\frac{a(t) - a(t-1)}{a(t)}$.",
    sources: [tia(4, "Effective rate of interest & discount")],
    formula: "A.effective-discount",
  },
  {
    id: "d-less-than-i",
    topic: "TVM",
    area: "A",
    text: "For any positive rate of interest, $d < i$.",
    truth: true,
    why: "$d = i/(1+i)$ divides the same interest by a larger amount (the end-of-period value).",
    sources: [actex(2, "Discount Rate")],
    formula: "A.interest-discount",
    check: () => RATES.every((i) => dOf(i) < i),
  },
  {
    id: "reciprocal-d-i",
    topic: "TVM",
    area: "A",
    text: "$\\frac{1}{d} - \\frac{1}{i} = 1$.",
    truth: true,
    why: "$1/d = (1+i)/i = 1/i + 1$. It is also $\\ddot a_{\\overline{\\infty|}} - a_{\\overline{\\infty|}} = 1$: the due perpetuity has one extra payment.",
    sources: [actex(2, "Discount Rate")],
    formula: "A.interest-discount",
    check: () => RATES.every((i) => near(1 / dOf(i) - 1 / i, 1)),
  },
  {
    id: "d-equals-iv",
    topic: "TVM",
    area: "A",
    text: "$d = iv$: the discount rate is the interest rate discounted one period.",
    truth: true,
    why: "Interest paid in advance is worth the interest paid at the end, discounted one period.",
    sources: [actex(2, "Discount Rate")],
    formula: "A.interest-discount",
    check: () => RATES.every((i) => near(dOf(i), i * v(i, 1))),
  },
  {
    id: "im-exceeds-i",
    topic: "TVM",
    area: "A",
    text: "For $i > 0$ and $m > 1$, the equivalent nominal rate $i^{(m)}$ is larger than $i$.",
    truth: false,
    why: "Compounding $m$ times a year adds interest on interest, so less nominal rate is needed: $i^{(m)} < i$.",
    formula: "A.nominal-conversion",
    check: () => RATES.every((i) => [2, 4, 12].every((m) => iM(i, m) > i)),
  },
  {
    id: "rate-ordering",
    topic: "TVM",
    area: "A",
    text: "For $i > 0$ and $m > 1$: $d < d^{(m)} < \\delta < i^{(m)} < i$.",
    truth: true,
    why: "All five describe the same growth. Rates paid later or less often must be larger; $\\delta$, paid continuously, sits in the middle.",
    formula: "A.nominal-equivalence",
    check: () => RATES.every((i) => [2, 4, 12].every((m) => dOf(i) < dM(i, m) && dM(i, m) < Math.log(1 + i) && Math.log(1 + i) < iM(i, m) && iM(i, m) < i)),
  },
  {
    id: "im-increases",
    topic: "TVM",
    area: "A",
    text: "As the number of conversions $m$ increases, $i^{(m)}$ increases toward $i$.",
    truth: false,
    why: "$i^{(1)} = i$ and $i^{(m)}$ *decreases* as $m$ grows, toward $\\delta$; $d^{(m)}$ increases toward $\\delta$ from below.",
    formula: "A.nominal-conversion",
    check: () => iM(0.08, 12) > iM(0.08, 4),
  },
  {
    id: "nominal-quarterly",
    topic: "TVM",
    area: "A",
    text: "A nominal rate of 8% convertible quarterly credits 2% interest every quarter.",
    truth: true,
    why: "$i^{(m)}/m$ is the effective rate per $m$-th of a year: $8\\%/4 = 2\\%$ a quarter, an effective annual rate of $1.02^4 - 1 = 8.24\\%$.",
    sources: [tia(4, "Nominal rates of interest & discount")],
    formula: "A.nominal-equivalence",
  },
  {
    id: "force-compound-constant",
    topic: "TVM",
    area: "A",
    text: "Under compound interest the force of interest is constant, $\\delta = \\ln(1+i)$.",
    truth: true,
    why: "$\\delta_t = \\frac{d}{dt}\\ln(1+i)^t = \\ln(1+i)$, the same at every $t$.",
    sources: [tia(4, "Force of interest"), actex(2, "Constant Force of Interest")],
    formula: "A.constant-force",
  },
  {
    id: "scaled-force",
    topic: "TVM",
    area: "A",
    text: "If the force of interest is doubled at every time $t$, the accumulation function is doubled.",
    truth: false,
    why: "It is *squared*: if $\\delta^*_t = k\\,\\delta_t$ then $a^*(t) = [a(t)]^k$, because the force sits in an exponent.",
    sources: [tia(4, "Force of interest")],
    formula: "A.scaled-force",
    check: () => {
      const a = (t: number) => Math.exp(0.05 * t);
      const aStar = (t: number) => Math.exp(0.1 * t);
      return near(aStar(3), 2 * a(3));
    },
  },
  {
    id: "simple-force-falls",
    topic: "TVM",
    area: "A",
    text: "Under simple interest the force of interest $\\delta_t = \\frac{i}{1 + it}$ decreases over time.",
    truth: true,
    why: "$\\delta_t = a'(t)/a(t) = i/(1 + it)$: a constant numerator over a growing denominator.",
    formula: "A.force-definition",
  },
  {
    id: "varying-force-shift",
    topic: "TVM",
    area: "A",
    text: "Under a varying force of interest, the factor that accumulates 1 from $t_1$ to $t_2$ depends only on $t_2 - t_1$.",
    truth: false,
    why: "It is $\\exp\\int_{t_1}^{t_2}\\delta_s\\,ds$, which depends on *which* dates are spanned. Only a constant force makes it depend on the length alone.",
    sources: [tia(4, "Force of interest"), actex(2, "AV at time t2 for $1 invested at time t1")],
    formula: "A.force-accumulation",
    check: () => {
      const F = (a: number, b: number) => Math.exp(0.02 * (b - a) + 0.005 * (b * b - a * a));
      return near(F(0, 2), F(3, 5));
    },
  },
  {
    id: "eov-any-date",
    topic: "TVM",
    area: "A",
    text: "With compound interest an equation of value may be written at any comparison date and gives the same answer.",
    truth: true,
    why: "Moving every term by the same factor $(1+i)^k$ multiplies both sides equally.",
    sources: [tia(5, "Equations of value")],
    formula: "A.equation-of-value",
  },
  {
    id: "eov-simple-date",
    topic: "TVM",
    area: "A",
    text: "With simple interest, the choice of comparison date can change the answer to an equation of value.",
    truth: true,
    why: "Simple-interest factors do not chain: $(1 + is)(1 + it) \\ne 1 + i(s+t)$, so moving the comparison date changes the equation.",
    // 100 due at time 2 at 10% simple interest: discounting straight to 0 versus via time 1.
    check: () => !near(100 / (1 + 0.1 * 2), 100 / (1 + 0.1) / (1 + 0.1)),
  },
  {
    id: "real-rate-exact",
    topic: "TVM",
    area: "F",
    text: "The real rate of interest is exactly the nominal rate minus the inflation rate, $i - r$.",
    truth: false,
    why: "$i - r$ is an approximation. Exactly, $1 + i = (1 + i')(1 + r)$, so $i' = \\frac{i - r}{1 + r}$.",
    sources: [tia(12, "Real rates of interest"), actex(5, "Inflation Rate")],
    formula: "F.real-rate",
    check: () => near((0.08 - 0.03) / 1.03, 0.08 - 0.03),
  },
  {
    id: "real-rate-negative",
    topic: "TVM",
    area: "F",
    text: "If inflation exceeds the nominal rate of interest, the real rate is negative.",
    truth: true,
    why: "$i' = (i - r)/(1 + r) < 0$ when $r > i$: money grows more slowly than prices.",
    formula: "F.real-rate",
    check: () => (0.03 - 0.05) / 1.05 < 0,
  },
  {
    id: "discount-ways",
    topic: "TVM",
    area: "A",
    text: "To discount a payment from time $t$ to time $t - 1$ you can multiply by $(1 - d_t)$.",
    truth: true,
    why: "$v_t = 1 - d_t = 1/(1 + i_t)$. The four ways: $\\times a(t-1)/a(t)$, $\\div(1 + i_t)$, $\\times(1 - d_t)$, $\\times v_t$.",
    sources: [tia(4, "Summary of ways to discount")],
    formula: "A.discount-factor",
  },
  {
    id: "accumulate-divide-v",
    topic: "TVM",
    area: "A",
    text: "To accumulate from time $t - 1$ to time $t$ you can divide by $v_t$.",
    truth: true,
    why: "Dividing by $v_t$ is multiplying by $1 + i_t$. Equally, divide by $1 - d_t$.",
    sources: [tia(4, "Summary of ways to accumulate")],
    formula: "A.discount-factor",
  },
  {
    id: "pv-equivalences",
    topic: "TVM",
    area: "A",
    text: "Under compound interest, $v^t = e^{-\\delta t} = (1 - d)^t$.",
    truth: true,
    why: "All are the present value of 1 due at $t$, written with $i$, $\\delta$ and $d$.",
    sources: [actex(2, "PV of $1 Due in t Years")],
    formula: "A.discount-factor",
    check: () => RATES.every((i) => near(v(i, 3.5), Math.exp(-Math.log(1 + i) * 3.5)) && near(v(i, 3.5), Math.pow(1 - dOf(i), 3.5))),
  },
  {
    id: "four-quantities",
    topic: "TVM",
    area: "A",
    text: "An interest problem involves principal, term, rate and accumulated value; given any three you can find the fourth.",
    truth: true,
    why: "This is the “basic problem” of interest: one equation, one unknown.",
    sources: [tia(5, "The basic problem")],
  },
  {
    id: "nominal-discount-when",
    topic: "TVM",
    area: "A",
    text: "Under a nominal discount rate $d^{(m)}$, the discount $d^{(m)}/m$ is deducted at the *end* of each $m$-th of a year.",
    truth: false,
    why: "Discount is deducted at the *start* of each period, on the amount due at its end.",
    formula: "A.nominal-equivalence",
  },
  {
    id: "more-compounding-higher",
    topic: "TVM",
    area: "A",
    text: "For a fixed nominal rate, more frequent compounding gives a higher effective annual rate.",
    truth: true,
    why: "$(1 + j/m)^m$ increases with $m$ (toward $e^{j}$).",
    formula: "A.nominal-equivalence",
    check: () => Math.pow(1 + 0.08 / 12, 12) > Math.pow(1 + 0.08 / 4, 4),
  },

  // ============================================================ Annuities
  {
    id: "a-valuation-date",
    topic: "ANNUITIES",
    area: "B",
    text: "$a_{\\overline{n|}}$ is valued one period before the first payment.",
    truth: true,
    why: "Annuity-immediate: PV one period before the first payment; AV $s_{\\overline{n|}}$ at the last payment.",
    sources: [tia(6, "Annuity-immediate"), actex(2, "Annuity-Immediate")],
    formula: "B.annuity-immediate",
  },
  {
    id: "s-valuation-date",
    topic: "ANNUITIES",
    area: "B",
    text: "$s_{\\overline{n|}}$ is valued one period after the last payment.",
    truth: false,
    why: "$s_{\\overline{n|}}$ is valued *at* the last payment. One period after is $\\ddot s_{\\overline{n|}}$.",
    sources: [tia(6, "Annuity-immediate / Annuity-due")],
    formula: "B.annuity-immediate-av",
  },
  {
    id: "adue-times",
    topic: "ANNUITIES",
    area: "B",
    text: "$\\ddot a_{\\overline{n|}} = (1+i)\\,a_{\\overline{n|}}$.",
    truth: true,
    why: "Every payment of the annuity-due is one period earlier, so worth $(1+i)$ times as much.",
    sources: [tia(6, "Annuity-due"), actex(2, "Annuity-Due")],
    formula: "B.annuity-due",
    check: () => RATES.every((i) => near(adue(10, i), (1 + i) * an(10, i))),
  },
  {
    id: "adue-one-plus",
    topic: "ANNUITIES",
    area: "B",
    text: "$\\ddot a_{\\overline{n|}} = 1 + a_{\\overline{n-1|}}$.",
    truth: true,
    why: "The first payment (at time 0) is worth 1; the other $n - 1$ form an annuity-immediate.",
    sources: [actex(2, "Annuity-Due")],
    formula: "B.annuity-due",
    check: () => RATES.every((i) => near(adue(10, i), 1 + an(9, i))),
  },
  {
    id: "sdue-identity",
    topic: "ANNUITIES",
    area: "B",
    text: "$\\ddot s_{\\overline{n|}} = s_{\\overline{n+1|}} - 1$.",
    truth: true,
    why: "Add an imaginary payment at the valuation date to get $s_{\\overline{n+1|}}$, then take it away.",
    sources: [actex(2, "Annuity-Due")],
    formula: "B.annuity-due-av",
    check: () => RATES.every((i) => near(sdue(10, i), sn(11, i) - 1)),
  },
  {
    id: "reciprocal-identity",
    topic: "ANNUITIES",
    area: "B",
    text: "$\\frac{1}{a_{\\overline{n|}}} = \\frac{1}{s_{\\overline{n|}}} + i$.",
    truth: true,
    why: "A loan of 1 can be repaid by interest $i$ each period plus a sinking-fund deposit $1/s_{\\overline{n|}}$.",
    formula: "B.reciprocal-identity",
    check: () => RATES.every((i) => near(1 / an(10, i), 1 / sn(10, i) + i)),
  },
  {
    id: "a2n",
    topic: "ANNUITIES",
    area: "B",
    text: "$a_{\\overline{2n|}} = a_{\\overline{n|}}(1 + v^n)$.",
    truth: true,
    why: "The second block of $n$ payments is the first block moved $n$ periods later.",
    sources: [tia(6, "Grouping payments"), tia(8, "Annuity tricks")],
    formula: "B.grouping",
    check: () => RATES.every((i) => near(an(16, i), an(8, i) * (1 + v(i, 8)))),
  },
  {
    id: "double-dots-cancel",
    topic: "ANNUITIES",
    area: "B",
    text: "If $X\\ddot a_{\\overline{n|}} = Y\\ddot a_{\\overline{m|}}$, then $Xa_{\\overline{n|}} = Ya_{\\overline{m|}}$.",
    truth: true,
    why: "Both sides are multiplied by the same $(1+i)$ — “double dots cancel”.",
    sources: [tia(8, "Annuity tricks")],
    formula: "B.annuity-tricks",
  },
  {
    id: "zero-percent-test",
    topic: "ANNUITIES",
    area: "B",
    text: "At 0% interest, the value of any annuity at any date is the sum of its payments.",
    truth: true,
    why: "With no interest, timing does not matter — a quick sanity check for any formula (the “0% test”).",
    sources: [tia(8, "Annuity tricks")],
    formula: "B.annuity-tricks",
  },
  {
    id: "perpetuity-due",
    topic: "ANNUITIES",
    area: "B",
    text: "$\\ddot a_{\\overline{\\infty|}} = \\frac{1}{d} = 1 + \\frac{1}{i}$.",
    truth: true,
    why: "A perpetuity-due is a perpetuity-immediate plus one payment now.",
    sources: [tia(6, "Perpetuity"), actex(3, "Perpetuity")],
    formula: "B.perpetuity",
    check: () => RATES.every((i) => near(1 / dOf(i), 1 + 1 / i)),
  },
  {
    id: "deferred-first-payment",
    topic: "ANNUITIES",
    area: "B",
    text: "In ${}_{m|}a_{\\overline{n|}}$, the first payment is made at time $m$.",
    truth: false,
    why: "The first payment is at time $m + 1$: the annuity-immediate is valued at $m$, one period before its first payment.",
    sources: [tia(6, "Deferred annuity"), actex(3, "Deferred Annuity")],
    formula: "B.deferred",
  },
  {
    id: "pyramid",
    topic: "ANNUITIES",
    area: "B",
    text: "Payments $1, 2, \\dots, n, \\dots, 2, 1$ at times $1, 2, \\dots, 2n - 1$ have present value $a_{\\overline{n|}}\\,\\ddot a_{\\overline{n|}}$.",
    truth: true,
    why: "Multiplying out $(v + \\dots + v^n)(1 + \\dots + v^{n-1})$ counts each time $k$ once for every way of reaching it — the pyramid.",
    sources: [tia(8, "Annuity tricks (pyramid annuity)")],
    formula: "B.annuity-tricks",
    check: () => {
      const n = 4;
      const i = 0.06;
      let total = 0;
      for (let t = 1; t <= 2 * n - 1; t += 1) total += (t <= n ? t : 2 * n - t) * v(i, t);
      return near(total, an(n, i) * adue(n, i));
    },
  },
  {
    id: "increasing-perpetuity",
    topic: "ANNUITIES",
    area: "B",
    text: "$(Ia)_{\\overline{\\infty|}} = \\frac{1}{id} = \\frac{1}{i} + \\frac{1}{i^2}$.",
    truth: true,
    why: "TIA writes $1/(id)$, ACTEX $1/i + 1/i^2$; they are equal since $1/d = 1 + 1/i$.",
    sources: [tia(7, "Varying annuities — arithmetic"), actex(3, "Increasing Perpetuity")],
    formula: "B.increasing-perpetuity",
    check: () => RATES.every((i) => near(1 / (i * dOf(i)), 1 / i + 1 / (i * i))),
  },
  {
    id: "decreasing-formula",
    topic: "ANNUITIES",
    area: "B",
    text: "$(Da)_{\\overline{n|}} = \\frac{n - a_{\\overline{n|}}}{i}$.",
    truth: true,
    why: "Decreasing payments $n, n-1, \\dots, 1$: “$n$ minus $a$, over $i$”.",
    sources: [tia(7, "Varying annuities — arithmetic"), actex(3, "Decreasing Annuity")],
    formula: "B.decreasing",
    check: () => {
      let s = 0;
      for (let k = 1; k <= 10; k += 1) s += (11 - k) * v(0.06, k);
      return near(s, Da(10, 0.06));
    },
  },
  {
    id: "ia-plus-da",
    topic: "ANNUITIES",
    area: "B",
    text: "$(Ia)_{\\overline{n|}} + (Da)_{\\overline{n|}} = (n + 1)\\,a_{\\overline{n|}}$.",
    truth: true,
    why: "Adding $1, 2, \\dots, n$ to $n, n-1, \\dots, 1$ gives $n + 1$ at every payment date.",
    formula: "B.decreasing",
    check: () => RATES.every((i) => near(Ia(10, i) + Da(10, i), 11 * an(10, i))),
  },
  {
    id: "geometric-finite",
    topic: "ANNUITIES",
    area: "B",
    text: "A geometric perpetuity growing at rate $r$ has a finite present value only if $r < i$.",
    truth: true,
    why: "The terms are $v\\,((1+r)/(1+i))^{k-1}$: the series converges only when the ratio is below 1.",
    sources: [tia(7, "Varying annuities — geometric")],
    formula: "B.geometric-perpetuity",
  },
  {
    id: "geometric-equal-rates",
    topic: "ANNUITIES",
    area: "B",
    text: "If the growth rate equals the interest rate ($r = i$), an $n$-payment geometric annuity-immediate with first payment 1 is worth $nv$.",
    truth: true,
    why: "Each payment $(1+i)^{k-1}$ discounted by $(1+i)^{-k}$ is worth exactly $v$.",
    sources: [tia(7, "Varying annuities — geometric (special case)")],
    formula: "B.geometric-annuity",
    check: () => {
      let s = 0;
      for (let k = 1; k <= 8; k += 1) s += Math.pow(1.05, k - 1) * v(0.05, k);
      return near(s, 8 * v(0.05, 1));
    },
  },
  {
    id: "mthly-larger",
    topic: "ANNUITIES",
    area: "B",
    text: "For $i > 0$ and $m > 1$, $a^{(m)}_{\\overline{n|}} > a_{\\overline{n|}}$.",
    truth: true,
    why: "The same total of 1 a year arrives earlier on average. In the formula, $i^{(m)} < i$ in the denominator.",
    sources: [tia(7, "Annuities payable m-thly")],
    formula: "B.mthly-annuity",
    check: () => RATES.every((i) => (1 - v(i, 10)) / iM(i, 12) > an(10, i)),
  },
  {
    id: "bgn-mode",
    topic: "ANNUITIES",
    area: "B",
    text: "On the calculator's TVM worksheet, BGN mode treats payments as occurring at the start of each period (annuity-due).",
    truth: true,
    why: "END: payments at $1, \\dots, N$; BGN: payments at $0, \\dots, N-1$.",
    sources: [tia(6, "TVM worksheet")],
    formula: "B.calculator",
  },
  {
    id: "fission",
    topic: "ANNUITIES",
    area: "B",
    text: "1 paid at the end of every $k$ years for $N$ years has present value $a_{\\overline{N|}}/s_{\\overline{k|}}$.",
    truth: true,
    why: "Each payment of 1 at the end of a $k$-year block is equivalent to $1/s_{\\overline{k|}}$ at the end of each year in the block.",
    sources: [tia(6, "Fission method")],
    formula: "B.fission",
    check: () => {
      let s = 0;
      for (let j = 1; j <= 5; j += 1) s += v(0.05, 4 * j);
      return near(s, an(20, 0.05) / sn(4, 0.05));
    },
  },
  {
    id: "continuous-ratio",
    topic: "ANNUITIES",
    area: "B",
    text: "$\\bar a_{\\overline{n|}} = \\frac{i}{\\delta}\\,a_{\\overline{n|}}$.",
    truth: true,
    why: "$\\bar a_{\\overline{n|}} = (1 - v^n)/\\delta$ and $a_{\\overline{n|}} = (1 - v^n)/i$. (Continuous annuities are on both sheets; their syllabus relevance is unclear.)",
    sources: [tia(7, "Level continuous annuities"), actex(3, "Continuous Annuity")],
    formula: "B.continuous",
    check: () => RATES.every((i) => near((1 - v(i, 10)) / Math.log(1 + i), (i / Math.log(1 + i)) * an(10, i))),
  },
  {
    id: "is-from-ia",
    topic: "ANNUITIES",
    area: "B",
    text: "$(Is)_{\\overline{n|}} = (Ia)_{\\overline{n|}}(1+i)^n$.",
    truth: true,
    why: "The same payments valued $n$ periods later.",
    sources: [tia(7, "Varying annuities — arithmetic")],
    formula: "B.increasing",
    check: () => RATES.every((i) => near((sdue(10, i) - 10) / i, Ia(10, i) * Math.pow(1 + i, 10))),
  },
  {
    id: "a-rises-with-rate",
    topic: "ANNUITIES",
    area: "B",
    text: "Raising the interest rate raises $a_{\\overline{n|}}$.",
    truth: false,
    why: "Higher rates discount future payments more heavily, so present values fall.",
    formula: "B.annuity-immediate",
    check: () => an(10, 0.08) > an(10, 0.06),
  },
  {
    id: "s-rises-with-rate",
    topic: "ANNUITIES",
    area: "B",
    text: "Raising the interest rate raises $s_{\\overline{n|}}$ (for $n > 1$).",
    truth: true,
    why: "Accumulated values grow faster at higher rates. (For $n = 1$, $s_{\\overline{1|}} = 1$ at every rate.)",
    formula: "B.annuity-immediate-av",
    check: () => sn(10, 0.08) > sn(10, 0.06),
  },

  // ============================================================ Yield rates
  {
    id: "npv-positive",
    topic: "ALM",
    area: "C",
    text: "If a project's NPV at the required return is positive, the project should be undertaken.",
    truth: true,
    why: "A positive NPV means the project returns more than the required rate.",
    sources: [tia(9, "Net present value")],
    formula: "C.npv",
  },
  {
    id: "irr-above-r",
    topic: "ALM",
    area: "C",
    text: "For a conventional project (an outlay followed by inflows), if the IRR exceeds the required return, the project should be undertaken.",
    truth: true,
    why: "For such a project NPV falls as the rate rises and is zero at the IRR, so NPV at a lower required rate is positive.",
    sources: [tia(9, "Internal rate of return")],
    formula: "C.irr",
  },
  {
    id: "irr-definition",
    topic: "ALM",
    area: "C",
    text: "The IRR is the rate at which the NPV of the net cash flows is zero.",
    truth: true,
    why: "$0 = \\sum (\\text{net CF})_t (1 + IRR)^{-t}$.",
    sources: [tia(9, "Internal rate of return")],
    formula: "C.irr",
  },
  {
    id: "multiple-irr",
    topic: "ALM",
    area: "C",
    text: "A project whose net cash flows change sign more than once can have more than one IRR.",
    truth: true,
    why: "The NPV is a polynomial in $v$; by Descartes' rule of signs it can have as many positive roots as sign changes.",
    formula: "C.irr",
    check: () => {
      // −100, +230, −132: NPV = 0 at 10% and at 20%.
      const npv = (r: number) => -100 + 230 / (1 + r) - 132 / Math.pow(1 + r, 2);
      return Math.abs(npv(0.1)) < 1e-9 && Math.abs(npv(0.2)) < 1e-9;
    },
  },
  {
    id: "reinvest-lower",
    topic: "BONDS",
    area: "C",
    text: "If interest received is reinvested at a rate $j$ lower than the rate $i$ it was earned at, the investor's overall yield is still $i$.",
    truth: false,
    why: "The overall yield falls between $j$ and $i$: the reinvested interest grows more slowly.",
    sources: [tia(9, "Reinvestment rates")],
    formula: "C.reinvestment",
    check: () => {
      const av = 1 + 0.07 * sn(10, 0.04);
      return near(Math.pow(av, 1 / 10) - 1, 0.07);
    },
  },
  {
    id: "have-demand",
    topic: "BONDS",
    area: "C",
    text: "With reinvestment, the investor's yield solves “what I have = what I demand”: inflows accumulated at the reinvestment rate equal outflows accumulated at the yield rate.",
    truth: true,
    why: "This is how TIA frames every reinvestment yield problem — understand the process rather than memorising a formula.",
    sources: [tia(9, "Yield rate")],
    formula: "C.yield-rate",
  },
  {
    id: "reinvest-same-rate",
    topic: "BONDS",
    area: "C",
    text: "If the interest on a deposit of 1 is reinvested at the same rate $i$, the accumulated value after $n$ years is $(1+i)^n$.",
    truth: true,
    why: "$1 + i\\,s_{\\overline{n|}i} = 1 + (1+i)^n - 1 = (1+i)^n$: reinvesting at $i$ is compounding.",
    sources: [actex(4, "Reinvestment Rates")],
    formula: "C.reinvestment",
    check: () => near(1 + 0.06 * sn(10, 0.06), Math.pow(1.06, 10)),
  },

  // ============================================================ Loans
  {
    id: "interest-first",
    topic: "LOANS",
    area: "D",
    text: "Under the amortization method each payment first pays the interest due; anything left reduces the balance.",
    truth: true,
    why: "$I_t = i\\,B_{t-1}$, and the principal part is the rest of the payment.",
    sources: [tia(10, "Amortization method")],
    formula: "D.interest-component",
  },
  {
    id: "prospective-definition",
    topic: "LOANS",
    area: "D",
    text: "The prospective outstanding balance is the present value of the payments still to be made.",
    truth: true,
    why: "Look forward: $B_t = P\\,a_{\\overline{n-t|}}$ for level payments.",
    sources: [tia(10, "Amortization method"), actex(4, "Amortization Method")],
    formula: "D.prospective",
  },
  {
    id: "retrospective-definition",
    topic: "LOANS",
    area: "D",
    text: "The retrospective balance is the accumulated value of the loan minus the accumulated value of the payments already made.",
    truth: true,
    why: "Look back: $B_t = L(1+i)^t - P\\,s_{\\overline{t|}}$ for level payments.",
    sources: [tia(10, "Amortization method"), actex(4, "Amortization Method")],
    formula: "D.retrospective",
  },
  {
    id: "pro-equals-retro",
    topic: "LOANS",
    area: "D",
    text: "For a level-payment loan at a fixed rate, the prospective and retrospective balances are equal.",
    truth: true,
    why: "Both follow from $L = P\\,a_{\\overline{n|}}$ moved to time $t$.",
    formula: "D.prospective",
    check: () => {
      const P = 10000 / an(12, 0.06);
      return near(P * an(7, 0.06), 10000 * Math.pow(1.06, 5) - P * sn(5, 0.06));
    },
  },
  {
    id: "principal-geometric",
    topic: "LOANS",
    area: "D",
    text: "With level payments, each principal component is $(1+i)$ times the previous one.",
    truth: true,
    why: "$R_t = Pv^{n-t+1}$, so $R_{t+1} = R_t(1+i)$.",
    sources: [actex(4, "Amortization Method")],
    formula: "D.principal-component",
    check: () => {
      const L = 10000;
      const P = L / an(12, 0.06);
      let b = L;
      const principal: number[] = [];
      for (let k = 0; k < 12; k += 1) {
        principal.push(P - 0.06 * b);
        b -= P - 0.06 * b;
      }
      return principal.every((r, k) => k === 0 || near(r, principal[k - 1] * 1.06));
    },
  },
  {
    id: "interest-constant",
    topic: "LOANS",
    area: "D",
    text: "With level payments, the interest component of every payment is the same.",
    truth: false,
    why: "Interest is $i$ times a shrinking balance, so it falls; the principal component rises.",
    formula: "D.interest-component",
  },
  {
    id: "total-interest",
    topic: "LOANS",
    area: "D",
    text: "The total interest paid over a level-payment loan is $nP - L$.",
    truth: true,
    why: "The payments total $nP$, of which the principal parts total $L$.",
    sources: [actex(4, "Amortization Method")],
    formula: "D.total-interest",
    check: () => {
      const L = 10000;
      const P = L / an(12, 0.06);
      let b = L;
      let total = 0;
      for (let k = 0; k < 12; k += 1) {
        total += b * 0.06;
        b -= P - b * 0.06;
      }
      return near(total, 12 * P - L);
    },
  },
  {
    id: "principal-sum",
    topic: "LOANS",
    area: "D",
    text: "The principal components of all the payments add up to the amount of the loan.",
    truth: true,
    why: "Every unit borrowed is repaid exactly once.",
    sources: [actex(4, "Amortization Method")],
    formula: "D.total-interest",
  },
  {
    id: "drop-larger",
    topic: "LOANS",
    area: "D",
    text: "A drop payment is a final payment *larger* than the regular payment.",
    truth: false,
    why: "A drop payment is *smaller*; a balloon payment is larger.",
    sources: [tia(10, "Drop vs. balloon payment")],
    formula: "D.drop-balloon",
  },
  {
    id: "first-principal",
    topic: "LOANS",
    area: "D",
    text: "With $n$ level payments $P$, the principal in the first payment is $Pv^n$.",
    truth: true,
    why: "$R_t = Pv^{n-t+1}$ with $t = 1$. Equivalently, $P - iL = P - iPa_{\\overline{n|}} = P(1 - (1 - v^n)) = Pv^n$.",
    formula: "D.principal-component",
    check: () => {
      const L = 10000;
      const P = L / an(12, 0.06);
      return near(P - 0.06 * L, P * v(0.06, 12));
    },
  },
  {
    id: "interest-on-which-balance",
    topic: "LOANS",
    area: "D",
    text: "The interest in payment $t$ is $i$ times the balance just *after* payment $t$.",
    truth: false,
    why: "It is $i$ times the balance just *before* payment $t$, i.e. after payment $t - 1$: $I_t = i\\,B_{t-1}$.",
    sources: [tia(10, "Amortization method")],
    formula: "D.interest-component",
  },
  {
    id: "refinance",
    topic: "LOANS",
    area: "D",
    text: "When a loan is refinanced after payment $k$, the new payments are found by setting their present value at the new rate equal to the outstanding balance $B_k$.",
    truth: true,
    why: "Refinancing replaces the remaining debt $B_k$ (calculated at the *old* rate) with a new loan of that amount at the new rate.",
    formula: "D.prospective",
  },
  {
    id: "double-term",
    topic: "LOANS",
    area: "D",
    text: "Doubling the term of a level-payment loan halves the payment.",
    truth: false,
    why: "Interest still has to be paid on the balance, so the payment falls by less than half: $a_{\\overline{2n|}} < 2a_{\\overline{n|}}$.",
    formula: "D.loan-payment",
    check: () => near(10000 / an(20, 0.06), (10000 / an(10, 0.06)) / 2),
  },
  {
    id: "negative-amortization",
    topic: "LOANS",
    area: "D",
    text: "If a payment is smaller than the interest due, the outstanding balance increases.",
    truth: true,
    why: "The principal part $P - I_t$ is negative, so the unpaid interest is added to the balance (negative amortization).",
    formula: "D.balance-recursion",
  },

  // ============================================================ Bonds
  {
    id: "premium-condition",
    topic: "BONDS",
    area: "E",
    text: "If the modified coupon rate $g$ exceeds the yield $i$, the bond sells at a premium.",
    truth: true,
    why: "$P - C = (Cg - Ci)\\,a_{\\overline{n|}} > 0$ when $g > i$ (equivalently $Fr > Ci$).",
    sources: [tia(11, "Bond premium and discount"), actex(4, "Bonds")],
    formula: "E.premium-discount",
    check: () => 1000 * 0.06 * an(10, 0.05) + 1000 * v(0.05, 10) > 1000,
  },
  {
    id: "discount-write-up",
    topic: "BONDS",
    area: "E",
    text: "The book value of a bond bought at a discount is written *up* toward the redemption value over its life.",
    truth: true,
    why: "Interest earned $i\\,BV_{t-1}$ exceeds the coupon, and the excess accrues to the book value.",
    sources: [tia(11, "Bond amortization")],
    formula: "E.bond-amortization",
  },
  {
    id: "premium-amount",
    topic: "BONDS",
    area: "E",
    text: "When $Fr > Ci$, the premium is $(Fr - Ci)\\,a_{\\overline{n|}}$.",
    truth: true,
    why: "Premium/discount formula: $P = C + (Fr - Ci)\\,a_{\\overline{n|}}$.",
    sources: [tia(11, "Bond premium and discount")],
    formula: "E.premium-discount",
    check: () => near(1000 * 0.06 * an(10, 0.05) + 1050 * v(0.05, 10) - 1050, (60 - 52.5) * an(10, 0.05)),
  },
  {
    id: "write-down-grows",
    topic: "BONDS",
    area: "E",
    text: "For a premium bond, each write-down is $(1+i)$ times the previous one.",
    truth: true,
    why: "Write-down$_t = (Fr - Ci)v^{n-t+1}$ — the bond version of the loan's principal components.",
    sources: [tia(11, "Bond amortization")],
    formula: "E.bond-amortization",
  },
  {
    id: "book-value-definition",
    topic: "BONDS",
    area: "E",
    text: "The book value at time $t$ is the present value, at the purchase yield, of the coupons and redemption still to come.",
    truth: true,
    why: "Prospectively, $BV_t = Fr\\,a_{\\overline{n-t|}} + Cv^{n-t}$ at the original yield.",
    sources: [tia(11, "Bond amortization"), actex(4, "Book Value at time t")],
    formula: "E.book-value",
  },
  {
    id: "c-equals-f",
    topic: "BONDS",
    area: "E",
    text: "Unless stated otherwise, assume the redemption value equals the face amount, $C = F$.",
    truth: true,
    why: "TIA's convention; a question with $C \\ne F$ always says so.",
    sources: [tia(11, "Bond notation")],
    formula: "E.price",
  },
  {
    id: "callable-premium-latest",
    topic: "BONDS",
    area: "E",
    text: "For a callable bond bought at a premium (constant redemption value), the worst yield for the investor occurs at the *latest* call date.",
    truth: false,
    why: "A premium is lost when the bond is redeemed, so early redemption hurts: the worst case is the *earliest* call date. For a discount bond it is the latest.",
    sources: [tia(11, "Yield of a callable bond"), actex(4, "Callable Bonds")],
    formula: "E.callable",
  },
  {
    id: "callable-discount-latest",
    topic: "BONDS",
    area: "E",
    text: "To guarantee a yield on a callable bond bought at a discount (constant redemption value), price it assuming the latest redemption date.",
    truth: true,
    why: "The discount is gained at redemption, so the longer it is delayed the lower the yield.",
    sources: [tia(11, "Yield of a callable bond"), actex(4, "Callable Bonds")],
    formula: "E.callable",
  },
  {
    id: "callable-lowest-price",
    topic: "BONDS",
    area: "E",
    text: "To be sure of earning a given yield on a callable bond, pay no more than the lowest of the prices computed at each possible call date.",
    truth: true,
    why: "The issuer chooses the date that is worst for the investor; the lowest price guarantees the yield whichever date is chosen.",
    sources: [tia(11, "Calculating price of a callable bond")],
    formula: "E.callable",
  },
  {
    id: "bond-interest-earned",
    topic: "BONDS",
    area: "E",
    text: "The interest earned in coupon period $t$ is $i\\,BV_{t-1}$.",
    truth: true,
    why: "Exactly as for a loan: interest on the opening balance.",
    sources: [tia(11, "Bond amortization"), actex(4, "Interest Earned")],
    formula: "E.bond-amortization",
  },
  {
    id: "par-bond-book",
    topic: "BONDS",
    area: "E",
    text: "A bond bought at par has a book value equal to its redemption value throughout its life.",
    truth: true,
    why: "At par $Fr = Ci$, so every write-down $(Fr - Ci)v^{n-t+1}$ is zero.",
    formula: "E.book-value",
  },
  {
    id: "security-order",
    topic: "BONDS",
    area: "E",
    text: "From most to least secure: bonds, preferred stock, common stock.",
    truth: true,
    why: "Debt holders are paid before preferred shareholders, who are paid before common shareholders.",
    sources: [tia(11, "Types of financial instruments")],
  },
  {
    id: "makeham",
    topic: "BONDS",
    area: "E",
    text: "Makeham's formula is $P = K + \\frac{g}{i}(C - K)$, where $K = Cv^n$ and $g = Fr/C$.",
    truth: true,
    why: "TIA's changelog (2026-08-04) corrected a misprint that showed $q$ in place of $g$.",
    sources: [tia(11, "Bond price formulas"), tia(2, "Changelog"), actex(4, "Price Formulas")],
    formula: "E.makeham",
    check: () => {
      const C = 1050;
      const g = 50 / C;
      const K = C * v(0.04, 10);
      return near(K + (g / 0.04) * (C - K), 50 * an(10, 0.04) + C * v(0.04, 10));
    },
  },
  {
    id: "yield-up-price-up",
    topic: "BONDS",
    area: "E",
    text: "If a bond's yield rises, its price rises.",
    truth: false,
    why: "Price is a present value: a higher discount rate gives a lower price.",
    formula: "G.price-function",
    check: () => price(flows(5, 10), 0.06) > price(flows(5, 10), 0.05),
  },
  {
    id: "zero-book-value",
    topic: "BONDS",
    area: "E",
    text: "The book value of a zero-coupon bond grows by the factor $(1 + i)$ every period.",
    truth: true,
    why: "$BV_t = Cv^{n-t}$, so $BV_{t+1}/BV_t = 1 + i$: all the interest is accrued, none paid.",
    formula: "E.book-value",
  },

  // ============================================================ Term structure
  {
    id: "spot-definition",
    topic: "ALM",
    area: "F",
    text: "The spot rate $s_t$ is the annual yield on a zero-coupon bond maturing at time $t$.",
    truth: true,
    why: "$(1 + s_t)^t$ accumulates from 0 to $t$; the zero-coupon price is $(1 + s_t)^{-t}$.",
    sources: [tia(12, "Spot rate"), actex(5, "Spot Rates")],
    formula: "F.spot",
  },
  {
    id: "spot-forward-chain",
    topic: "ALM",
    area: "F",
    text: "$(1 + s_t)^t = (1 + f_{0,1})(1 + f_{1,2})\\cdots(1 + f_{t-1,t})$.",
    truth: true,
    why: "Investing for $t$ years at the spot rate equals rolling over one-year forwards.",
    sources: [tia(12, "Spot and forward rates")],
    formula: "F.forward-chain",
    check: () => {
      const s = [0, 0.03, 0.035, 0.041];
      const f = [1, 2, 3].map((t) => Math.pow(1 + s[t], t) / Math.pow(1 + s[t - 1], t - 1) - 1);
      return near(Math.pow(1.041, 3), (1 + f[0]) * (1 + f[1]) * (1 + f[2]));
    },
  },
  {
    id: "upward-forward",
    topic: "ALM",
    area: "F",
    text: "When spot rates increase with maturity, each one-year forward rate $f_{t-1,t}$ exceeds the spot rate $s_t$.",
    truth: true,
    why: "$(1 + s_t)^t = (1 + s_{t-1})^{t-1}(1 + f_{t-1,t})$: if $s_{t-1} < s_t$, the last year must earn more than $s_t$ to bring the average up.",
    formula: "F.forward",
    check: () => {
      const s = [0, 0.03, 0.035, 0.041];
      return [2, 3].every((t) => Math.pow(1 + s[t], t) / Math.pow(1 + s[t - 1], t - 1) - 1 > s[t]);
    },
  },
  {
    id: "same-maturity-same-yield",
    topic: "ALM",
    area: "F",
    text: "When spot rates differ by term, all bonds with the same maturity have the same yield to maturity.",
    truth: false,
    why: "A bond's yield is a weighted blend of the spot rates of its cash flows; bonds with different coupons weight them differently.",
    formula: "F.spot-pricing",
    check: () => {
      const s = [0, 0.02, 0.04, 0.06];
      const ytm = (c: number) => {
        const fl = flows(c, 3);
        const p = fl.reduce((a, f) => a + f.amount * Math.pow(1 + s[f.t], -f.t), 0);
        let lo = 0;
        let hi = 0.2;
        for (let k = 0; k < 200; k += 1) {
          const mid = (lo + hi) / 2;
          if (price(fl, mid) > p) lo = mid;
          else hi = mid;
        }
        return lo;
      };
      return near(ytm(2), ytm(12));
    },
  },
  {
    id: "forward-definition",
    topic: "ALM",
    area: "F",
    text: "The forward rate $f_{t,t+m}$ is the annual rate, fixed today, for money invested from time $t$ to time $t + m$.",
    truth: true,
    why: "$(1 + s_t)^t(1 + f_{t,t+m})^m = (1 + s_{t+m})^{t+m}$.",
    sources: [tia(12, "Forward rate"), actex(5, "Forward Rates")],
    formula: "F.forward",
  },
  {
    id: "flat-curve",
    topic: "ALM",
    area: "F",
    text: "With a flat yield curve, all spot rates and all forward rates are equal.",
    truth: true,
    why: "If every $s_t$ is the same, each forward is that same rate too.",
    formula: "F.forward",
  },

  // ============================================================ Duration and convexity
  {
    id: "macd-weighted-average",
    topic: "ALM",
    area: "G",
    text: "Macaulay duration is the average of the cash-flow times, weighted by each cash flow's present value.",
    truth: true,
    why: "$D_{mac} = \\sum t\\,A_t / \\sum A_t$ with $A_t$ the present value of the cash flow at $t$.",
    sources: [tia(13, "Duration a.k.a. Macaulay duration")],
    formula: "G.macaulay",
  },
  {
    id: "single-cf-duration",
    topic: "ALM",
    area: "G",
    text: "The Macaulay duration of a single cash flow is the time until it is paid.",
    truth: true,
    why: "All the weight is on one time.",
    sources: [tia(13, "Duration a.k.a. Macaulay duration")],
    formula: "G.macaulay",
  },
  {
    id: "higher-coupon-longer",
    topic: "ALM",
    area: "G",
    text: "Other things equal, a bond with higher coupons has a *longer* Macaulay duration.",
    truth: false,
    why: "Higher coupons put more weight on early times, so the duration is *shorter*.",
    sources: [tia(13, "Duration a.k.a. Macaulay duration")],
    formula: "G.macaulay",
    check: () => macaulay(flows(10, 10), 0.06) > macaulay(flows(4, 10), 0.06),
  },
  {
    id: "higher-yield-shorter",
    topic: "ALM",
    area: "G",
    text: "For positive cash flows, a higher yield gives a shorter Macaulay duration.",
    truth: true,
    why: "A higher yield shrinks distant present values most, moving the weight toward early times.",
    sources: [tia(13, "Duration a.k.a. Macaulay duration")],
    formula: "G.macaulay",
    check: () => macaulay(flows(5, 10), 0.09) < macaulay(flows(5, 10), 0.04),
  },
  {
    id: "modd-v-macd",
    topic: "ALM",
    area: "G",
    text: "Modified duration equals $v$ times Macaulay duration, where $v$ is the discount factor for one period.",
    truth: true,
    why: "$D_{mod} = -P'(i)/P = \\sum t\\,CF_t v^{t+1}/P = v\\,D_{mac}$.",
    sources: [tia(13, "Relationship between modified and Macaulay duration"), actex(5, "Duration")],
    formula: "G.modified",
  },
  {
    id: "duration-smooth",
    topic: "ALM",
    area: "G",
    text: "As time passes, a bond's duration decreases smoothly, with no jumps.",
    truth: false,
    why: "Duration decreases between cash flows and *jumps up* just after each one is paid.",
    sources: [tia(13, "Passage of time")],
    formula: "G.macaulay",
  },
  {
    id: "modified-estimate-low",
    topic: "ALM",
    area: "G",
    text: "For a bond with positive convexity, the first-order modified-duration estimate of the new price is below the actual price.",
    truth: true,
    why: "The estimate follows the tangent line, and a convex price curve lies above its tangent, whichever way the yield moves.",
    sources: [tia(13, "Modified duration (ModD)")],
    formula: "G.approx-modified",
    check: () => {
      const fl = flows(5, 10);
      const p0 = price(fl, 0.06);
      const dmod = macaulay(fl, 0.06) / 1.06;
      return [0.04, 0.08].every((i1) => p0 * (1 - (i1 - 0.06) * dmod) < price(fl, i1));
    },
  },
  {
    id: "portfolio-duration",
    topic: "ALM",
    area: "G",
    text: "The duration of a portfolio is the price-weighted average of the durations of its components.",
    truth: true,
    why: "Sums of PV-weighted times combine linearly.",
    sources: [tia(13, "Duration of a portfolio"), actex(5, "Duration of a Portfolio")],
    formula: "G.portfolio-duration",
  },
  {
    id: "perpetuity-duration",
    topic: "ALM",
    area: "G",
    text: "The Macaulay duration of a level perpetuity-immediate is $\\frac{1+i}{i}$.",
    truth: true,
    why: "$(Ia)_{\\overline{\\infty|}}/a_{\\overline{\\infty|}} = \\frac{1/(id)}{1/i} = 1/d$.",
    sources: [actex(5, "Duration (perpetuity)")],
    formula: "G.duration-special",
    check: () => {
      let num = 0;
      let den = 0;
      for (let k = 1; k <= 20000; k += 1) {
        num += k * v(0.05, k);
        den += v(0.05, k);
      }
      return Math.abs(num / den - 1.05 / 0.05) < 1e-6;
    },
  },
  {
    id: "par-bond-duration",
    topic: "ALM",
    area: "G",
    text: "The Macaulay duration of a par bond with annual coupons is $\\ddot a_{\\overline{n|}}$ at its yield.",
    truth: true,
    why: "A par result that does not depend on the face value.",
    sources: [tia(13, "MacD of a par bond"), actex(5, "Bond Sold at Par")],
    formula: "G.duration-special",
    check: () => near(macaulay(flows(5, 8), 0.05), adue(8, 0.05)),
  },
  {
    id: "low-rates-more-sensitive",
    topic: "ALM",
    area: "G",
    text: "A yield move from 2% to 3% changes a bond's price by a larger percentage than a move from 10% to 11%.",
    truth: true,
    why: "The price curve is steeper (in percentage terms) at low yields; durations are longer there.",
    sources: [tia(13, "Price sensitivity")],
    formula: "G.price-function",
    check: () => {
      const fl = flows(5, 10);
      const pct = (a: number, b: number) => Math.abs(price(fl, b) / price(fl, a) - 1);
      return pct(0.02, 0.03) > pct(0.1, 0.11);
    },
  },
  {
    id: "modd-compounding",
    topic: "ALM",
    area: "G",
    text: "As the compounding frequency of the quoted yield increases, modified duration *decreases*.",
    truth: false,
    why: "$D_{mod} = D_{mac}/(1 + i^{(m)}/m)$, and the divisor shrinks toward 1 as $m$ grows, so $D_{mod}$ *increases* toward $D_{mac}$.",
    sources: [tia(13, "Modified duration (ModD)")],
    formula: "G.modified",
    check: () => {
      const D = 7;
      return D / (1 + iM(0.06, 12) / 12) < D / (1 + iM(0.06, 2) / 2);
    },
  },
  {
    id: "macaulay-approx-better",
    topic: "ALM",
    area: "G",
    text: "When all future cash flows are positive, the Macaulay first-order approximation of a new price is more accurate than the modified one.",
    truth: true,
    why: "It treats the bond as one payment at time $D_{mac}$, so it keeps some of the curvature.",
    sources: [tia(13, "Approximation using duration")],
    formula: "G.approx-macaulay",
    check: () => {
      const fl = flows(5, 10);
      const p0 = price(fl, 0.06);
      const dmac = macaulay(fl, 0.06);
      const exact = price(fl, 0.08);
      const mac = p0 * Math.pow(1.06 / 1.08, dmac);
      const mod = p0 * (1 - 0.02 * (dmac / 1.06));
      return Math.abs(mac - exact) < Math.abs(mod - exact);
    },
  },
  {
    id: "portfolio-convexity",
    topic: "ALM",
    area: "G",
    text: "The convexity of a portfolio is the price-weighted average of the convexities of its components.",
    truth: true,
    why: "Like duration, convexity is a PV-weighted sum divided by the price.",
    sources: [tia(14, "Convexity")],
    formula: "G.portfolio-duration",
  },
  {
    id: "modd-par-free",
    topic: "ALM",
    area: "G",
    text: "The modified duration of a bond does not depend on its par value.",
    truth: true,
    why: "Scaling every cash flow scales $P$ and $P'$ alike; their ratio is unchanged.",
    sources: [tia(13, "Modified duration (ModD)")],
    formula: "G.modified",
  },

  // ============================================================ Immunization
  {
    id: "redington-conditions",
    topic: "ALM",
    area: "G",
    text: "Redington immunization requires $PV_A = PV_L$, equal durations, and the assets' convexity above the liabilities'.",
    truth: true,
    why: "Equivalently $S(i) = 0$, $S'(i) = 0$ and $S''(i) > 0$: the surplus has a local minimum of zero at the current rate.",
    sources: [tia(15, "Redington immunization"), actex(5, "Immunization")],
    formula: "G.redington",
  },
  {
    id: "redington-any-size",
    topic: "ALM",
    area: "G",
    text: "Redington immunization protects the surplus against interest-rate changes of any size.",
    truth: false,
    why: "Only *small* changes. Full immunization protects against changes of any size (still assuming a flat curve and parallel shifts).",
    sources: [tia(15, "Redington immunization / Full immunization")],
    formula: "G.redington",
  },
  {
    id: "full-before-after",
    topic: "ALM",
    area: "G",
    text: "Full immunization of a single liability needs matching PV and duration, with an asset cash flow before and another after the liability.",
    truth: true,
    why: "The third condition replaces Redington's convexity condition.",
    sources: [tia(15, "Full immunization"), actex(5, "Full Immunization")],
    formula: "G.full-immunization",
  },
  {
    id: "full-implies-redington",
    topic: "ALM",
    area: "G",
    text: "If full immunization is achieved, Redington immunization is also achieved.",
    truth: true,
    why: "Protection against any change includes protection against small ones.",
    sources: [tia(15, "Full immunization")],
    formula: "G.full-immunization",
  },
  {
    id: "immunization-assumptions",
    topic: "ALM",
    area: "G",
    text: "Redington and full immunization both assume a flat yield curve and parallel shifts.",
    truth: true,
    why: "These assumptions are usually not true in practice — one of the stated weaknesses.",
    sources: [tia(15, "Redington immunization / Immunization weaknesses")],
    formula: "G.redington",
  },
  {
    id: "dedication-insensitive",
    topic: "ALM",
    area: "G",
    text: "Dedication (exact cash-flow matching) leaves the surplus unchanged by any change in interest rates.",
    truth: true,
    why: "Each liability is paid by an asset cash flow of the same amount at the same time, whatever the rates.",
    sources: [tia(15, "Dedication"), actex(5, "Exact Matching or Dedication")],
    formula: "G.dedication",
  },
  {
    id: "dedication-weakness",
    topic: "ALM",
    area: "G",
    text: "One weakness of dedication is that assets exactly matching the liabilities may not be available.",
    truth: true,
    why: "Others: uncertain liability timing or size, unpredictable asset cash flows, and missed higher-yield opportunities.",
    sources: [tia(15, "Dedication")],
    formula: "G.dedication",
  },
  {
    id: "no-rebalancing",
    topic: "ALM",
    area: "G",
    text: "Once immunized, a portfolio stays immunized as time passes and rates change, with no rebalancing.",
    truth: false,
    why: "Asset and liability durations drift apart, so the portfolio must be rebalanced — at a cost. More frequent rebalancing trades cost against protection.",
    sources: [tia(15, "Immunization weaknesses")],
    formula: "G.redington",
  },
  {
    id: "surplus-minimum",
    topic: "ALM",
    area: "G",
    text: "Under Redington immunization the surplus, as a function of the interest rate, has a local minimum at the current rate.",
    truth: true,
    why: "$S'(i) = 0$ and $S''(i) > 0$, with $S(i) = 0$: small moves either way leave a non-negative surplus.",
    sources: [tia(15, "Redington immunization")],
    formula: "G.redington",
  },
  {
    id: "convexity-less",
    topic: "ALM",
    area: "G",
    text: "For Redington immunization the assets' convexity must be *less* than the liabilities'.",
    truth: false,
    why: "It must be *greater*, so the asset value rises faster (or falls slower) than the liabilities' when rates move.",
    sources: [tia(15, "Redington immunization")],
    formula: "G.redington",
  },
];

export const QUICK_CHECK_BY_ID: Record<string, QuickCheck> = Object.fromEntries(QUICK_CHECKS.map((q) => [q.id, q]));
