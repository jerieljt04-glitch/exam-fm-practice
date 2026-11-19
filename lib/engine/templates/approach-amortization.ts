/**
 * Bond amortization families, each with several twists per level.
 *
 *   bamort-income     interest income: over the life, in one coupon, over a window,
 *                     or used backwards to recover a book value
 *   bamort-writedown  book values and prices worked back from a write-down (or
 *                     write-up) in one coupon; the yield from two write-downs
 */
import type { AnswerFormat, ChainStep, DistractorCandidate, QuestionDraft, QuestionTemplate } from "../types";
import { compose, round2 } from "./approach-kit";
import { MONEY2, amt, distractor, drawUntil, gridRate, lit, ord, pc, shown, step } from "./kit";

const L = lit;
const pct = (x: number) => pc(x, 3);
const d = (id: Parameters<typeof distractor>[0], value: number, calc: string, fmt: AnswerFormat, method: string, feedback: string): DistractorCandidate =>
  distractor(id, value, calc, { derivation: `$= ${shown(value, fmt)}$`, method, feedback });

const aE = (n: number | string, j: string) => `((1-(1+${j})**(-(${n})))/${j})`;
const sE = (n: number | string, j: string) => `(((1+${j})**(${n})-1)/${j})`;
const an = (n: number, j: number) => (1 - Math.pow(1 + j, -n)) / j;
const sn = (n: number, j: number) => (Math.pow(1 + j, n) - 1) / j;

// ===================================================================== Interest income

const income: QuestionTemplate = {
  id: "bamort-income",
  family: "bamort-income",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.amortization",
  secondary: ["BONDS.book_market", "BONDS.coupons"],
  reasoning: ["concept_recognition", "cashflow_modelling", "valuation_dates", "multistep"],
  soaConcept: "Interest income on a bond is yield × book value, not the coupon: over the life it is coupons plus discount (minus premium); over a window it is coupons less the change in book value.",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const F = 1000;
    const twist = rng.choice(["A", "B"]);
    const semi = level === 3;
    const C = semi ? F * rng.choice([1.05, 1.1]) : F;
    const rc = gridRate(rng, 0.03, 0.1, 0.005);
    const y = drawUntil(() => gridRate(rng, 0.03, 0.1, 0.0025), (x) => Math.abs(x - rc) >= 0.01);
    const n = rng.int(6, 20);
    const N = semi ? 2 * n : n;
    const j = semi ? Math.pow(1 + y, 0.5) - 1 : y;
    const jE = semi ? `((1+${L(y)})**0.5-1)` : L(y);
    const cpn = semi ? (F * rc) / 2 : F * rc;
    const BV = (t: number) => cpn * an(N - t, j) + C * Math.pow(1 + j, -(N - t));
    const BVE = (t: number) => `(${L(cpn)}*${aE(N - t, jE)} + ${L(C)}*(1+${jE})**(-${N - t}))`;
    const P = BV(0);
    const coup = semi ? `semiannual coupons at ${pct(rc)} per year convertible semiannually` : `annual coupons at ${pct(rc)}`;
    const head = `A ${n}-year bond with face ${F} and ${coup} is redeemable at ${C === F ? "par" : amt(C)}. It is bought to yield ${semi ? `an annual effective rate of ${pct(y)}` : `${pct(y)} annual effective`}, and book values follow the amortization (scientific) method.`;
    let value: number;
    let calc: string;
    let model: { expr: string; bracket?: [number, number]; description: string };
    let ask: string;
    const ds: DistractorCandidate[] = [];
    const steps: ChainStep[] = [];
    const k = rng.int(2, Math.max(2, N - 4));
    const m = Math.min(N, k + rng.int(2, 5));
    const window = (a: number, b: number) => (b - a + 1) * cpn - (BV(a - 1) - BV(b));
    const windowE = (a: number, b: number) => `${b - a + 1}*${L(cpn)} - (${BVE(a - 1)} - ${BVE(b)})`;
    const sumModel = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, q) => `${jE}*${BVE(a - 1 + q)}`).join(" + ");

    if (level === 1 && twist === "A") {
      value = n * cpn + C - P;
      calc = `${n}*${L(cpn)} + ${L(C)} - ${BVE(0)}`;
      model = { expr: sumModel(1, N), description: "Interest income coupon by coupon: yield × book value at the start of each period." };
      ask = "Calculate the total interest income the investor earns over the life of the bond.";
      ds.push(
        d("CONC_BOND_COUPON_AS_INTEREST", n * cpn, `${n}*${L(cpn)}`, fmt, "Counted the coupons only.", P < C ? "The discount accrues to the investor as interest." : "Part of each coupon repays the premium; it is not income."),
        d("VAR_TOTAL_FOR_COMPONENT", n * cpn + C, `${n}*${L(cpn)} + ${L(C)}`, fmt, "Added coupons and redemption.", "Subtract the price: only the excess over what was paid is income."),
        d("ALG_SIGN_ERROR", n * cpn - (C - P), `${n}*${L(cpn)} - (${L(C)} - ${BVE(0)})`, fmt, "Subtracted the discount (or added the premium).", "Income = coupons + redemption − price."),
        d("MODEL_INTEREST_ON_ORIGINAL", n * y * P, `${n}*${L(y)}*${BVE(0)}`, fmt, "Charged the yield on the purchase price every year.", "Book value changes each year, so each year's income changes too.")
      );
      steps.push(step("E.price", "Purchase price.", ["P", P, "price"], ["F", "r", "C", "i"]), step("E.book-value", "Total income = coupons + redemption − price.", ["I", value, "total interest income"], ["P"]));
    } else if (level === 1) {
      value = j * BV(k - 1);
      calc = `${jE}*${BVE(k - 1)}`;
      model = { expr: `${L(cpn)} - (${BVE(k - 1)} - ${BVE(k)})`, description: "Coupon less the change in book value over the period." };
      ask = `Calculate the interest income (the interest portion) of the ${ord(k)} coupon.`;
      ds.push(
        d("TIMING_BALANCE_INDEX", j * BV(k), `${jE}*${BVE(k)}`, fmt, "Applied the yield to the book value after the coupon.", `Interest for period ${k} is earned on the book value at its start, $BV_{${k - 1}}$.`),
        d("CONC_BOND_COUPON_AS_INTEREST", cpn, L(cpn), fmt, "Took the coupon as the interest.", "The coupon also adjusts the book value."),
        d("MODEL_INTEREST_ON_ORIGINAL", j * P, `${jE}*${BVE(0)}`, fmt, "Applied the yield to the purchase price.", "Use the current book value."),
        d("VAR_FACE_FOR_PRICE", j * F, `${jE}*${F}`, fmt, "Applied the yield to the face amount.", "Use the book value."),
        d("VAR_INTEREST_FOR_PRINCIPAL", Math.abs(cpn - j * BV(k - 1)), P > C ? `${L(cpn)} - ${jE}*${BVE(k - 1)}` : `${jE}*${BVE(k - 1)} - ${L(cpn)}`, fmt, "Gave the change in book value.", "That is the amortization; the interest portion is yield × book value.")
      );
      steps.push(step("E.book-value", `Book value after coupon ${k - 1}.`, ["BV", BV(k - 1), `book value after coupon ${k - 1}`], ["F", "r", "i"]), step("E.bond-amortization", "Interest portion = yield × book value.", ["I", value, `interest in coupon ${k}`], ["BV", "i"]));
    } else if (level === 2 && twist === "B") {
      const Ik = round2(k * cpn + BV(k) - P);
      const Pr = round2(P);
      value = Pr + Ik - k * cpn;
      calc = `${L(Pr)} + ${L(Ik)} - ${k}*${L(cpn)}`;
      model = { expr: `x - (${L(Pr)} + ${L(Ik)} - ${k}*${L(cpn)})`, description: "Book value rises by interest income and falls by coupons received." };
      ask = `The bond was bought for ${amt(Pr)}, and the investor's interest income over the first ${k} coupons totals ${amt(Ik)}. Calculate the book value immediately after the ${ord(k)} coupon.`;
      ds.push(
        d("ALG_SIGN_ERROR", Pr - Ik + k * cpn, `${L(Pr)} - ${L(Ik)} + ${k}*${L(cpn)}`, fmt, "Subtracted income and added coupons.", "Income increases book value; coupons received decrease it."),
        d("VAR_FACE_FOR_PRICE", F + Ik - k * cpn, `${F} + ${L(Ik)} - ${k}*${L(cpn)}`, fmt, "Started from the face amount.", "Start from the price paid."),
        d("TIMING_BALANCE_INDEX", Pr + Ik - (k - 1) * cpn, `${L(Pr)} + ${L(Ik)} - ${k - 1}*${L(cpn)}`, fmt, `Subtracted ${k - 1} coupons.`, `${k} coupons have been paid.`),
        d("VAR_TOTAL_FOR_COMPONENT", Pr + Ik, `${L(Pr)} + ${L(Ik)}`, fmt, "Added the income without removing the coupons.", "Coupons paid out reduce the book value."),
        d("MODEL_STRAIGHT_LINE", Pr + (k * (C - Pr)) / N, `${L(Pr)} + ${k}*(${L(C)} - ${L(Pr)})/${N}`, fmt, "Moved the book value in a straight line toward redemption.", "Under the amortization method the adjustments are not equal.")
      );
      steps.push(step("E.book-value", "Book value = price + income − coupons received.", ["BV", value, `book value after coupon ${k}`], ["P", "I", "coupons"], { derived: true }));
      steps.unshift(step("E.price", "Purchase price as the starting book value.", ["P", Pr, "price"], ["P"]));
    } else {
      value = window(k, m);
      calc = windowE(k, m);
      model = { expr: sumModel(k, m), description: "Yield × book value for each coupon period in the window, added." };
      ask = `Calculate the total interest income in coupons ${k} through ${m} inclusive.`;
      const cnt = m - k + 1;
      ds.push(
        d("CONC_BOND_COUPON_AS_INTEREST", cnt * cpn, `${cnt}*${L(cpn)}`, fmt, "Counted only the coupons.", "Income = coupons − (fall in book value)."),
        d("ALG_SIGN_ERROR", cnt * cpn + (BV(k - 1) - BV(m)), `${cnt}*${L(cpn)} + (${BVE(k - 1)} - ${BVE(m)})`, fmt, "Added the change in book value with the wrong sign.", P > C ? "Write-downs reduce income." : "Write-ups add to income."),
        d("TIMING_BALANCE_INDEX", window(k + 1, Math.min(N, m + 1)), windowE(k + 1, Math.min(N, m + 1)), fmt, "Shifted the window one coupon later.", `Coupon ${k}'s interest is earned on $BV_{${k - 1}}$.`),
        d("MODEL_INTEREST_ON_ORIGINAL", cnt * j * P, `${cnt}*${jE}*${BVE(0)}`, fmt, "Applied the yield to the price every period.", "Use the book value at the start of each period."),
        d("MODEL_STRAIGHT_LINE", cnt * (cpn + (C - P) / N), `${cnt}*(${L(cpn)} + (${L(C)} - ${BVE(0)})/${N})`, fmt, "Spread the premium or discount evenly over the coupons.", "The scientific method amortizes geometrically, not evenly.")
      );
      if (semi) {
        const jw = y / 2;
        const BVw = (t: number) => cpn * an(N - t, jw) + C * Math.pow(1 + jw, -(N - t));
        ds.unshift(
          d("RATE_NOMINAL_AS_EFFECTIVE", (m - k + 1) * cpn - (BVw(k - 1) - BVw(m)), `${m - k + 1}*${L(cpn)} - ((${L(cpn)}*${aE(N - k + 1, `(${L(y)}/2)`)} + ${L(C)}*(1+${L(y)}/2)**(-${N - k + 1})) - (${L(cpn)}*${aE(N - m, `(${L(y)}/2)`)} + ${L(C)}*(1+${L(y)}/2)**(-${N - m})))`, fmt, "Halved the annual effective yield for the half-year rate.", `Half-year rate: $(1+${pct(y).replace("%", "\\%")})^{1/2} - 1$.`),
          d("CONC_BOND_REDEMPTION_AS_FACE", (() => { const B = (t: number) => cpn * an(N - t, j) + F * Math.pow(1 + j, -(N - t)); return (m - k + 1) * cpn - (B(k - 1) - B(m)); })(), `${m - k + 1}*${L(cpn)} - ((${L(cpn)}*${aE(N - k + 1, jE)} + ${F}*(1+${jE})**(-${N - k + 1})) - (${L(cpn)}*${aE(N - m, jE)} + ${F}*(1+${jE})**(-${N - m})))`, fmt, "Used the face amount as the redemption value.", `The bond is redeemed at ${amt(C)}.`)
        );
        steps.push(step("A.nominal-equivalence", "Half-year yield from the annual effective yield.", ["j", j, "half-year yield"], ["i"]));
      }
      steps.push(
        step("E.book-value", `Book value at the start of the window (after coupon ${k - 1}).`, ["BV_a", BV(k - 1), `book value after coupon ${k - 1}`], ["F", "r", "C", "j"]),
        step("E.book-value", `Book value at the end of the window (after coupon ${m}).`, ["BV_b", BV(m), `book value after coupon ${m}`], ["F", "r", "C", "j"]),
        step("E.bond-amortization", "Income = coupons in the window − fall in book value.", ["I", value, "interest income in the window"], ["BV_a", "BV_b"])
      );
      if (semi) steps.splice(3, 0, step("B.annuity-immediate", `Coupons in the window: ${m - k + 1} × ${amt(cpn)}.`, ["Σc", (m - k + 1) * cpn, "coupons in the window"], ["c"]));
    }
    return compose({
      stem: `${head}\n\n${ask}`,
      fmt,
      value,
      calc,
      model,
      distractors: ds,
      steps,
      methods: ["decomposition", "valuation_dates"],
      reasoning: "Book value moves from price to redemption; each coupon splits into income (yield × book value) and a book-value adjustment.",
      intuition: "A bond bought at a discount pays the investor more than its coupons: the discount is earned gradually as the book value climbs to redemption. A premium works the other way. So income over any stretch is the coupons received plus the rise in book value (or minus its fall).",
      unknowns: [{ symbol: "$I$", meaning: "interest income" }],
      relationships: ["$I_t = i\\,BV_{t-1}$", "$BV_t = BV_{t-1} + I_t - Fr$", "$\\sum_{t=a}^{b} I_t = (b-a+1)Fr + BV_b - BV_{a-1}$"],
      conditions: ["Amortization (scientific) method.", semi ? "Half-year periods." : "Annual periods."],
      valuationDate: "Coupon dates",
      modelChoice: "Book-value accounting for the bond.",
      assumptions: ["Book value at the purchase yield."],
      alternative: { name: "Add period by period", body: "Compute yield × book value for each coupon in the range and add.", whenUseful: "When the window is short." },
      principle: "Income = cash received + change in book value.",
      unusual: level === 2 && twist === "B" ? "Income is given; the book value is asked for." : "Income is not the coupon.",
      misread: "Interest income uses the book value at the start of the period.",
      presentation: level === 1 ? ["direct"] : ["valuation-date", "hidden-structure", ...(semi ? (["frequency"] as const) : [])],
      features: { multipleValuationDates: level > 1, multiConcept: level > 1, unfamiliar: level > 1 },
      params: { rc, y, n, C, k, m, twist, level },
      route: "income = coupons + change in book value",
    });
  },
};

// ===================================================================== Book value from a write-down

const writedown: QuestionTemplate = {
  id: "bamort-writedown",
  family: "bamort-writedown",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.book_market",
  secondary: ["BONDS.amortization", "BONDS.yield"],
  reasoning: ["algebra", "concept_recognition", "valuation_dates", "multistep"],
  soaConcept: "A single write-down (or write-up) reveals the book value before it, because it equals coupon − yield × book value; from there the price, later book values, or (with two write-downs) the yield follow.",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const F = 1000;
    const premium = rng.next() < 0.5;
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const rc = premium ? i + rng.choice([0.02, 0.025, 0.03, 0.035]) : Math.max(0.005, i - rng.choice([0.02, 0.025, 0.03]));
    const Fr = F * rc;
    const n = rng.int(10, 25);
    const k = rng.int(3, n - 4);
    const twist = rng.choice(["A", "B"]);
    const adj = (t: number, rate = i) => Math.abs(Fr - F * rate) * Math.pow(1 + rate, -(n - t + 1));
    const Ak = round2(adj(k));
    const sign = premium ? -1 : 1; // book value change per coupon: premium falls, discount rises
    const word = premium ? "write-down in book value (amortization of premium)" : "write-up in book value (accumulation of discount)";
    const head = `A bond with face ${F}, redeemable at par, pays annual coupons of ${amt(Fr)} and was bought to yield ${pct(i)} annual effective. Book values follow the amortization (scientific) method. The ${word} in the ${ord(k)} coupon is ${amt(Ak)}.`;
    const before = (A: number, rate = i) => (Fr + sign * A) / rate;
    const beforeE = (A: string, rate = L(i)) => `((${L(Fr)} ${premium ? "-" : "+"} ${A})/${rate})`;
    const B0 = before(Ak);
    const B0E = beforeE(L(Ak));
    let value: number;
    let calc: string;
    let model: { expr: string; bracket?: [number, number]; description: string };
    let ask: string;
    let stem = head;
    const ds: DistractorCandidate[] = [];
    const steps: ChainStep[] = [];
    const wrong = before(-Ak);
    const wrongE = `((${L(Fr)} ${premium ? "+" : "-"} ${L(Ak)})/${L(i)})`;
    if (level === 1) {
      const after = twist === "B";
      value = after ? B0 + sign * Ak : B0;
      calc = after ? `${B0E} ${premium ? "-" : "+"} ${L(Ak)}` : B0E;
      model = after
        ? { expr: `(x ${premium ? "+" : "-"} ${L(Ak)})*(1+${L(i)}) - ${L(Fr)} - x`, description: "The earlier book value grown one period, less the coupon, gives the later one." }
        : { expr: `${L(Fr)} - x*${L(i)} ${premium ? "-" : "+"} ${L(Ak)}`, description: "The adjustment equals the gap between coupon and yield × book value." };
      ask = after ? `Calculate the book value immediately after the ${ord(k)} coupon.` : `Calculate the book value immediately after the ${ord(k - 1)} coupon.`;
      ds.push(
        d("ALG_SIGN_ERROR", after ? wrong + sign * Ak : wrong, after ? `${wrongE} ${premium ? "-" : "+"} ${L(Ak)}` : wrongE, fmt, premium ? "Added the write-down to the coupon." : "Subtracted the write-up from the coupon.", premium ? "For a premium bond, write-down = coupon − interest, so interest = coupon − write-down." : "For a discount bond, write-up = interest − coupon, so interest = coupon + write-up."),
        d("TIMING_BALANCE_INDEX", after ? B0 : B0 + sign * Ak, after ? B0E : `${B0E} ${premium ? "-" : "+"} ${L(Ak)}`, fmt, after ? `Gave the book value before the ${ord(k)} coupon.` : `Gave the book value after the ${ord(k)} coupon.`, after ? "Apply the adjustment of that coupon." : `The adjustment in coupon ${k} is computed from the book value before it.`),
        d("CONC_BOND_COUPON_AS_INTEREST", Fr / i, `${L(Fr)}/${L(i)}`, fmt, "Divided the coupon by the yield.", "Only the interest part of the coupon equals yield × book value."),
        d("VAR_OTHER_UNKNOWN", Ak / i, `${L(Ak)}/${L(i)}`, fmt, "Divided the adjustment by the yield.", "The adjustment is the difference between coupon and interest."),
        d("VAR_FACE_FOR_PRICE", F, `${F}`, fmt, "Took the book value as par.", premium ? "A premium bond's book value stays above par until redemption." : "A discount bond's book value stays below par until redemption.")
      );
      steps.push(step("E.bond-amortization", `Adjustment = |coupon − yield × book value| gives $BV_{${k - 1}}$.`, ["BV", B0, `book value after coupon ${k - 1}`], ["A_k", "Fr", "i"], { rearranged: true }));
      if (after) steps.push(step("E.book-value", `Apply coupon ${k}'s adjustment.`, ["BV'", value, `book value after coupon ${k}`], ["BV", "A_k"]));
    } else if (level === 2 && twist === "A") {
      value = Fr * an(k - 1, i) + B0 * Math.pow(1 + i, -(k - 1));
      calc = `${L(Fr)}*${aE(k - 1, L(i))} + ${B0E}*(1+${L(i)})**(-${k - 1})`;
      model = { expr: `x*(1+${L(i)})**${k - 1} - ${L(Fr)}*${sE(k - 1, L(i))} - ${B0E}`, description: "Retrospective book value: price grown k − 1 periods less the coupons, equal to the book value after coupon k − 1." };
      ask = "Calculate the purchase price.";
      ds.push(
        d("CONC_BOND_COUPON_AS_INTEREST", Fr * an(k - 1, i) + (Fr / i) * Math.pow(1 + i, -(k - 1)), `${L(Fr)}*${aE(k - 1, L(i))} + ${L(Fr)}/${L(i)}*(1+${L(i)})**(-${k - 1})`, fmt, "Took the book value as coupon ÷ yield.", "Only the interest part of the coupon is yield × book value."),
        d("VAR_FACE_FOR_PRICE", F, `${F}`, fmt, "Assumed the bond was bought at par.", premium ? "A write-down means the bond was bought at a premium." : "A write-up means the bond was bought at a discount."),
        d("VAR_OTHER_UNKNOWN", B0, B0E, fmt, `Gave the book value after coupon ${k - 1}.`, "Work back to time 0."),
        d("MODEL_STRAIGHT_LINE", B0 - sign * (k - 1) * Ak, `${B0E} ${premium ? "+" : "-"} ${k - 1}*${L(Ak)}`, fmt, `Assumed every earlier adjustment equalled ${amt(Ak)}.`, "Adjustments grow by $1+i$ each period, so earlier ones were smaller."),
        d("ALG_SIGN_ERROR", Fr * an(k - 1, i) + wrong * Math.pow(1 + i, -(k - 1)), `${L(Fr)}*${aE(k - 1, L(i))} + ${wrongE}*(1+${L(i)})**(-${k - 1})`, fmt, "Used the wrong sign when recovering the book value.", premium ? "Interest = coupon − write-down." : "Interest = coupon + write-up.")
      );
      steps.push(
        step("E.bond-amortization", `Book value after coupon ${k - 1} from the adjustment.`, ["BV", B0, `book value after coupon ${k - 1}`], ["A_k", "Fr", "i"], { rearranged: true }),
        step("E.price", `Price = PV of the first ${k - 1} coupons + PV of that book value.`, ["P", value, "purchase price"], ["Fr", "BV", "i"], { rearranged: true })
      );
    } else if (level === 2) {
      const g = rng.int(2, 6);
      const mm = Math.min(n, k - 1 + g);
      const span = mm - (k - 1);
      value = B0 * Math.pow(1 + i, span) - Fr * sn(span, i);
      calc = `${B0E}*(1+${L(i)})**${span} - ${L(Fr)}*${sE(span, L(i))}`;
      let rec = B0E;
      for (let q = 0; q < span; q += 1) rec = `(${rec}*(1+${L(i)}) - ${L(Fr)})`;
      model = { expr: rec, description: "Book value rolled forward one coupon at a time." };
      ask = `Calculate the book value immediately after the ${ord(mm)} coupon.`;
      ds.push(
        d("TIMING_BALANCE_INDEX", B0 * Math.pow(1 + i, span - 1) - Fr * sn(span - 1, i), `${B0E}*(1+${L(i)})**${span - 1} - ${L(Fr)}*${sE(span - 1, L(i))}`, fmt, "Rolled forward one coupon too few.", `From coupon ${k - 1} to coupon ${mm} is ${span} coupons.`),
        d("MODEL_STRAIGHT_LINE", B0 + sign * span * Ak, `${B0E} ${premium ? "-" : "+"} ${span}*${L(Ak)}`, fmt, `Applied the same adjustment of ${amt(Ak)} in every coupon.`, "Adjustments grow by $1+i$ each coupon."),
        d("ALG_SIGN_ERROR", B0 * Math.pow(1 + i, span) + Fr * sn(span, i), `${B0E}*(1+${L(i)})**${span} + ${L(Fr)}*${sE(span, L(i))}`, fmt, "Added the accumulated coupons.", "Coupons paid out reduce the book value."),
        d("VAR_OTHER_UNKNOWN", B0, B0E, fmt, `Gave the book value after coupon ${k - 1}.`, `Roll it forward to coupon ${mm}.`),
        d("CONC_BOND_COUPON_AS_INTEREST", B0 * Math.pow(1 + i, span) - span * Fr, `${B0E}*(1+${L(i)})**${span} - ${span}*${L(Fr)}`, fmt, "Subtracted the coupons without interest on them.", "Each coupon removed earlier would have earned the yield: subtract $Fr\\,s_{\\overline{n|}}$.")
      );
      steps.push(
        step("E.bond-amortization", `Book value after coupon ${k - 1} from the adjustment.`, ["BV", B0, `book value after coupon ${k - 1}`], ["A_k", "Fr", "i"], { rearranged: true }),
        step("E.book-value", `Roll forward ${span} coupons retrospectively.`, ["BV'", value, `book value after coupon ${mm}`], ["BV", "Fr", "i"])
      );
    } else {
      const g = rng.int(2, 5);
      const m2 = Math.min(n, k + g);
      const gg = m2 - k;
      const Am = round2(adj(m2));
      const ratioE = `(${L(Am)}/${L(Ak)})`;
      const ir = Math.pow(Am / Ak, 1 / gg) - 1;
      const irE = `(${ratioE}**(1/${gg})-1)`;
      const Bk = before(Ak, ir);
      const BkE = beforeE(L(Ak), irE);
      const P0 = Fr * an(k - 1, ir) + Bk * Math.pow(1 + ir, -(k - 1));
      const P0E = `(${L(Fr)}*${aE(k - 1, irE)} + ${BkE}*(1+${irE})**(-${k - 1}))`;
      value = (k - 1) * Fr - (P0 - Bk);
      calc = `${k - 1}*${L(Fr)} - (${P0E} - ${BkE})`;
      let bv = P0E;
      const terms: string[] = [];
      for (let q = 0; q < k - 1; q += 1) {
        terms.push(`${irE}*${bv}`);
        bv = `(${bv}*(1+${irE}) - ${L(Fr)})`;
      }
      model = { expr: terms.join(" + "), description: "Yield × book value for each of the first k − 1 coupons, starting from the price." };
      stem = `A bond with face ${F}, redeemable at par, pays annual coupons of ${amt(Fr)}. It was bought at a ${premium ? "premium" : "discount"}, and book values follow the amortization (scientific) method at the purchase yield. The ${word} is ${amt(Ak)} in the ${ord(k)} coupon and ${amt(Am)} in the ${ord(m2)} coupon.`;
      ask = `Calculate the investor's total interest income over the first ${k - 1} coupons.`;
      const alt = (rate: number) => {
        const b = before(Ak, rate);
        const p = Fr * an(k - 1, rate) + b * Math.pow(1 + rate, -(k - 1));
        return (k - 1) * Fr - (p - b);
      };
      const altE = (rate: string) => `${k - 1}*${L(Fr)} - ((${L(Fr)}*${aE(k - 1, rate)} + ${beforeE(L(Ak), rate)}*(1+${rate})**(-${k - 1})) - ${beforeE(L(Ak), rate)})`;
      const iW = Am / Ak - 1;
      const iA = (Am / Ak - 1) / gg;
      ds.push(
        d("ALG_ROOT_ERROR", alt(iW), altE(`(${ratioE}-1)`), fmt, `Took the ratio of the adjustments minus one as the yield.`, `Adjustments grow by $(1+i)$ per coupon: the ratio spans ${gg} coupons.`),
        d("SEQ_GEOMETRIC_AS_ARITHMETIC", alt(iA), altE(`((${ratioE}-1)/${gg})`), fmt, "Divided the growth of the adjustments evenly over the coupons.", "The growth is geometric: take a root."),
        d("CONC_BOND_COUPON_AS_INTEREST", (k - 1) * Fr, `${k - 1}*${L(Fr)}`, fmt, "Counted the coupons as income.", premium ? "Write-downs reduce income below the coupons." : "Write-ups add to income."),
        d("ALG_SIGN_ERROR", (k - 1) * Fr + (P0 - Bk), `${k - 1}*${L(Fr)} + (${P0E} - ${BkE})`, fmt, "Added the change in book value with the wrong sign.", "Income = coupons + (rise in book value)."),
        d("VAR_OTHER_UNKNOWN", P0, P0E, fmt, "Gave the purchase price.", "The question asks for interest income.")
      );
      steps.push(
        step("A.compound", `Adjustments grow by $1+i$ per coupon: $(1+i)^{${gg}} = A_{${m2}}/A_{${k}}$.`, ["i", ir, "yield"], ["A_k", "A_m"], { rearranged: true }),
        step("E.bond-amortization", `Book value after coupon ${k - 1} from the adjustment.`, ["BV", Bk, `book value after coupon ${k - 1}`], ["A_k", "Fr", "i"], { rearranged: true }),
        step("E.price", `Price: PV of the first ${k - 1} coupons and that book value.`, ["P", P0, "price"], ["Fr", "BV", "i"], { rearranged: true }),
        step("E.book-value", "Income = coupons − fall in book value.", ["I", value, "total interest income"], ["P", "BV"])
      );
    }
    return compose({
      stem: `${stem}\n\n${ask}`,
      fmt,
      value,
      calc,
      model,
      distractors: ds,
      steps,
      methods: level === 3 ? ["elimination", "work_backwards"] : ["work_backwards", "rearrangement"],
      reasoning: "One write-down is one equation: coupon − yield × book value. It pins down the book value just before it, and the amortization schedule does the rest.",
      unconventional: level > 1,
      intuition: "Each coupon splits into interest (yield × book value) and a book-value adjustment. So an adjustment is not just a number — it tells you the book value it came from. From that one book value you can walk back to the price or forward to any later date.",
      unknowns: [{ symbol: "$BV$", meaning: "book value" }],
      relationships: [premium ? "$\\text{write-down}_t = Fr - i\\,BV_{t-1}$" : "$\\text{write-up}_t = i\\,BV_{t-1} - Fr$", "$\\text{adjustment}_t = |Fr - Ci|\\,v^{n-t+1}$", "$BV_t = BV_{t-1}(1+i) - Fr$"],
      conditions: ["Amortization (scientific) method at the purchase yield."],
      valuationDate: "Coupon dates",
      modelChoice: "Bond amortization schedule.",
      assumptions: ["Redemption at par."],
      alternative: { name: "Through the term", body: "Recover the term n from the adjustment and price the bond directly — longer and needs a logarithm.", whenUseful: "When the term is asked for." },
      principle: "Each line of an amortization schedule determines the rest.",
      unusual: level === 3 ? "Neither the yield nor the price is given." : "The term of the bond is never needed.",
      misread: "An adjustment equals coupon minus interest (premium) or interest minus coupon (discount); mixing the sign is the commonest error.",
      presentation: level === 1 ? ["work-backwards"] : ["work-backwards", "hidden-structure", "valuation-date"],
      features: { unfamiliar: level > 1, multipleValuationDates: level > 1, multiConcept: level === 3 },
      params: { i, rc, n, k, premium, twist, level },
      route: "adjustment → book value → schedule",
    });
  },
};

export const AMORTIZATION_TEMPLATES: QuestionTemplate[] = [income, writedown];
