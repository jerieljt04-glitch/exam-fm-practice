/**
 * Concept Practice — bonds.
 *
 * Original items built on the structure of the SOA's Exam FM bond questions
 * (price and redemption, book and market value, coupons and coupon rates,
 * yield, amortization, reinvestment, callable bonds and bond terms). Each
 * quantitative claim in an option or statement carries a check the validator
 * re-derives from explicit cash flows; equation and expression options carry
 * numeric probes.
 */
import type { StatementKey } from "../answers";
import { an, bondPrice, sn } from "../finance";
import type { MisconceptionId } from "../misconceptions";
import { aExpr, drawUntil, gridRate, lit, mamt, mnum, mpc, ord, pc, sExpr, vPow } from "../templates/kit";
import type { ChoiceDraft, ChoiceTemplate, ConceptFailure, Difficulty, Presentation, StatementSpec } from "../types";
import { conceptQuestion as rawConceptQuestion, conceptTemplate, math, statementQuestion as rawStatementQuestion, type ConceptOption } from "./kit";

// ---------------------------------------------------------------- prose tidy

/** Math-only digit grouping (`4{,}000`) written as prose (`4,000`) outside `$…$`. */
function prose(markup: string): string {
  return markup
    .split(/(\$\$[^$]*\$\$|\$[^$]*\$)/)
    .map((part, k) => (k % 2 === 0 ? part.replace(/(\d)\{,\}(?=\d)/g, "$1,") : part))
    .join("");
}

function tidy(draft: ChoiceDraft): ChoiceDraft {
  const fixContent = <T extends { content: ChoiceDraft["correct"]["content"] }>(c: T): T =>
    c.content.type === "text" ? { ...c, content: { ...c.content, text: prose(c.content.text) } } : c;
  return {
    ...draft,
    stem: prose(draft.stem),
    ...(draft.exhibits
      ? {
          exhibits: draft.exhibits.map((e) =>
            e.type === "table" ? { ...e, rows: e.rows.map((row) => row.map(prose)) } : { ...e, items: e.items.map((i) => ({ ...i, text: prose(i.text) })) }
          ),
        }
      : {}),
    ...(draft.statements ? { statements: draft.statements.map((st) => ({ ...st, text: prose(st.text) })) } : {}),
    correct: fixContent(draft.correct),
    distractors: draft.distractors.map(fixContent),
  };
}

const conceptQuestion = (spec: Parameters<typeof rawConceptQuestion>[0]): ChoiceDraft => tidy(rawConceptQuestion(spec));
const statementQuestion = (spec: Parameters<typeof rawStatementQuestion>[0]): ChoiceDraft => tidy(rawStatementQuestion(spec));

// ---------------------------------------------------------------- helpers

const round2 = (x: number): number => Math.round(x * 100) / 100;
/** A rate as a decimal for subscripts and factors: 0.035 → `0.035`. */
const dj = (x: number): string => String(Number(x.toFixed(8)));
/** `a_{\overline{20|}\,0.035}` */
const aS = (n: number | string, j: number | string): string => `a_{\\overline{${n}|}\\,${typeof j === "number" ? dj(j) : j}}`;
const sS = (n: number | string, j: number | string): string => `s_{\\overline{${n}|}\\,${typeof j === "number" ? dj(j) : j}}`;
const sdS = (n: number | string, j: number | string): string => `\\ddot{s}_{\\overline{${n}|}\\,${typeof j === "number" ? dj(j) : j}}`;
/** `(1.035)^{-20}` */
const vS = (j: number, t: number | string): string => `(${dj(1 + j)})^{-${t}}`;
const accS = (j: number, t: number | string): string => `(${dj(1 + j)})^{${t}}`;

/** Price expression: `coupon·a(n) + C·v^n` at rate j. */
const priceE = (coupon: number, C: number, j: number | string, n: number): string =>
  `(${lit(coupon)}*${aExpr(n, j)} + ${lit(C)}*${vPow(j, n)})`;
/** The same price written term by term (the independent reference). */
const priceTerms = (coupon: number, C: number, j: number, n: number): string => {
  const terms: string[] = [];
  for (let t = 1; t <= n; t += 1) terms.push(`${lit(coupon + (t === n ? C : 0))}*(1+${lit(j)})**(-${t})`);
  return `(${terms.join(" + ")})`;
};
/** Accumulated value at time n of a coupon at each of times 1..n, term by term, at rate k. */
const couponAV = (coupon: number, k: number, n: number): string => {
  const terms: string[] = [];
  for (let t = 1; t <= n; t += 1) terms.push(`${lit(coupon)}*(1+${lit(k)})**(${n - t})`);
  return `(${terms.join(" + ")})`;
};

/** A distractor in one line. */
function opt(
  content: ConceptOption["content"],
  misconception: MisconceptionId,
  why: string,
  stage: number,
  failure: ConceptFailure,
  extra: Partial<ConceptOption> = {}
): ConceptOption {
  return { content, misconception, why, stage, failure, ...extra };
}

const ALL_COMBOS: StatementKey[][] = [["I", "II", "III"], [], ["I"], ["II"], ["III"], ["I", "II"], ["I", "III"], ["II", "III"]];

/**
 * Further statement combinations for an I/II/III item: every combination that
 * misjudges two or more statements, tied to one extra misconception (only one
 * is needed; the validator drops the truth set and the single flips).
 */
function multiFlipExtras(statements: StatementSpec[], misconception: MisconceptionId, stage: number) {
  const truth = new Set(statements.filter((s) => s.truth).map((s) => s.key));
  return ALL_COMBOS.filter((combo) => {
    const wrong = statements.filter((s) => combo.includes(s.key) !== truth.has(s.key));
    return wrong.length >= 2;
  }).map((combo) => {
    const wrong = statements.filter((s) => combo.includes(s.key) !== truth.has(s.key));
    return {
      keys: combo,
      misconception,
      why: `This misjudges ${wrong.map((s) => `statement ${s.key}`).join(" and ")}: ${wrong.map((s) => s.justification).join(" ")}`,
      stage,
      failure: "conclusion" as ConceptFailure,
    };
  });
}

const levelTags = (level: Difficulty, l2: Presentation[], l3: Presentation[]): Presentation[] =>
  level === 3 ? l3 : level === 2 ? l2 : ["direct"];

/** Draws a yield that differs from `avoid` by at least `gap`. */
const yieldAway = (rng: Parameters<ChoiceTemplate["generate"]>[0], lo: number, hi: number, avoid: number, gap = 0.004): number =>
  drawUntil(() => gridRate(rng, lo, hi, 0.005), (x) => Math.abs(x - avoid) >= gap);

// ================================================================ BONDS.price_redemption

const priceDefinition: ChoiceTemplate = conceptTemplate({
  id: "con-bond-price-definition",
  family: "con-bond-values",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.price_redemption",
  secondary: ["BONDS.terms"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "interpretation"],
  soaConcept: "Distinguishing a bond's price and redemption value from its face amount and other values.",
  variants: 2,
  generate(rng, level, variant) {
    const F = 1000 * rng.int(1, 5);
    const n = rng.int(8, 20);
    const r = gridRate(rng, 0.04, 0.08, 0.005);
    const C = F * (1 + 0.05 * rng.int(1, 3));
    const j = yieldAway(rng, 0.03, 0.09, r);
    const Fr = F * r;
    const P = round2(bondPrice(F, r, C, j, n));
    const askPrice = variant === 1;
    const steps = [
      { concept: "bond.face-redemption", reasoning: "The face amount sizes the coupons ($Fr$); the redemption value $C$ is what is paid at maturity besides the last coupon." },
      { concept: "bond.price-yield", reasoning: "The price is the present value, at the yield rate, of every coupon and the redemption payment." },
      ...(level === 2 ? [{ concept: "bond.price-forms", reasoning: `Equivalently $P = Fr\\,a_{\\overline{n|}} + Cv^n$, so $C = (P - Fr\\,a_{\\overline{n|}})(1+j)^n$: any one of $P$, $C$, $j$ follows from the others.` }] : []),
    ];
    const common = {
      steps,
      conditions: ["Level coupons at the end of each period; a single redemption payment at maturity.", "One yield rate for every payment."],
      relationship: "$P = Fr\\,a_{\\overline{n|}\\,j} + C\\,v_j^n$, with $F$ the face amount and $C$ the redemption value.",
      counterexample: "For a bond redeemable at par whose coupon rate equals its yield, price, face amount and redemption value all coincide.",
      transfer: {
        principle: "Name each amount by its role: $F$ sizes coupons, $C$ is paid at maturity, $P$ is the PV of everything at the yield.",
        unusual: "Several different amounts attached to one bond must be told apart.",
        misread: "‘Face’, ‘par’ and ‘redemption’ are interchangeable only when the bond is redeemable at par.",
      },
      params: { F, n, r, C, j, P, variant },
    };
    if (level === 1) {
      return conceptQuestion({
        ...common,
        stem: askPrice
          ? `An investor buys a bond to earn a specified yield rate. Determine which of the following is the price the investor pays.`
          : `Determine which of the following is the redemption value of a bond.`,
        correct: askPrice
          ? { content: "The present value, at the yield rate, of the coupons and the redemption payment", why: "The price is what makes the investment earn exactly the yield rate: the PV at that rate of every future payment." }
          : { content: "The amount paid to the bondholder at maturity, in addition to the final coupon", why: "The redemption value $C$ is the contractual amount repaid at maturity; it need not equal the face amount." },
        distractors: askPrice
          ? [
              opt("The face amount of the bond, on which each of the coupons is calculated", "VAR_FACE_FOR_PRICE", "The face amount sizes the coupons; the price depends on the yield.", 0, "recognition", { conditionTrue: "Price equals face only for a bond redeemable at par whose coupon rate equals the yield.", confusedWith: "bond.face-redemption" }),
              opt("The redemption value, paid to the bondholder at maturity with the final coupon", "CONC_PAR_ASSUMPTION", "Price equals the redemption value only when $Fr = Cj$; otherwise the bond trades at a premium or discount.", 1, "interpretation", { conditionTrue: "True only when the modified coupon rate equals the yield." }),
              opt("The total of the coupons and the redemption payment, without any discounting", "SEQ_UNDISCOUNTED_SUM", "Payments due at different dates must be discounted before they are added.", 1, "application"),
              opt("The present value, at the coupon rate, of the coupons and the redemption payment", "CONC_BOND_YIELD_IS_COUPON_RATE", "The coupon rate sizes the coupons; the discounting is at the yield.", 1, "selection", { conditionTrue: "It gives the price only when the coupon rate happens to equal the yield and $C = F$." }),
              opt("The present value, at the yield rate, of the coupons, excluding the redemption payment", "CONC_IGNORED_REDEMPTION", "The redemption payment is part of what the investor buys.", 1, "application"),
            ]
          : [
              opt("The amount stated on the bond on which each of the coupons is calculated", "CONC_BOND_REDEMPTION_AS_FACE", "That is the face (par) amount; it equals the redemption value only for a bond redeemable at par.", 0, "recognition", { conditionTrue: "The two coincide when the bond is redeemable at par.", confusedWith: "bond.face-redemption" }),
              opt("The present value, at the yield rate, of the coupons and the final payment", "CONC_BOOK_MARKET_CONFUSION", "That is the price (or, later, the book value), not the redemption value.", 1, "interpretation", { confusedWith: "bond.price-yield" }),
              opt("The total of all the coupons and the final payment, without any discounting", "SEQ_UNDISCOUNTED_SUM", "The redemption value is one payment, not the undiscounted total of all payments.", 0, "interpretation"),
              opt("The amount by which the price of the bond exceeds its face amount at purchase", "CONC_RELATED_TERM", "That describes a premium (relative to face), a different quantity.", 0, "recognition"),
              opt("The final coupon plus the face amount, paid together on the maturity date", "CONC_DOUBLE_COUNTED", "The final coupon is paid in addition to the redemption value, not as part of it.", 0, "interpretation"),
            ],
        itemFormat: "definition",
        presentation: ["direct"],
      });
    }
    // Level 2: the same distinction with numbers, checked against the explicit cash flows.
    const stem = askPrice
      ? `A bond with face amount ${mamt(F)} pays annual coupons at a rate of ${pc(r)} and is redeemable at ${mamt(C)} at the end of ${n} years. It is bought to yield an annual effective rate of ${pc(j)}.\n\nDetermine which of the following equals the price of the bond.`
      : `A bond with face amount ${mamt(F)} pays annual coupons at a rate of ${pc(r)} for ${n} years and is then redeemed. It is bought for ${mnum(P, 2)}, which gives an annual effective yield of ${pc(j)}.\n\nDetermine which of the following equals the redemption value of the bond.`;
    const truthPrice = priceTerms(Fr, C, j, n);
    const Cexact = (P - Fr * an(n, j)) * Math.pow(1 + j, n);
    const redemptionTruth = `((${lit(P)} - ${lit(Fr)}*${aExpr(n, j)})*(1+${lit(j)})**${n})`;
    if (askPrice) {
      const pv = (coupon: number, red: number, rate: number) => `${priceE(coupon, red, rate, n)}`;
      return conceptQuestion({
        ...common,
        stem,
        correct: { content: `The present value at ${pc(j)} of ${n} coupons of ${mamt(Fr)} and a payment of ${mamt(C)}`, why: `Coupons are ${pc(r)} of the face amount, the final payment is the redemption value, and discounting is at the yield: $P = ${mnum(bondPrice(F, r, C, j, n), 2)}$.`, check: { expr: pv(Fr, C, j), op: "=", than: truthPrice } },
        distractors: [
          opt(`The present value at ${pc(j)} of ${n} coupons of ${mamt(C * r)} and a payment of ${mamt(C)}`, "CONC_BOND_COUPON_ON_REDEMPTION", "Coupons are the coupon rate times the face amount, not the redemption value.", 0, "interpretation", { check: { expr: pv(C * r, C, j), op: "=", than: truthPrice }, confusedWith: "bond.face-redemption" }),
          opt(`The present value at ${pc(j)} of ${n} coupons of ${mamt(Fr)} and a payment of ${mamt(F)}`, "CONC_BOND_REDEMPTION_AS_FACE", `The bond is redeemable at ${amt2(C)}, not at its face amount.`, 0, "interpretation", { check: { expr: pv(Fr, F, j), op: "=", than: truthPrice }, conditionTrue: "Correct if the bond were redeemable at par." }),
          opt(`The present value at ${pc(r)} of ${n} coupons of ${mamt(Fr)} and a payment of ${mamt(C)}`, "CONC_BOND_YIELD_IS_COUPON_RATE", "Discounting is at the yield rate; the coupon rate only sizes the coupons.", 1, "selection", { check: { expr: pv(Fr, C, r), op: "=", than: truthPrice } }),
          opt(`The present value at ${pc(j)} of ${n} coupons of ${mamt(Fr)}, with nothing at maturity`, "CONC_IGNORED_REDEMPTION", "The redemption payment is part of what the investor buys.", 1, "application", { check: { expr: `${lit(Fr)}*${aExpr(n, j)}`, op: "=", than: truthPrice } }),
          opt(`The sum ${mamt(n * Fr + C)} of the ${n} coupons of ${mamt(Fr)} and the payment of ${mamt(C)}`, "SEQ_UNDISCOUNTED_SUM", "Payments at different dates must be discounted before they are added.", 1, "application", { check: { expr: `${lit(n * Fr + C)}`, op: "=", than: truthPrice } }),
        ],
        reference: { description: "The price written term by term at the yield; each option's present value is compared with it." },
        itemFormat: "interpretation",
        presentation: ["indirect-wording"],
        features: { unfamiliar: true },
      });
    }
    return conceptQuestion({
      ...common,
      stem,
      correct: { content: `$(${mnum(P, 2)} - ${mamt(Fr)}\\,${aS(n, j)})(${dj(1 + j)})^{${n}}$`, why: `The redemption payment's present value is the price less the coupons' present value; accumulating it ${n} years gives $C = ${mnum(Cexact, 2)}$.`, check: { expr: redemptionTruth, op: "=", than: `${lit(Cexact)}` } },
      distractors: [
        opt(`$(${mnum(P, 2)} - ${mamt(Fr)}\\,${aS(n, j)})(${dj(1 + j)})^{-${n}}$`, "CONC_MOVED_WRONG_WAY", "The redemption payment's PV must be accumulated to maturity, not discounted further.", 2, "application", { check: { expr: `((${lit(P)} - ${lit(Fr)}*${aExpr(n, j)})*(1+${lit(j)})**(-${n}))`, op: "=", than: lit(Cexact) } }),
        opt(`$(${mnum(P, 2)} - ${n} \\times ${mamt(Fr)})(${dj(1 + j)})^{${n}}$`, "SEQ_UNDISCOUNTED_SUM", "The coupons must be removed at their present value, not their undiscounted total.", 1, "application", { check: { expr: `((${lit(P)} - ${lit(n * Fr)})*(1+${lit(j)})**${n})`, op: "=", than: lit(Cexact) } }),
        opt(`$(${mnum(P, 2)} - ${mamt(Fr)}\\,${sS(n, j)})(${dj(1 + j)})^{${n}}$`, "FORMULA_AV_FOR_PV", "The price is a time-0 value, so the coupons' time-0 value $Fr\\,a_{\\overline{n|}}$ is subtracted, not $Fr\\,s_{\\overline{n|}}$.", 2, "selection", { check: { expr: `((${lit(P)} - ${lit(Fr)}*${sExpr(n, j)})*(1+${lit(j)})**${n})`, op: "=", than: lit(Cexact) } }),
        opt(`$${mnum(P, 2)}(${dj(1 + j)})^{${n}} + ${mamt(Fr)}\\,${sS(n, j)}$`, "ALG_SIGN_ERROR", "Accumulating the price gives the coupons' and the redemption's value at maturity; the coupons must be subtracted, not added.", 2, "application", { check: { expr: `(${lit(P)}*(1+${lit(j)})**${n} + ${lit(Fr)}*${sExpr(n, j)})`, op: "=", than: lit(Cexact) } }),
        opt(`$${mamt(F)}$, the face amount, on which each coupon of ${mamt(Fr)} is based`, "CONC_BOND_REDEMPTION_AS_FACE", "Nothing says the bond is redeemable at par; the price and yield fix the redemption value.", 0, "interpretation", { check: { expr: lit(F), op: "=", than: lit(Cexact) } }),
      ],
      reference: { description: "Redemption value recovered from the price, coupons and yield; each option's amount is compared with it." },
      itemFormat: "interpretation",
      presentation: ["inverse"],
      features: { unfamiliar: true },
    });
  },
});

/** Prose amount (no math). */
function amt2(x: number): string {
  return mamt(x).replace(/\{,\}/g, ",");
}

const priceFormula: ChoiceTemplate = conceptTemplate({
  id: "con-bond-price-formula",
  family: "con-bond-price-forms",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.price_redemption",
  secondary: ["BONDS.coupons", "BONDS.terms"],
  itemFormat: "expression-selection",
  conceptFamily: "equation",
  dimensions: ["equation_construction", "rate_conversion"],
  reasoning: ["formula_selection", "translation", "concept_recognition"],
  soaConcept: "Selecting the premium/discount or Makeham form of a bond price.",
  variants: 2,
  generate(rng, level, variant) {
    const F = 1000 * rng.int(1, 5);
    const years = rng.int(level === 1 ? 8 : 6, level === 1 ? 20 : 15);
    const semi = level >= 2;
    const m = semi ? 2 : 1;
    const N = years * m;
    const rAnnual = gridRate(rng, 0.04, 0.09, 0.005);
    const C = F * (1 + 0.05 * rng.int(1, 4));
    const yAnnual = yieldAway(rng, 0.03, 0.09, rAnnual);
    const coupon = (F * rAnnual) / m;
    // Level 3 quotes the yield as an annual effective rate; level 2 as a nominal rate convertible semiannually.
    const j = level === 3 ? Math.pow(1 + yAnnual, 0.5) - 1 : yAnnual / m;
    const jShown = level === 3 ? "j" : dj(j);
    const P = bondPrice(coupon, 1, C, j, N);
    const truth = priceTerms(coupon, C, j, N);
    const couponText = semi ? `coupons semiannually at an annual rate of ${pc(rAnnual)}` : `annual coupons at a rate of ${pc(rAnnual)}`;
    const yieldText = level === 3 ? `an annual effective rate of ${pc(yAnnual)}` : level === 2 ? `an annual nominal rate of ${pc(yAnnual)} convertible semiannually` : `an annual effective rate of ${pc(yAnnual)}`;
    const where = level === 3 ? `, \\; j = (${dj(1 + yAnnual)})^{1/2} - 1` : "";
    const stem =
      variant === 0
        ? `A ${years}-year bond with face amount ${mamt(F)} pays ${couponText} and is redeemable at ${mamt(C)}. It is bought to yield ${yieldText}.\n\nDetermine which of the following expressions equals the price of the bond.`
        : `An investor pays $P$ for a bond with face amount ${mamt(F)} that is redeemable at ${mamt(C)} after ${years} years and pays ${couponText}. The price gives the investor ${yieldText}.\n\nDetermine which of the following is an expression for $P$.`;
    const a = (k: number, rate: number | string = jShown) => aS(k, rate);
    const jE = lit(j);
    const pd = (Cx: number, cpn: number, rate: number, factor: "a" | "s" = "a", sign = 1) =>
      `(${lit(Cx)} + ${sign}*(${lit(cpn)} - ${lit(Cx)}*${lit(rate)})*${factor === "a" ? aExpr(N, rate) : sExpr(N, rate)})`;
    const jDiv = yAnnual / 2;
    const options: { correct: ConceptOption; distractors: ConceptOption[] } =
      variant === 0
        ? {
            correct: { content: math(`${mamt(C)} + \\bigl(${mamt(coupon)} - ${mamt(C)}(${jShown})\\bigr)${a(N)}${where}`), why: `Premium/discount form: the price is the redemption value plus the PV of the excess of each coupon over interest on $C$ at the yield, $P = ${mnum(P, 2)}$.`, probe: pd(C, coupon, j) },
            distractors: [
              ...(level === 3 ? [opt(math(`${mamt(C)} + \\bigl(${mamt(coupon)} - ${mamt(C)}(${dj(jDiv)})\\bigr)${aS(N, jDiv)}`), "RATE_DIVIDED_EFFECTIVE", "An annual effective rate is not halved; the half-year rate is $(1+i)^{1/2} - 1$.", 0, "application", { probe: pd(C, coupon, jDiv), confusedWith: "bond.terms" })] : []),
              ...(level === 2 ? [opt(math(`${mamt(C)} + \\bigl(${mamt(F * rAnnual)} - ${mamt(C)}(${jShown})\\bigr)${a(N)}${where}`), "RATE_ANNUAL_FOR_PERIODIC", "With semiannual coupons each coupon is half the annual coupon.", 0, "application", { probe: pd(C, F * rAnnual, j), confusedWith: "bond.terms" })] : []),
              opt(math(`${mamt(F)} + \\bigl(${mamt(coupon)} - ${mamt(F)}(${jShown})\\bigr)${a(N)}${where}`), "CONC_BOND_REDEMPTION_AS_FACE", `The base of the formula is the redemption value ${amt2(C)}, not the face amount.`, 0, "interpretation", { probe: pd(F, coupon, j), conditionTrue: "Correct for a bond redeemable at par.", confusedWith: "bond.face-redemption" }),
              opt(math(`${mamt(C)} + \\bigl(${mamt((C * rAnnual) / m)} - ${mamt(C)}(${jShown})\\bigr)${a(N)}${where}`), "CONC_BOND_COUPON_ON_REDEMPTION", "Coupons are the coupon rate times the face amount, not the redemption value.", 0, "interpretation", { probe: pd(C, (C * rAnnual) / m, j) }),
              opt(math(`${mamt(C)} + \\bigl(${mamt(C)}(${jShown}) - ${mamt(coupon)}\\bigr)${a(N)}${where}`), "ALG_SIGN_ERROR", "The premium is the PV of coupon minus interest on $C$, $Fr - Cj$, not the reverse.", 1, "application", { probe: pd(C, coupon, j, "a", -1) }),
              opt(math(`${mamt(C)} + \\bigl(${mamt(coupon)} - ${mamt(C)}(${jShown})\\bigr)${sS(N, jShown)}${where}`), "FORMULA_AV_FOR_PV", "The premium is a present value, so it uses $a_{\\overline{n|}}$, not $s_{\\overline{n|}}$.", 1, "selection", { probe: pd(C, coupon, j, "s") }),
            ],
          }
        : (() => {
            const K = `${mamt(C)}${vS(j, N)}`;
            const Kshown = level === 3 ? `${mamt(C)}v_j^{${N}}` : K;
            const mk = (cpn: number, red: number, Kbase: number, rate: number, inverted = false) =>
              `(${lit(Kbase)}*${vPow(rate, N)} + ${inverted ? `${lit(rate)}/(${lit(cpn)}/${lit(red)})` : `(${lit(cpn)}/${lit(red)})/${lit(rate)}`}*(${lit(red)} - ${lit(Kbase)}*${vPow(rate, N)}))`;
            const gFrac = (cpn: number, red: number) => `\\frac{${mamt(cpn)}}{${mamt(red)}(${jShown})}`;
            return {
              correct: { content: math(`${Kshown} + ${gFrac(coupon, C)}\\bigl(${mamt(C)} - ${Kshown}\\bigr)${where}`), why: `Makeham: $P = K + \\tfrac{g}{j}(C - K)$ with $K = Cv^n$ and modified coupon rate $g = Fr/C$, so $g/j = ${mamt(coupon)}/(${mamt(C)}j)$; $P = ${mnum(P, 2)}$.`, probe: mk(coupon, C, C, j) },
              distractors: [
                ...(level === 3 ? [opt(math(`${mamt(C)}${vS(jDiv, N)} + \\frac{${mamt(coupon)}}{${mamt(C)}(${dj(jDiv)})}\\bigl(${mamt(C)} - ${mamt(C)}${vS(jDiv, N)}\\bigr)`), "RATE_DIVIDED_EFFECTIVE", "An annual effective rate is not halved; the half-year rate is $(1+i)^{1/2} - 1$.", 0, "application", { probe: mk(coupon, C, C, jDiv) })] : []),
                ...(level === 2 ? [opt(math(`${Kshown} + ${gFrac(F * rAnnual, C)}\\bigl(${mamt(C)} - ${Kshown}\\bigr)${where}`), "RATE_ANNUAL_FOR_PERIODIC", "With semiannual coupons the coupon per period, and so $g$ per period, is half the annual figure.", 0, "application", { probe: mk(F * rAnnual, C, C, j) })] : []),
                opt(math(`${Kshown} + ${gFrac(coupon, F)}\\bigl(${mamt(C)} - ${Kshown}\\bigr)${where}`), "CONC_BOND_COUPON_RATE_AS_MODIFIED", "Makeham's $g$ is the modified coupon rate $Fr/C$, not the coupon rate $r = Fr/F$.", 1, "selection", { probe: `(${lit(C)}*${vPow(j, N)} + (${lit(coupon)}/${lit(F)})/${jE}*(${lit(C)} - ${lit(C)}*${vPow(j, N)}))`, conditionTrue: "The two agree when the bond is redeemable at par.", confusedWith: "bond.modified-coupon" }),
                opt(math(`${level === 3 ? `${mamt(F)}v_j^{${N}}` : `${mamt(F)}${vS(j, N)}`} + ${gFrac(coupon, C)}\\bigl(${mamt(C)} - ${level === 3 ? `${mamt(F)}v_j^{${N}}` : `${mamt(F)}${vS(j, N)}`}\\bigr)${where}`), "CONC_BOND_REDEMPTION_AS_FACE", "$K$ is the PV of the redemption value $C$, not of the face amount.", 0, "interpretation", { probe: mk(coupon, C, F, j) }),
                opt(math(`${Kshown} + \\frac{${mamt(C)}(${jShown})}{${mamt(coupon)}}\\bigl(${mamt(C)} - ${Kshown}\\bigr)${where}`), "ALG_INVERTED_RATIO", "The factor is $g/j$, not $j/g$.", 1, "application", { probe: mk(coupon, C, C, j, true) }),
                opt(math(`${mamt(C)} + ${gFrac(coupon, C)}\\bigl(${mamt(C)} - ${Kshown}\\bigr)${where}`), "SEQ_UNDISCOUNTED_SUM", "The first term is the PV of the redemption payment, $K = Cv^n$, not $C$ itself.", 1, "application", { probe: `(${lit(C)} + (${lit(coupon)}/${lit(C)})/${jE}*(${lit(C)} - ${lit(C)}*${vPow(j, N)}))` }),
              ],
            };
          })();
    return conceptQuestion({
      stem,
      ...options,
      reference: { values: [{ label: "P", expr: truth }], description: `The price written as the explicit sum of ${N} discounted coupons and the redemption payment, $P = ${mnum(P, 2)}$. Each option is evaluated and only the correct one reproduces it.` },
      steps: [
        { concept: "bond.face-redemption", reasoning: `Coupon per period $= ${mamt(F)} \\times ${semi ? `${mpc(rAnnual)}/2` : mpc(rAnnual)} = ${mamt(coupon)}$; redemption value $C = ${mamt(C)}$.` },
        ...(level >= 2 ? [{ concept: "bond.terms", reasoning: level === 3 ? `The yield per half-year is $j = (1 + ${dj(yAnnual)})^{1/2} - 1$, over $${N}$ half-years.` : `The yield per half-year is $${mpc(yAnnual)}/2 = ${dj(j)}$, over $${N}$ half-years.` }] : []),
        { concept: "bond.price-forms", reasoning: variant === 0 ? "$P = C + (Fr - Cj)a_{\\overline{n|}}$: the redemption value plus the PV of each coupon's excess over interest on $C$." : "Makeham: $P = K + \\tfrac{g}{j}(C - K)$ with $K = Cv^n$." },
        ...(variant === 1 ? [{ concept: "bond.modified-coupon", reasoning: "Makeham's $g$ is the modified coupon rate $Fr/C$, which differs from $r$ when $C \\ne F$." }] : []),
      ],
      conditions: ["Level coupons at the end of each period and one redemption payment at maturity.", "One yield rate per coupon period for every payment."],
      relationship: "$P = Fr\\,a_{\\overline{n|}} + Cv^n = C + (Fr - Cj)a_{\\overline{n|}} = K + \\tfrac{g}{j}(C - K)$",
      counterexample: "If $C = F$, then $g = r$ and the face and redemption traps disappear.",
      transfer: {
        principle: "Each price form is the same PV rearranged; fix the per-period coupon, the redemption value and the per-period yield before choosing a form.",
        unusual: "The price is not computed; the correct algebraic form must be recognised.",
        misread: "Redemption value and face amount sit in different places in the formula.",
      },
      itemFormat: "expression-selection",
      presentation: levelTags(level, ["frequency"], ["frequency", "hidden-structure"]),
      features: { unfamiliar: level >= 2, formulaRetrieval: true },
      modelingDecisions: level === 3 ? 2 : undefined,
      params: { F, years, C, rAnnual, yAnnual, variant },
    });
  },
});

const priceDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-bond-price-diagnosis",
  family: "con-bond-price-forms",
  topic: "BONDS",
  levels: [2, 3],
  objective: "BONDS.price_redemption",
  secondary: ["BONDS.coupons"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "interpretation"],
  reasoning: ["validation", "concept_recognition", "translation"],
  soaConcept: "Diagnosing the conceptual error in a proposed bond-price calculation when the redemption value differs from face.",
  variants: 2,
  generate(rng, level, variant) {
    const F = 1000 * rng.int(1, 5);
    const years = rng.int(6, 15);
    const semi = level === 3;
    const m = semi ? 2 : 1;
    const N = years * m;
    const r = gridRate(rng, 0.04, 0.09, 0.005);
    const C = F * (1 + 0.05 * rng.int(1, 3));
    const y = yieldAway(rng, 0.03, 0.09, r);
    const j = semi ? Math.pow(1 + y, 0.5) - 1 : y;
    const cpn = (F * r) / m;
    const truth = priceTerms(cpn, C, j, N);
    const k = gridRate(rng, 0.02, 0.05, 0.005);
    const jName = semi ? "j" : dj(j);
    const rateLine = semi ? `, \\quad j = (${dj(1 + y)})^{1/2} - 1` : "";
    const couponText = semi ? `semiannual coupons at an annual rate of ${pc(r)}` : `annual coupons at a rate of ${pc(r)}`;
    const extra = level === 3 ? ` Coupons will be reinvested on receipt at an annual effective rate of ${pc(k)}.` : "";
    let stem: string;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    if (variant === 0) {
      const wrongCpn = (C * r) / m;
      const proposed = bondPrice(wrongCpn, 1, C, j, N);
      stem =
        `A ${years}-year bond with face amount ${mamt(F)} pays ${couponText} and is redeemable at ${mamt(C)}. It is bought to yield an annual effective rate of ${pc(y)}.${extra} A candidate calculates the price as\n\n$$${mamt(wrongCpn)}\\,${aS(N, jName)} + ${mamt(C)}\\,v^{${N}} = ${mnum(proposed, 2)}${rateLine}.$$\n\nWhich of the following correctly describes the candidate's calculation?`;
      correct = { content: `Each coupon should be ${amt2(cpn)}, the coupon rate times the face amount; the rest is right.`, why: `Coupons are based on face, so the price is $${mnum(bondPrice(cpn, 1, C, j, N), 2)}$.`, check: { expr: priceE(cpn, C, j, N), op: "=", than: truth } };
      distractors = [
        opt("The calculation is correct, since the coupons are based on the redemption value.", "CONC_BOND_COUPON_ON_REDEMPTION", "Coupons are always the coupon rate times the face amount.", 0, "recognition", { check: { expr: priceE(wrongCpn, C, j, N), op: "=", than: truth }, confusedWith: "bond.face-redemption", conditionTrue: "It would be correct for a bond redeemable at par." }),
        opt(`The redemption payment should be ${amt2(F)}, the face amount; the rest is right.`, "CONC_BOND_REDEMPTION_AS_FACE", `The bond is redeemable at ${amt2(C)}; the error is in the coupons.`, 0, "interpretation", { check: { expr: priceE(wrongCpn, F, j, N), op: "=", than: truth } }),
        opt(`The coupons should be discounted at the coupon rate of ${pc(r)}; the rest is right.`, "CONC_BOND_YIELD_IS_COUPON_RATE", "Every payment is discounted at the yield.", 1, "selection", { check: { expr: `(${lit(wrongCpn)}*${aExpr(N, r / m)} + ${lit(C)}*${vPow(j, N)})`, op: "=", than: truth } }),
        opt(`Both the coupons and the redemption payment should be based on ${amt2(F)}.`, "TRANS_IGNORED_CONDITION", `That fixes the coupons but drops the redemption clause: $C = ${mamt(C)}$.`, 0, "application", { check: { expr: priceE(cpn, F, j, N), op: "=", than: truth } }),
        ...(level === 3
          ? [opt(`The coupons should be accumulated at ${pc(k)} and discounted at the yield; the rest is right.`, "TRANS_IRRELEVANT_INFO", "The reinvestment rate affects the accumulated value, not the price at a given yield.", 1, "selection", { check: { expr: `(${lit(wrongCpn)}*${sExpr(N, k)}*${vPow(j, N)} + ${lit(C)}*${vPow(j, N)})`, op: "=", than: truth } })]
          : []),
      ];
    } else {
      const proposed = C + (cpn - F * j) * an(N, j);
      stem =
        `A ${years}-year bond with face amount ${mamt(F)} pays ${couponText} and is redeemable at ${mamt(C)}. It is bought to yield an annual effective rate of ${pc(y)}.${extra} A candidate writes\n\n$$P = ${mamt(C)} + \\bigl(${mamt(cpn)} - ${mamt(F)}\\,${jName}\\bigr)${aS(N, jName)} = ${mnum(proposed, 2)}${rateLine}.$$\n\nWhich of the following correctly describes the candidate's calculation?`;
      const pd = (base: number, rateBase: number, rate: number) => `(${lit(base)} + (${lit(cpn)} - ${lit(rateBase)}*${lit(rate)})*${aExpr(N, rate)})`;
      correct = { content: `The interest term should be ${amt2(C)} times the yield rate, as in $Fr - Cj$.`, why: `In $P = C + (Fr - Cj)a_{\\overline{n|}}$ each coupon is compared with interest on the redemption value: $P = ${mnum(C + (cpn - C * j) * an(N, j), 2)}$.`, check: { expr: pd(C, C, j), op: "=", than: truth } };
      distractors = [
        opt("The calculation is correct, since interest is earned on the face amount.", "CONC_BOND_COUPON_RATE_AS_MODIFIED", "The premium compares each coupon with $Cj$, interest on the redemption value.", 1, "selection", { check: { expr: pd(C, F, j), op: "=", than: truth }, conditionTrue: "It would be correct for a bond redeemable at par." }),
        opt(`The leading term should be ${amt2(F)} to match the interest term.`, "CONC_BOND_REDEMPTION_AS_FACE", `That prices a bond redeemable at ${amt2(F)}, not ${amt2(C)}.`, 0, "interpretation", { check: { expr: pd(F, F, j), op: "=", than: truth } }),
        opt(`The annuity factor should be ${sS(N, jName).replace(/^/, "$").concat("$")} because the premium accrues to maturity.`, "FORMULA_AV_FOR_PV", "The premium is a time-0 value, so it uses $a_{\\overline{n|}}$.", 1, "selection", { check: { expr: `(${lit(C)} + (${lit(cpn)} - ${lit(F)}*${lit(j)})*${sExpr(N, j)})`, op: "=", than: truth } }),
        opt(`The coupon term should be ${amt2((C * r) / m)}, the coupon rate times ${amt2(C)}.`, "CONC_BOND_COUPON_ON_REDEMPTION", "The coupon is based on face; it is the interest term that must use $C$.", 0, "interpretation", { check: { expr: `(${lit(C)} + (${lit((C * r) / m)} - ${lit(F)}*${lit(j)})*${aExpr(N, j)})`, op: "=", than: truth } }),
        ...(level === 3
          ? [opt(`The yield in the factor should be ${pc(k)}, the rate the coupons earn.`, "TRANS_IRRELEVANT_INFO", "The reinvestment rate does not enter the price at a given yield.", 1, "selection", { check: { expr: `(${lit(C)} + (${lit(cpn)} - ${lit(F)}*${lit(j)})*${aExpr(N, k / 2)})`, op: "=", than: truth } })]
          : []),
      ];
    }
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { description: "The price written term by term at the yield; each proposed correction is evaluated and compared with it." },
      steps: [
        { concept: "bond.face-redemption", reasoning: `Coupons are based on face: $${mamt(cpn)}$ per ${semi ? "half-year" : "year"}; the redemption payment is $C = ${mamt(C)}$.` },
        { concept: "bond.price-forms", reasoning: variant === 0 ? "$P = Fr\\,a_{\\overline{n|}} + Cv^n$: coupons from $F$, the final payment from $C$." : "$P = C + (Fr - Cj)a_{\\overline{n|}}$: the comparison is between each coupon and interest on $C$." },
        { concept: "bond.modified-coupon", reasoning: "When $C \\ne F$, $Fr$ and $Cj$ differ from $Fr$ and $Fj$; the bond's premium or discount is measured against $C$." },
        ...(level === 3 ? [{ concept: "bond.terms", reasoning: `The annual effective yield converts to $j = (1 + ${dj(y)})^{1/2} - 1$ per half-year; the reinvestment rate plays no part in the price.` }] : []),
      ],
      conditions: ["The yield is the only discount rate.", "Coupons are level and based on the face amount."],
      relationship: "$P = Fr\\,a_{\\overline{n|}} + Cv^n = C + (Fr - Cj)a_{\\overline{n|}}$",
      counterexample: "For a bond redeemable at par the candidate's calculation would be right.",
      transfer: {
        principle: "Check every input's role: $F$ sizes coupons, $C$ is redeemed and sets the premium base, $j$ discounts.",
        unusual: "A worked solution is judged rather than produced.",
        misread: "Face and redemption values are easy to swap when both appear.",
      },
      itemFormat: "error-diagnosis",
      presentation: levelTags(level, ["indirect-wording"], ["irrelevant-info", "frequency"]),
      features: { unfamiliar: true, multiConcept: true },
      modelingDecisions: level === 3 ? 2 : undefined,
      params: { F, years, C, r, y, variant },
    });
  },
});

// ================================================================ BONDS.book_market

/** Common draw for book/market items: a bond, a purchase yield and a later market yield. */
function drawHeld(rng: Parameters<ChoiceTemplate["generate"]>[0], semi: boolean, redeemAtPar: boolean) {
  const F = 1000 * rng.int(1, 5);
  const years = rng.int(10, 20);
  const m = semi ? 2 : 1;
  const N = years * m;
  const r = gridRate(rng, 0.04, 0.09, 0.005);
  const C = redeemAtPar ? F : F * (1 + 0.05 * rng.int(1, 3));
  const cpn = (F * r) / m;
  const y = drawUntil(() => gridRate(rng, 0.03, 0.09, 0.005), (x) => Math.abs(x - r) >= 0.004 && Math.abs(F * r - C * x) >= 0.002 * F);
  const y2 = drawUntil(() => gridRate(rng, 0.03, 0.1, 0.005), (x) => Math.abs(x - y) >= 0.005 && Math.abs(x - r) >= 0.004);
  const yearsHeld = rng.int(3, years - 3);
  const t = yearsHeld * m;
  return { F, years, m, N, r, C, cpn, y, y2, j: y / m, j2: y2 / m, yearsHeld, t, R: N - t, P: bondPrice(cpn, 1, C, y / m, N) };
}

const bookMarketInterp: ChoiceTemplate = conceptTemplate({
  id: "con-bond-book-market-interp",
  family: "con-bond-values",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.book_market",
  secondary: ["BONDS.price_redemption"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "terminology"],
  soaConcept: "Telling book value (purchase yield) from market value (current yield) after a bond has been held for some time.",
  variants: 2,
  generate(rng, level, variant) {
    const semi = level === 2;
    const b = drawHeld(rng, semi, level === 1);
    const { F, years, N, r, C, cpn, y, y2, j, j2, yearsHeld, t, R, P } = b;
    const per = semi ? " per half-year" : "";
    const jt = semi ? `${pc(j)}${per}` : pc(j);
    const j2t = semi ? `${pc(j2)}${per}` : pc(j2);
    const askMarket = variant === 1;
    const bookTruth = `(${lit(P)}*(1+${lit(j)})**${t} - ${couponAV(cpn, j, t)})`;
    const marketTruth = priceTerms(cpn, C, j2, R);
    const truth = askMarket ? marketTruth : bookTruth;
    const couponText = semi ? `semiannual coupons at an annual rate of ${pc(r)}` : `annual coupons at a rate of ${pc(r)}`;
    const redText = C === F ? "redeemable at par" : `redeemable at ${mamt(C)}`;
    const yText = semi ? `an annual nominal rate of ${pc(y)} convertible semiannually` : `an annual effective rate of ${pc(y)}`;
    const y2Text = semi ? `${pc(y2)} convertible semiannually` : `${pc(y2)}`;
    const when = semi ? `the coupon at the end of year ${yearsHeld}` : `the ${ord(t)} coupon`;
    const stem = askMarket
      ? `A ${years}-year bond with face amount ${mamt(F)} pays ${couponText} and is ${redText}. An investor bought it to yield ${yText}. Immediately after ${when}, bonds of this kind are priced to yield ${y2Text}.\n\nDetermine which of the following is the market value of the bond at that time.`
      : `An investor buys a ${years}-year bond with face amount ${mamt(F)}, ${couponText}, ${redText}, to yield ${yText}. Immediately after ${when}, the yield on similar bonds is ${y2Text}.\n\nDetermine which of the following is the investor's book value of the bond at that time.`;
    const pvAt = (rate: number, k: number, red = C) => priceE(cpn, red, rate, k);
    const straight = `(${lit(P)} - ${t}*(${lit(P)} - ${lit(C)})/${N})`;
    const pool: ConceptOption[] = [
      ...(askMarket
        ? [opt(`The present value at ${jt} of the remaining ${R} coupons and the redemption payment`, "CONC_BOOK_MARKET_CONFUSION", "That is the book value: it keeps the purchase yield.", 1, "interpretation", { check: { expr: pvAt(j, R), op: "=", than: truth }, conditionTrue: "The two coincide when the market yield equals the purchase yield.", confusedWith: "bond.book-vs-market" })]
        : [opt(`The present value at ${j2t} of the remaining ${R} coupons and the redemption payment`, "CONC_BOOK_MARKET_CONFUSION", "That is the market value: it uses the yield prevailing now.", 1, "interpretation", { check: { expr: pvAt(j2, R), op: "=", than: truth }, conditionTrue: "The two coincide when the market yield equals the purchase yield.", confusedWith: "bond.book-vs-market" })]),
      ...(semi && C !== F ? [opt(`The present value at ${askMarket ? j2t : jt} of the remaining ${R} coupons and ${amt2(F)}`, "CONC_BOND_REDEMPTION_AS_FACE", `The final payment is the redemption value ${amt2(C)}.`, 0, "interpretation", { check: { expr: pvAt(askMarket ? j2 : j, R, F), op: "=", than: truth } })] : []),
      opt(`The present value at the coupon rate of the remaining ${R} coupons and the redemption payment`, "CONC_BOND_YIELD_IS_COUPON_RATE", "The coupon rate only sizes the coupons; value is measured at a yield.", 1, "selection", { check: { expr: pvAt(r / b.m, R), op: "=", than: truth } }),
      opt(`The price paid at purchase, since the value is fixed until the bond is sold`, "VAR_ORIGINAL_FOR_OUTSTANDING", "Both book and market value move toward the redemption value as coupons are paid.", 0, "recognition", { check: { expr: lit(P), op: "=", than: truth } }),
      askMarket
        ? opt(`The present value at ${j2t} of all ${N} original coupons and the redemption payment`, "TIMING_BALANCE_INDEX", `The ${t} coupons already paid are no longer part of the bond.`, 1, "application", { check: { expr: pvAt(j2, N), op: "=", than: truth } })
        : opt(`The purchase price accumulated at ${jt} for ${t} ${semi ? "half-years" : "years"}, with the coupons ignored`, "TRANS_IGNORED_CONDITION", "The coupons already received have repaid part of the investment and must be deducted.", 1, "application", { check: { expr: `(${lit(P)}*(1+${lit(j)})**${t})`, op: "=", than: truth } }),
      opt(`The price adjusted by ${t}/${N} of the difference between the redemption value and the price`, "MODEL_STRAIGHT_LINE", "Values follow present values at a yield, not a straight line from price to redemption.", 1, "selection", { check: { expr: straight, op: "=", than: truth } }),
    ];
    return conceptQuestion({
      stem,
      correct: askMarket
        ? { content: `The present value at ${j2t} of the remaining ${R} coupons and the redemption payment`, why: `Market value is what a buyer would now pay: the PV at the current yield, $${mnum(bondPrice(cpn, 1, C, j2, R), 2)}$.`, check: { expr: pvAt(j2, R), op: "=", than: truth } }
        : { content: `The present value at ${jt} of the remaining ${R} coupons and the redemption payment`, why: `Book value keeps the purchase yield whatever the market does: $${mnum(bondPrice(cpn, 1, C, j, R), 2)}$, the same as the price accumulated less the coupons accumulated.`, check: { expr: pvAt(j, R), op: "=", than: truth } },
      distractors: pool,
      reference: { description: askMarket ? "Market value written term by term at the current yield." : "Book value computed retrospectively: price accumulated at the purchase yield less the coupons accumulated at that yield." },
      steps: [
        { concept: "bond.book-vs-market", reasoning: askMarket ? "Market value uses the yield prevailing now; book value would keep the purchase yield." : "Book value uses the purchase yield; the current market yield is irrelevant to it." },
        { concept: "bond.book-value", reasoning: `After ${t} coupons, ${R} coupons and the redemption payment remain; value them at the chosen yield.` },
        ...(semi ? [{ concept: "bond.terms", reasoning: `Rates convertible semiannually give ${pc(j)} and ${pc(j2)} per half-year; ${yearsHeld} years is ${t} coupon periods.` }] : []),
      ],
      conditions: ["Values are taken immediately after a coupon.", "The purchase yield and the current market yield differ."],
      relationship: "$BV_t = Fr\\,a_{\\overline{n-t|}\\,j} + Cv_j^{n-t}$ (purchase yield $j$); market value uses the current yield.",
      counterexample: "If market yields have not moved since purchase, book and market values coincide.",
      transfer: {
        principle: "Ask which yield a value is computed at: purchase yield for book value, current yield for market value.",
        unusual: "Two yields are given and only one belongs in the answer.",
        misread: "Book value is an accounting value, not a market price.",
      },
      itemFormat: "interpretation",
      presentation: level === 2 ? ["valuation-date", "irrelevant-info"] : ["irrelevant-info"],
      features: { unfamiliar: level === 2, multipleValuationDates: true },
      params: { F, years, C, r, y, y2, t, variant },
    });
  },
});

const bookValueExpr: ChoiceTemplate = conceptTemplate({
  id: "con-bond-book-value-expr",
  family: "con-bond-book-value",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.book_market",
  secondary: ["BONDS.amortization"],
  itemFormat: "expression-selection",
  conceptFamily: "notation",
  dimensions: ["equation_construction", "timing"],
  reasoning: ["formula_selection", "valuation_dates", "cashflow_modelling"],
  soaConcept: "Selecting the prospective or retrospective expression for book value just after a coupon.",
  variants: 2,
  generate(rng, level, variant) {
    const semi = level >= 2;
    const b = drawHeld(rng, semi, level < 3);
    const { F, years, N, r, C, cpn, y, y2, j, j2, yearsHeld, t, R } = b;
    const P = round2(b.P);
    const retro = variant === 1;
    const truth = `(${lit(P)}*(1+${lit(j)})**${t} - ${couponAV(cpn, j, t)})`;
    const truthValue = P * Math.pow(1 + j, t) - cpn * sn(t, j);
    const couponText = semi ? `semiannual coupons at an annual rate of ${pc(r)}` : `annual coupons at a rate of ${pc(r)}`;
    const redText = C === F ? "redeemable at par" : `redeemable at ${mamt(C)}`;
    const yText = semi ? `an annual nominal rate of ${pc(y)} convertible semiannually` : `an annual effective rate of ${pc(y)}`;
    const y2Text = semi ? `${pc(y2)} convertible semiannually` : pc(y2);
    const when = semi ? `the coupon at the end of year ${yearsHeld}` : `the ${ord(t)} coupon`;
    const stem =
      `A ${years}-year bond with face amount ${mamt(F)} pays ${couponText} and is ${redText}. It was bought for ${mnum(P, 2)}, which gives ${yText}. Immediately after ${when}, similar bonds yield ${y2Text}.\n\n` +
      `Determine which of the following expressions equals the book value of the bond immediately after ${when}.`;
    const pros = (rate: number, k: number, kv: number, red = C) => `(${lit(cpn)}*${aExpr(k, rate)} + ${lit(red)}*${vPow(rate, kv)})`;
    const prosS = (rate: number, k: number | string, kv: number | string, red = C) => `${mamt(cpn)}\\,${aS(k, rate)} + ${mamt(red)}${vS(rate, kv)}`;
    const ret = (rate: number, mode: "s" | "due" | "sum" | "none") =>
      `(${lit(P)}*(1+${lit(rate)})**${t}${mode === "s" ? ` - ${lit(cpn)}*${sExpr(t, rate)}` : mode === "due" ? ` - ${lit(cpn)}*${sExpr(t, rate)}*(1+${lit(rate)})` : mode === "sum" ? ` - ${lit(t * cpn)}` : ""})`;
    const retS = (rate: number, mode: "s" | "due" | "sum" | "none") =>
      `${mnum(P, 2)}${accS(rate, t)}${mode === "s" ? ` - ${mamt(cpn)}\\,${sS(t, rate)}` : mode === "due" ? ` - ${mamt(cpn)}\\,${sdS(t, rate)}` : mode === "sum" ? ` - ${t}(${mamt(cpn)})` : ""}`;
    const yearsLeft = years - yearsHeld;
    const correct: ConceptOption = retro
      ? { content: math(retS(j, "s")), why: `Retrospectively, book value is the price accumulated at the purchase yield less the coupons accumulated at that yield: $${mnum(truthValue, 2)}$.`, probe: ret(j, "s") }
      : { content: math(prosS(j, R, R)), why: `Prospectively, book value is the PV at the purchase yield of the ${R} remaining coupons and the redemption payment: $${mnum(truthValue, 2)}$.`, probe: pros(j, R, R) };
    const distractors: ConceptOption[] = retro
      ? [
          opt(math(retS(j2, "s")), "CONC_BOOK_MARKET_CONFUSION", "Book value keeps the purchase yield; the current market yield plays no part.", 0, "interpretation", { probe: ret(j2, "s"), confusedWith: "bond.book-vs-market" }),
          opt(math(retS(j, "due")), "TIMING_IMMEDIATE_AS_DUE", "Coupons are paid at the end of each period, so they accumulate with $s_{\\overline{t|}}$, not $\\ddot{s}_{\\overline{t|}}$.", 1, "application", { probe: ret(j, "due") }),
          opt(math(retS(j, "sum")), "CONC_BOND_COUPONS_NOT_REINVESTED", "The coupons must be accumulated at the yield, exactly as the price is.", 1, "application", { probe: ret(j, "sum") }),
          opt(math(`${mnum(P, 2)} - \\tfrac{${t}}{${N}}\\bigl(${mnum(P, 2)} - ${mamt(C)}\\bigr)`), "MODEL_STRAIGHT_LINE", "Book value follows the yield (scientific) method, not a straight line.", 1, "selection", { probe: `(${lit(P)} - ${t}/${N}*(${lit(P)} - ${lit(C)}))` }),
          opt(math(retS(j, "none")), "TRANS_IGNORED_CONDITION", "The coupons already received must be deducted.", 1, "application", { probe: ret(j, "none") }),
        ]
      : [
          opt(math(prosS(j2, R, R)), "CONC_BOOK_MARKET_CONFUSION", "That is the market value; book value keeps the purchase yield.", 0, "interpretation", { probe: pros(j2, R, R), confusedWith: "bond.book-vs-market" }),
          ...(semi ? [opt(math(prosS(j, yearsLeft, yearsLeft)), "SEQ_TERM_COUNT", `${yearsLeft} years remain, which is ${R} half-year coupon periods.`, 1, "application", { probe: pros(j, yearsLeft, yearsLeft) })] : [opt(math(prosS(j, t, t)), "SEQ_TERM_COUNT", "The factors count the periods remaining, not those already elapsed.", 1, "application", { probe: pros(j, t, t) })]),
          ...(C !== F ? [opt(math(prosS(j, R, R, F)), "CONC_BOND_REDEMPTION_AS_FACE", `The final payment is the redemption value ${amt2(C)}.`, 1, "interpretation", { probe: pros(j, R, R, F) })] : []),
          opt(math(prosS(j, R + 1, R + 1)), "TIMING_BALANCE_INDEX", `Immediately after the coupon, ${R} coupons remain, not ${R + 1}.`, 1, "application", { probe: pros(j, R + 1, R + 1) }),
          opt(math(prosS(j, R, N)), "TIMING_VALUATION_DATE", `Valued at time ${t}, the redemption payment is ${R} periods away, not ${N}.`, 1, "application", { probe: pros(j, R, N) }),
          opt(math(`${mnum(P, 2)} - \\tfrac{${t}}{${N}}\\bigl(${mnum(P, 2)} - ${mamt(C)}\\bigr)`), "MODEL_STRAIGHT_LINE", "Book value follows the yield (scientific) method, not a straight line.", 1, "selection", { probe: `(${lit(P)} - ${t}/${N}*(${lit(P)} - ${lit(C)}))` }),
        ];
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { values: [{ label: "BV", expr: truth }], description: `Book value computed retrospectively term by term: the price accumulated at the purchase yield less each coupon accumulated at that yield, $${mnum(truthValue, 2)}$.` },
      steps: [
        { concept: "bond.book-vs-market", reasoning: "Book value uses the purchase yield; the yield on similar bonds now is not needed." },
        { concept: "bond.book-value", reasoning: `Immediately after coupon ${t}, ${R} coupons and the redemption payment remain (prospective), or equivalently the price has grown for ${t} periods and ${t} coupons have been received (retrospective).` },
        ...(semi ? [{ concept: "bond.terms", reasoning: `Work in half-years: ${pc(j)} per half-year, ${yearsHeld} years elapsed is ${t} periods.` }] : []),
        ...(level === 3 ? [{ concept: "bond.face-redemption", reasoning: `The redemption payment is $C = ${mamt(C)}$; coupons are based on face, $${mamt(cpn)}$.` }] : []),
      ],
      conditions: ["Immediately after a coupon.", "Book value at the purchase yield (scientific method)."],
      relationship: "$BV_t = Fr\\,a_{\\overline{n-t|}} + Cv^{n-t} = P(1+j)^t - Fr\\,s_{\\overline{t|}}$",
      counterexample: "If the market yield equalled the purchase yield, the market-value option would also give the book value.",
      transfer: {
        principle: "Book value is the outstanding balance of the bond viewed as a loan at the purchase yield.",
        unusual: "A market yield is given but not needed.",
        misread: "‘Immediately after’ the coupon leaves $n - t$ coupons, not $n - t + 1$.",
      },
      itemFormat: "expression-selection",
      presentation: levelTags(level, ["irrelevant-info", "frequency"], ["irrelevant-info", "valuation-date", "hidden-structure"]),
      features: { multipleValuationDates: true, unfamiliar: level >= 2 },
      modelingDecisions: level === 3 ? 2 : level === 2 ? 1 : undefined,
      params: { F, years, C, r, y, y2, t, variant },
    });
  },
});

const bookMarketStatements: ChoiceTemplate = conceptTemplate({
  id: "con-bond-book-market-statements",
  family: "con-bond-book-value",
  topic: "BONDS",
  levels: [2, 3],
  objective: "BONDS.book_market",
  secondary: ["BONDS.amortization", "BONDS.price_redemption"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "interpretation"],
  soaConcept: "Judging statements about book value, market value, price and redemption value after a change in yields.",
  variants: 2,
  generate(rng, level, variant) {
    const b = drawHeld(rng, false, level === 2);
    const { F, years, r, C, cpn, y, y2, j, j2, t, R, P } = b;
    const BV = priceE(cpn, C, j, R);
    const MV = priceE(cpn, C, j2, R);
    const retroTrue = `(${lit(P)}*(1+${lit(j)})**${t} - ${lit(cpn)}*${sExpr(t, j)})`;
    const redText = C === F ? "redeemable at par" : `redeemable at ${mamt(C)}`;
    const stem = `An investor buys a ${years}-year bond with face amount ${mamt(F)} and annual coupons at a rate of ${pc(r)}, ${redText}, to yield an annual effective rate of ${pc(y)}. Immediately after the ${ord(t)} coupon, similar bonds yield ${pc(y2)}.\n\nDetermine which of the following statements are true.`;
    const flipII = rng.int(0, 1) === 1;
    const flipIII = rng.int(0, 1) === 1;
    const statements: StatementSpec[] =
      variant === 0
        ? [
            { key: "I", text: `Immediately after the ${ord(t)} coupon, the investor's book value exceeds the market value of the bond.`, truth: y2 > y, justification: `Book value is the PV of the remaining payments at ${pc(y)}, market value at ${pc(y2)}; the higher rate gives the lower value.`, misconception: "CONC_PRICE_YIELD_DIRECTION", check: { expr: BV, op: ">", than: MV }, stage: 1, failure: "application", conditionTrue: y2 > y ? "It would be false if yields had fallen." : "It would be true if yields had risen." },
            flipII
              ? { key: "II", text: `The book value immediately after the ${ord(t)} coupon depends on the ${pc(y2)} yield now available.`, truth: false, justification: "Book value is computed at the purchase yield; later market yields do not change it.", misconception: "CONC_BOOK_MARKET_CONFUSION", stage: 0, failure: "interpretation", confusedWith: "bond.book-vs-market" }
              : { key: "II", text: `The book value immediately after the ${ord(t)} coupon would be the same if market yields had not changed.`, truth: true, justification: "Book value is computed at the purchase yield; later market yields do not change it.", misconception: "CONC_BOOK_MARKET_CONFUSION", stage: 0, failure: "interpretation", confusedWith: "bond.book-vs-market" },
            { key: "III", text: `The book value immediately after the ${ord(t)} coupon lies between the price paid and the redemption value.`, truth: true, justification: `Book value moves monotonically from the price ${amt2(round2(P))} to the redemption value ${amt2(C)}.`, misconception: "CONC_DIRECTION_REVERSED", check: { expr: `(${BV} - ${lit(P)})*(${BV} - ${lit(C)})`, op: "<", than: 0 }, stage: 2, failure: "connection" },
          ]
        : [
            { key: "I", text: `Immediately after the ${ord(t)} coupon, the market value of the bond exceeds its redemption value.`, truth: F * r > C * y2, justification: `At ${pc(y2)} the bond is at a premium exactly when $Fr > Cj$: $${mamt(F * r)}$ versus $${mnum(C * y2, 2)}$.`, misconception: level === 3 ? "CONC_BOND_COUPON_RATE_AS_MODIFIED" : "CONC_PRICE_YIELD_DIRECTION", check: { expr: MV, op: ">", than: lit(C) }, stage: 1, failure: "application", ...(level === 3 ? { confusedWith: "bond.modified-coupon" } : {}) },
            { key: "II", text: `The book value immediately after the ${ord(t)} coupon is less than the price paid.`, truth: F * r > C * y, justification: F * r > C * y ? "The bond was bought at a premium, which is written down coupon by coupon." : "The bond was bought at a discount, which is accumulated coupon by coupon, so book value rises.", misconception: "CONC_DIRECTION_REVERSED", check: { expr: BV, op: "<", than: lit(P) }, stage: 2, failure: "connection" },
            flipIII
              ? { key: "III", text: `The book value immediately after the ${ord(t)} coupon equals the price accumulated at ${pc(y)} for ${t} years less the ${t} coupons received.`, truth: false, justification: "The coupons must be accumulated at the yield too: $P(1+j)^t - Fr\\,s_{\\overline{t|}}$.", misconception: "CONC_BOND_COUPONS_NOT_REINVESTED", check: { expr: `(${lit(P)}*(1+${lit(j)})**${t} - ${lit(t * cpn)})`, op: "=", than: BV }, stage: 0, failure: "application" }
              : { key: "III", text: `The book value immediately after the ${ord(t)} coupon equals the price accumulated at ${pc(y)} for ${t} years less the coupons accumulated at ${pc(y)}.`, truth: true, justification: "Retrospective and prospective book values agree: $P(1+j)^t - Fr\\,s_{\\overline{t|}} = Fr\\,a_{\\overline{n-t|}} + Cv^{n-t}$.", misconception: "CONC_BOND_COUPONS_NOT_REINVESTED", check: { expr: retroTrue, op: "=", than: BV }, stage: 0, failure: "application" },
          ];
    const extraId: MisconceptionId = variant === 0 ? "CONC_RELATED_TERM" : "CONC_BOOK_MARKET_CONFUSION";
    return statementQuestion({
      stem,
      statements,
      extra: multiFlipExtras(statements, extraId, 2),
      steps: [
        { concept: "bond.book-value", reasoning: "Book value immediately after coupon $t$ is the PV of the remaining payments at the purchase yield; it equals the retrospective form." },
        { concept: "bond.book-vs-market", reasoning: "Market value uses the current yield; a higher yield gives a lower value." },
        { concept: "bond.premium-discount", reasoning: `The bond was bought at a ${F * r > C * y ? "premium" : "discount"} (compare $Fr$ with $Cj$), so book value ${F * r > C * y ? "falls" : "rises"} toward $C$.` },
        ...(level === 3 ? [{ concept: "bond.modified-coupon", reasoning: "With $C \\ne F$, premium or discount at any yield is decided by $Fr$ versus $Cj$, not by $r$ versus $j$." }] : []),
      ],
      conditions: ["Values immediately after a coupon.", "Annual effective yields."],
      relationship: "$BV_t = Fr\\,a_{\\overline{n-t|}\\,j} + Cv_j^{n-t} = P(1+j)^t - Fr\\,s_{\\overline{t|}\\,j}$; market value uses the current yield.",
      counterexample: "If the market yield equals the purchase yield, book and market value coincide.",
      transfer: {
        principle: "Fix the yield behind each value first; then the comparisons follow from ‘higher yield, lower value’.",
        unusual: "Several values of one bond are compared at one date.",
        misread: "Book value never responds to market yields.",
      },
      presentation: levelTags(level, ["valuation-date"], ["valuation-date", "hidden-structure"]),
      features: { multipleValuationDates: true, unfamiliar: true, steps: level === 3 ? 4 : 3 },
      modelingDecisions: level === 3 ? 1 : undefined,
      params: { F, years, C, r, y, y2, t, variant },
    });
  },
});

// ================================================================ BONDS.coupons

const couponRates: ChoiceTemplate = conceptTemplate({
  id: "con-bond-coupon-rates",
  family: "con-bond-coupon",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.coupons",
  secondary: ["BONDS.price_redemption"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "conditions"],
  soaConcept: "Coupon rate, modified coupon rate and yield; the condition for a premium.",
  variants: 2,
  generate(rng, level, variant) {
    const F = 1000 * rng.int(1, 5);
    const r = gridRate(rng, 0.04, 0.09, 0.005);
    const C = F * (1 + 0.05 * rng.int(1, 4));
    const g = (F * r) / C;
    const steps = [
      { concept: "bond.face-redemption", reasoning: "The coupon is $Fr$: coupon rate times face." },
      { concept: "bond.modified-coupon", reasoning: "The modified coupon rate is $g = Fr/C$, the coupon per unit of redemption value." },
      { concept: "bond.premium-discount", reasoning: "$P - C = (Fr - Cj)a_{\\overline{n|}}$, so the bond is at a premium exactly when $g > j$." },
    ];
    const common = {
      steps,
      conditions: ["Level coupons based on face; one redemption payment.", "Premium and discount are measured against the redemption value."],
      relationship: "$g = \\dfrac{Fr}{C}$, and $P - C = (Fr - Cj)a_{\\overline{n|}} = C(g - j)a_{\\overline{n|}}$.",
      counterexample: "For a bond redeemable at par, $g = r$ and comparing $r$ with $j$ is enough.",
      transfer: {
        principle: "Compare the coupon with interest on the redemption value, $Fr$ against $Cj$.",
        unusual: "The redemption value differs from the face amount.",
        misread: "The coupon rate $r$ and the modified coupon rate $g$ coincide only when $C = F$.",
      },
      params: { F, r, C, variant },
    };
    if (variant === 0) {
      if (level === 1) {
        return conceptQuestion({
          ...common,
          stem: "A bond has face amount $F$, coupon rate $r$ per period, redemption value $C$ and price $P$. Determine which of the following is the bond's modified coupon rate.",
          correct: { content: "$Fr/C$, the coupon per unit of redemption value", why: "The modified coupon rate expresses the coupon relative to the amount redeemed: $g = Fr/C$." },
          distractors: [
            opt("$Fr/P$, the coupon per unit of the price", "FORMULA_CURRENT_YIELD", "Coupon over price is the current yield.", 1, "recognition", { confusedWith: "bond.yield-definition" }),
            opt("$Fr/F = r$, the coupon per unit of face", "CONC_BOND_COUPON_RATE_AS_MODIFIED", "That is the coupon rate itself.", 1, "recognition", { conditionTrue: "It equals $g$ when the bond is redeemable at par." }),
            opt("$Cr/F$, the coupon rate scaled by $C/F$", "ALG_INVERTED_RATIO", "The ratio is inverted: $g = r\\cdot F/C$.", 1, "application"),
            opt("$j$, the rate at which the price equals the PV", "CONC_RELATED_TERM", "That is the yield rate.", 1, "recognition", { confusedWith: "bond.yield-definition" }),
            opt("$(1 + r)^2 - 1$, the coupon rate made effective", "RATE_NOMINAL_AS_EFFECTIVE", "Converting a rate's basis does not change what it is measured against.", 1, "interpretation"),
          ],
          itemFormat: "definition",
          presentation: ["direct"],
        });
      }
      const half = (F * r) / 2;
      const P = round2(bondPrice(half, 1, C, gridRate(rng, 0.015, 0.045, 0.0025), rng.int(16, 30)));
      return conceptQuestion({
        ...common,
        stem: `A bond with face amount ${mamt(F)} pays semiannual coupons of ${mamt(half)} and is redeemable at ${mamt(C)}. Its price is ${mnum(P, 2)}.\n\nDetermine which of the following is the bond's modified coupon rate per half-year.`,
        correct: { content: `$${mamt(half)}/${mamt(C)} = ${mpc(half / C, 3)}$`, why: `The semiannual coupon over the redemption value: $g = ${mpc(half / C, 3)}$ per half-year.` },
        distractors: [
          opt(`$${mamt(half)}/${mnum(P, 2)} = ${mpc(half / P, 3)}$`, "FORMULA_CURRENT_YIELD", "Coupon over price is the current yield.", 1, "recognition"),
          opt(`$${mamt(half)}/${mamt(F)} = ${mpc(half / F, 3)}$`, "CONC_BOND_COUPON_RATE_AS_MODIFIED", "That is the coupon rate per half-year.", 1, "recognition", { conditionTrue: "It equals $g$ when the bond is redeemable at par." }),
          opt(`$${mamt(2 * half)}/${mamt(C)} = ${mpc((2 * half) / C, 3)}$`, "RATE_ANNUAL_FOR_PERIODIC", "That is the annual figure; per half-year use one coupon.", 1, "application"),
          opt(`$${mamt(half)}/${mamt(C - F)} = ${mpc(half / (C - F), 3)}$`, "VAR_TOTAL_FOR_COMPONENT", "The base is the whole redemption value, not the excess of $C$ over $F$.", 1, "interpretation"),
          opt(`$${mamt(C)}/${mamt(F)} \\times ${mpc(half / F, 3)} = ${mpc((C * half) / F / F, 3)}$`, "ALG_INVERTED_RATIO", "The scaling is $F/C$, not $C/F$.", 1, "application"),
        ],
        itemFormat: "definition",
        presentation: ["frequency"],
        features: { unfamiliar: true },
      });
    }
    if (level === 1) {
      return conceptQuestion({
        ...common,
        stem: "A bond has face amount $F$, coupon rate $r$, redemption value $C$, modified coupon rate $g$ and is bought to yield $j$ per coupon period. Determine which of the following is necessary and sufficient for the bond to be bought at a premium.",
        correct: { content: "$g > j$, where $g = Fr/C$", why: "$P - C = C(g - j)a_{\\overline{n|}}$ is positive exactly when $g > j$." },
        distractors: [
          opt("$r > j$, where $r$ is the coupon rate", "CONC_BOND_COUPON_RATE_AS_MODIFIED", "With $C \\ne F$ the coupon is compared with interest on $C$, not on $F$.", 2, "selection", { conditionTrue: "Necessary and sufficient when the bond is redeemable at par.", confusedWith: "bond.modified-coupon" }),
          opt("$j > g$, where $g = Fr/C$", "CONC_DIRECTION_REVERSED", "A yield above $g$ makes $Fr - Cj < 0$: a discount.", 2, "conclusion"),
          opt("$C > F$, a redemption value above face", "CONC_RELATED_TERM", "Redemption at a premium to face says nothing about the purchase price relative to $C$.", 0, "recognition"),
          opt("$g > r$, where $g = Fr/C$", "ALG_INVERTED_RATIO", "$g > r$ just means $C < F$; it does not involve the yield.", 1, "application"),
        ],
        itemFormat: "enumerated-conditions",
        presentation: ["direct"],
      });
    }
    return conceptQuestion({
      ...common,
      stem: `A bond with face amount ${mamt(F)} pays annual coupons at a rate of ${pc(r)} and is redeemable at ${mamt(C)}.\n\nDetermine the set of annual effective yield rates $j$ at which the bond is bought at a premium.`,
      correct: { content: `$j < ${mpc(g, 3)}$`, why: `Premium exactly when $Fr > Cj$: $j < ${mamt(F * r)}/${mamt(C)} = ${mpc(g, 3)}$.` },
      distractors: [
        opt(`$j < ${mpc(r, 3)}$`, "CONC_BOND_COUPON_RATE_AS_MODIFIED", "That compares the yield with the coupon rate; the base is the redemption value.", 2, "selection", { conditionTrue: "Correct for a bond redeemable at par.", confusedWith: "bond.modified-coupon" }),
        opt(`$j > ${mpc(g, 3)}$`, "CONC_DIRECTION_REVERSED", "Higher yields give lower prices; yields above $g$ give a discount.", 2, "conclusion"),
        opt(`$j < ${mpc((C * r) / F, 3)}$`, "ALG_INVERTED_RATIO", "The threshold is $rF/C$, not $rC/F$.", 1, "application"),
        opt(`$j > ${mpc(r, 3)}$`, "CONC_PRICE_YIELD_DIRECTION", "Prices fall as yields rise; a premium needs a low yield.", 2, "conclusion"),
      ],
      itemFormat: "enumerated-conditions",
      presentation: ["inverse"],
      features: { unfamiliar: true },
    });
  },
});

const premiumClassify: ChoiceTemplate = conceptTemplate({
  id: "con-bond-premium-classify",
  family: "con-bond-coupon",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.coupons",
  secondary: ["BONDS.price_redemption", "BONDS.terms"],
  itemFormat: "classification",
  conceptFamily: "relationship",
  dimensions: ["relationships", "rate_conversion", "conditions"],
  reasoning: ["concept_recognition", "financial_intuition", "translation"],
  soaConcept: "Classifying bonds as bought at a premium or a discount from coupon, redemption and yield terms.",
  variants: 2,
  generate(rng, level, variant) {
    const premium = variant === 0;
    const y0 = gridRate(rng, 0.04, 0.08, 0.01);
    const d = gridRate(rng, 0.005, 0.015, 0.005);
    const gapHalf = Math.floor(((y0 * y0) / 8) * 10000) / 10000;
    type BondRow = { F: number; m: number; r: number; C: number; yEff: number; yDesc: string; years: number; role: "correct" | MisconceptionId; why: string; stage: number; failure: ConceptFailure; conditionTrue?: string };
    const yrs = () => (level === 3 ? rng.int(5, 25) : 10);
    const scale = () => (level === 3 ? 500 * rng.int(1, 4) : 1000);
    const eff = (y: number) => ({ yEff: y, yDesc: `${pc(y)} annual effective` });
    const mk = (r: number, Cmult: number, m = 1, yy = eff(y0)): Pick<BondRow, "F" | "m" | "r" | "C" | "yEff" | "yDesc" | "years"> => {
      const F = scale();
      return { F, m, r, C: F * Cmult, ...yy, years: yrs() };
    };
    const word = premium ? "premium" : "discount";
    const other = premium ? "discount" : "premium";
    const rows: BondRow[] = [];
    if (level === 1) rows.push({ ...mk(premium ? y0 + d : y0 - d, 1), role: "correct", why: `Redeemable at par with a coupon rate ${premium ? "above" : "below"} the yield: a ${word}.`, stage: 2, failure: "conclusion" });
    else rows.push({ ...mk(premium ? y0 - 0.005 : y0 + 0.005, premium ? 0.85 : 1.2), role: "correct", why: `Although the coupon rate is ${premium ? "below" : "above"} the yield, $Fr$ ${premium ? "exceeds" : "falls short of"} $Cj$ because $C$ is ${premium ? "below" : "above"} face: a ${word}.`, stage: 1, failure: "selection" });
    rows.push({ ...mk(premium ? y0 + 0.005 : y0 - 0.005, premium ? 1.2 : 0.85), role: "CONC_BOND_COUPON_RATE_AS_MODIFIED", why: `Its coupon rate is ${premium ? "above" : "below"} the yield, but against the redemption value $Fr ${premium ? "<" : ">"} Cj$: a ${other}.`, stage: 1, failure: "selection", conditionTrue: "The coupon-rate comparison works only for bonds redeemable at par." });
    if (level >= 2) {
      if (premium) {
        const r = y0 + gapHalf;
        rows.push({ ...mk(r, 1, 1, { yEff: Math.pow(1 + y0 / 2, 2) - 1, yDesc: `${pc(y0)} convertible semiannually` }), role: "RATE_NOMINAL_AS_EFFECTIVE", why: `${pc(y0)} convertible semiannually is ${pc(Math.pow(1 + y0 / 2, 2) - 1, 4)} effective, above the annual coupon rate ${pc(r)}: a discount.`, stage: 0, failure: "interpretation" });
      } else {
        const ye = y0 + gapHalf;
        rows.push({ ...mk(y0, 1, 2, eff(ye)), role: "RATE_NOMINAL_AS_EFFECTIVE", why: `Semiannual coupons at ${pc(y0)} are ${pc(y0 / 2)} per half-year, while ${pc(ye)} effective is only ${pc(Math.pow(1 + ye, 0.5) - 1, 4)} per half-year: a premium.`, stage: 0, failure: "interpretation" });
      }
    }
    rows.push({ ...mk(y0, premium ? 1.1 : 0.9), role: "CONC_RELATED_TERM", why: `Coupon rate equals the yield but $C$ is ${premium ? "above" : "below"} face, so $Fr ${premium ? "<" : ">"} Cj$: a ${other}. Redemption ${premium ? "above" : "below"} face is not the same as buying at a ${word}.`, stage: 0, failure: "recognition" });
    rows.push({ ...mk(premium ? y0 - d : y0 + d, 1), role: "CONC_DIRECTION_REVERSED", why: `Redeemable at par with a coupon rate ${premium ? "below" : "above"} the yield: a ${other}.`, stage: 2, failure: "conclusion" });
    rows.push({ ...mk(y0, 1), role: "CONC_PAR_ASSUMPTION", why: "Redeemable at par with coupon rate equal to the yield: it sells at par, neither premium nor discount.", stage: 2, failure: "conclusion" });
    const used = rows.slice(0, 5);
    const letters = rng.shuffle(["A", "B", "C", "D", "E"]);
    const priceOf = (b: BondRow) => {
      const N = b.years * b.m;
      const jp = Math.pow(1 + b.yEff, 1 / b.m) - 1;
      return priceE((b.F * b.r) / b.m, b.C, jp, N);
    };
    const claim = (b: BondRow) => ({ expr: premium ? `(${priceOf(b)} - ${lit(b.C)})` : `(${lit(b.C)} - ${priceOf(b)})`, op: ">" as const, than: 0 });
    const columns = level === 3 ? ["Bond", "Face amount", "Coupons", "Redemption value", "Term (years)", "Yield"] : ["Bond", "Face amount", "Coupons", "Redemption value", "Yield"];
    const tableRows = used
      .map((b, k) => ({ b, letter: letters[k] }))
      .sort((p, q) => p.letter.localeCompare(q.letter))
      .map(({ b, letter }) => {
        const cells = [letter, amt2(b.F), `${pc(b.r)} ${b.m === 2 ? "payable semiannually" : "payable annually"}`, amt2(b.C)];
        if (level === 3) cells.push(String(b.years));
        cells.push(b.yDesc);
        return cells;
      });
    const correctRow = used[0];
    const correctLetter = letters[0];
    return conceptQuestion({
      stem: `${level === 3 ? "Each bond below is bought to provide the yield shown." : "Each bond below is bought to provide the yield shown, and each matures in 10 years."}\n\nDetermine which bond is bought at a ${word}.`,
      exhibits: [{ type: "table", columns, rows: tableRows }],
      correct: { content: `Bond ${correctLetter}`, why: correctRow.why, check: claim(correctRow) },
      distractors: used.slice(1).map((b, k) =>
        opt(`Bond ${letters[k + 1]}`, b.role as MisconceptionId, b.why, Math.min(b.stage, level >= 2 ? 2 : 1), b.failure, { check: claim(b), ...(b.conditionTrue ? { conditionTrue: b.conditionTrue } : {}) })
      ),
      reference: { description: "Each bond is priced from its explicit coupons and redemption payment at its yield and compared with its redemption value." },
      steps: [
        ...(level >= 2 ? [{ concept: "bond.terms", reasoning: "Put coupons and yields on one basis: a rate ‘convertible semiannually’ is nominal, and coupons ‘payable semiannually’ are half the annual rate." }] : []),
        { concept: "bond.modified-coupon", reasoning: "Compare each coupon with interest on the redemption value, $Fr$ against $Cj$ (equivalently $g$ against $j$)." },
        { concept: "bond.premium-discount", reasoning: `$P - C = (Fr - Cj)a_{\\overline{n|}}$: the sign does not depend on the term${level === 3 ? " or the face amount" : ""}.` },
      ],
      conditions: ["Premium and discount are measured against the redemption value.", "Coupons and yields compared per coupon period on one rate basis."],
      relationship: "$P - C = (Fr - Cj)\\,a_{\\overline{n|}\\,j}$: premium if $Fr > Cj$, discount if $Fr < Cj$.",
      counterexample: "A bond redeemable at par with coupon rate equal to its yield sells at par.",
      transfer: {
        principle: "Reduce every bond to one comparison per coupon period: coupon versus yield times redemption value.",
        unusual: "Several bonds with mixed rate bases are compared at once.",
        misread: "A coupon rate above the yield does not guarantee a premium when $C \\ne F$.",
      },
      itemFormat: "classification",
      presentation: levelTags(level, ["compare-streams", "frequency"], ["compare-streams", "hidden-structure", "irrelevant-info"]),
      features: { unfamiliar: level >= 2, steps: level >= 2 ? 3 : 2 },
      modelingDecisions: level === 3 ? 2 : undefined,
      params: { y0, d, premium, variant },
    });
  },
});

const couponDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-bond-coupon-diagnosis",
  family: "con-bond-coupon",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.coupons",
  secondary: ["BONDS.terms", "BONDS.price_redemption"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "rate_conversion"],
  reasoning: ["validation", "concept_recognition", "translation"],
  soaConcept: "Diagnosing a coupon error (annual coupon used per half-year, or the coupon rate used for Makeham's g).",
  variants: 2,
  generate(rng, level, variant) {
    const F = 1000 * rng.int(1, 5);
    const years = rng.int(6, 15);
    const r = gridRate(rng, 0.04, 0.09, 0.005);
    const y = yieldAway(rng, 0.03, 0.09, r);
    let stem: string;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    let steps;
    let C: number;
    if (variant === 0) {
      C = level === 1 ? F : F * (1 + 0.05 * rng.int(1, 3));
      const N = 2 * years;
      const j = level === 1 ? y / 2 : Math.pow(1 + y, 0.5) - 1;
      const truth = priceTerms((F * r) / 2, C, j, N);
      const proposed = bondPrice(F * r, 1, C, j, N);
      const jName = level === 1 ? dj(j) : "j";
      const yText = level === 1 ? `an annual nominal rate of ${pc(y)} convertible semiannually` : `an annual effective rate of ${pc(y)}`;
      stem =
        `A ${years}-year bond with face amount ${mamt(F)} pays coupons semiannually at an annual rate of ${pc(r)} and is ${C === F ? "redeemable at par" : `redeemable at ${mamt(C)}`}. It is bought to yield ${yText}. A candidate calculates the price as\n\n` +
        `$$${mamt(F * r)}\\,${aS(N, jName)} + ${mamt(C)}\\,v^{${N}} = ${mnum(proposed, 2)}${level === 2 ? `, \\quad j = (${dj(1 + y)})^{1/2} - 1` : ""}.$$\n\nWhich of the following correctly describes the candidate's calculation?`;
      const altJ = level === 1 ? Math.pow(1 + y, 0.5) - 1 : y / 2;
      correct = { content: `Each coupon should be ${amt2((F * r) / 2)}, half the annual coupon; the rest is correct.`, why: `An annual coupon rate payable semiannually pays $${mamt((F * r) / 2)}$ each half-year: $P = ${mnum(bondPrice((F * r) / 2, 1, C, j, N), 2)}$.`, check: { expr: priceE((F * r) / 2, C, j, N), op: "=", than: truth } };
      distractors = [
        opt("The calculation is correct: the coupon rate applies to each coupon period.", "RATE_ANNUAL_FOR_PERIODIC", "A coupon rate is quoted per year; semiannual coupons are half of it.", 0, "interpretation", { check: { expr: priceE(F * r, C, j, N), op: "=", than: truth }, confusedWith: "bond.terms" }),
        opt(`There should be ${years} periods, one per year, with the coupon of ${amt2(F * r)} kept.`, "SEQ_TERM_COUNT", "Mixing annual periods with a half-year rate values the wrong cash flows.", 1, "application", { check: { expr: priceE(F * r, C, j, years), op: "=", than: truth } }),
        opt(level === 1 ? `The rate per half-year should be $(1 + ${dj(y)})^{1/2} - 1$; the rest is correct.` : `The rate per half-year should be $${dj(y)}/2$; the rest is correct.`, level === 1 ? "RATE_NOMINAL_AS_EFFECTIVE" : "RATE_DIVIDED_EFFECTIVE", level === 1 ? "A nominal rate convertible semiannually is simply halved." : "An annual effective rate converts by a square root, not by halving.", 1, "application", { check: { expr: priceE(F * r, C, altJ, N), op: "=", than: truth } }),
        opt("The coupons should be discounted at the coupon rate per half-year instead.", "CONC_BOND_YIELD_IS_COUPON_RATE", "Discounting is at the yield; the coupon rate only sizes coupons.", 1, "selection", { check: { expr: `(${lit(F * r)}*${aExpr(N, r / 2)} + ${lit(C)}*${vPow(j, N)})`, op: "=", than: truth } }),
        ...(C !== F ? [opt(`Each coupon should be ${amt2((C * r) / 2)}, based on the redemption value.`, "CONC_BOND_COUPON_ON_REDEMPTION", "Coupons are based on face, not on the redemption value.", 0, "interpretation", { check: { expr: priceE((C * r) / 2, C, j, N), op: "=", than: truth } })] : []),
      ];
      steps = [
        { concept: "bond.terms", reasoning: "‘Coupons semiannually at an annual rate of $r$’ means $Fr/2$ every half-year." },
        { concept: "bond.face-redemption", reasoning: "Coupons are based on the face amount; the redemption value enters only at maturity." },
        { concept: "bond.price-yield", reasoning: `Price $= (Fr/2)\\,a_{\\overline{${N}|}\\,j} + Cv^{${N}}$ at the half-year yield ${level === 1 ? `$${dj(j)}$` : "$j = (1+i)^{1/2} - 1$"}.` },
      ];
    } else {
      C = F * (1 + 0.05 * rng.int(1, 4));
      const semi = level === 2;
      const m = semi ? 2 : 1;
      const N = years * m;
      const j = y / m;
      const rp = r / m;
      const cpn = F * rp;
      const truth = priceTerms(cpn, C, j, N);
      const K = C * Math.pow(1 + j, -N);
      const proposed = K + (rp / j) * (C - K);
      const mk = (Kb: number, ratio: string) => `(${lit(Kb)}*${vPow(j, N)} + ${ratio}*(${lit(C)} - ${lit(Kb)}*${vPow(j, N)}))`;
      stem =
        `A ${years}-year bond with face amount ${mamt(F)} pays ${semi ? `semiannual coupons at an annual rate of ${pc(r)}` : `annual coupons at a rate of ${pc(r)}`} and is redeemable at ${mamt(C)}. It is bought to yield ${semi ? `an annual nominal rate of ${pc(y)} convertible semiannually` : `an annual effective rate of ${pc(y)}`}. A candidate uses Makeham's formula:\n\n` +
        `$$K = ${mamt(C)}${vS(j, N)}, \\qquad P = K + \\frac{${dj(rp)}}{${dj(j)}}(${mamt(C)} - K) = ${mnum(proposed, 2)}.$$\n\nWhich of the following correctly describes the candidate's calculation?`;
      correct = { content: `$g$ should be the modified coupon rate ${mamt(cpn)}/${mamt(C)}, not ${dj(rp)}.`.replace(`${mamt(cpn)}/${mamt(C)}`, `$${mamt(cpn)}/${mamt(C)}$`), why: `Makeham's $g$ is $Fr/C$; with it $P = ${mnum(K + (cpn / C / j) * (C - K), 2)}$.`, check: { expr: mk(C, `(${lit(cpn)}/${lit(C)})/${lit(j)}`), op: "=", than: truth } };
      distractors = [
        opt("The calculation is correct: $g$ in Makeham's formula is the coupon rate.", "CONC_BOND_COUPON_RATE_AS_MODIFIED", "$g = Fr/C$ equals $r$ only when $C = F$.", 1, "selection", { check: { expr: mk(C, `${lit(rp)}/${lit(j)}`), op: "=", than: truth }, conditionTrue: "Correct for a bond redeemable at par.", confusedWith: "bond.modified-coupon" }),
        opt(`$K$ should be the present value of ${amt2(F)}; the rest is correct.`, "CONC_BOND_REDEMPTION_AS_FACE", "$K$ is the PV of the redemption value $C$.", 0, "interpretation", { check: { expr: mk(F, `${lit(rp)}/${lit(j)}`), op: "=", than: truth } }),
        opt("The ratio should be inverted to $j/g$; the rest is correct.", "ALG_INVERTED_RATIO", "Makeham's factor is $g/j$.", 1, "application", { check: { expr: mk(C, `${lit(j)}/${lit(rp)}`), op: "=", than: truth } }),
        opt("$g$ should equal the yield, so the price is the redemption value.", "CONC_PAR_ASSUMPTION", "Setting $g = j$ assumes the bond sells at par to $C$, which happens only when $Fr = Cj$.", 1, "selection", { check: { expr: lit(C), op: "=", than: truth } }),
        ...(semi ? [opt(`$g$ should be the annual rate ${dj(r)}; the rest is correct.`, "RATE_ANNUAL_FOR_PERIODIC", "Every rate in the formula is per coupon period.", 1, "application", { check: { expr: mk(C, `${lit(r)}/${lit(j)}`), op: "=", than: truth } })] : []),
      ];
      steps = [
        { concept: "bond.face-redemption", reasoning: `The coupon is $${mamt(cpn)}$ per ${semi ? "half-year" : "year"}, based on face; the redemption value is $${mamt(C)}$.` },
        { concept: "bond.modified-coupon", reasoning: `Makeham's $g = Fr/C = ${mamt(cpn)}/${mamt(C)}$, which differs from $r$ because $C \\ne F$.` },
        { concept: "bond.price-forms", reasoning: "$P = K + \\tfrac{g}{j}(C - K)$ with $K = Cv^n$." },
      ];
    }
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { description: "The price written term by term at the yield; each proposed correction is evaluated and compared with it." },
      steps,
      conditions: ["Coupons are based on face and paid at the end of each coupon period.", "All rates in a price formula are per coupon period."],
      relationship: "$P = Fr\\,a_{\\overline{n|}} + Cv^n = K + \\tfrac{g}{j}(C - K), \\quad g = Fr/C$",
      counterexample: variant === 0 ? "With annual coupons the candidate's coupon would be right." : "For a bond redeemable at par, $g = r$ and the candidate's formula is right.",
      transfer: {
        principle: "Convert every coupon and rate to the coupon period, and keep $F$ (coupons) and $C$ (redemption) apart.",
        unusual: "A worked solution is judged rather than produced.",
        misread: "A quoted coupon rate is annual even when coupons are semiannual.",
      },
      itemFormat: "error-diagnosis",
      presentation: level === 2 ? ["frequency", "indirect-wording"] : ["direct"],
      features: { unfamiliar: level === 2 },
      params: { F, years, r, y, C, variant },
    });
  },
});

// ================================================================ BONDS.yield

const yieldDefinition: ChoiceTemplate = conceptTemplate({
  id: "con-bond-yield-definition",
  family: "con-bond-yield",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.yield",
  secondary: ["BONDS.coupons"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "interpretation"],
  soaConcept: "Yield rate versus current yield, coupon rate and modified coupon rate.",
  variants: 2,
  generate(rng, level, variant) {
    const steps = [
      { concept: "bond.yield-definition", reasoning: "The yield is the rate at which the PV of every coupon and the redemption payment equals the price." },
      { concept: "bond.price-yield", reasoning: "Price falls as the yield rises, so comparing the price with the PV at a trial rate places the yield above or below that rate." },
    ];
    const transfer = {
      principle: "A yield is an internal rate of return: it must account for the coupons and the gain or loss at redemption.",
      unusual: "Several ratios built from the same bond look like rates of return.",
      misread: "Coupon ÷ price looks like a return but ignores the redemption gain or loss.",
    };
    const conditions = ["Bond held to maturity; all payments made as scheduled.", "One rate discounts every payment."];
    const relationship = "Yield $j$ solves $P = Fr\\,a_{\\overline{n|}\\,j} + C\\,v_j^n$; current yield is $Fr/P$.";
    if (variant === 0) {
      const semi = level === 2;
      return conceptQuestion({
        stem: semi
          ? "A bond pays coupons semiannually and is bought at price $P$. Determine which of the following is its yield rate expressed as an annual nominal rate convertible semiannually."
          : "A bond is bought at price $P$ and held to maturity. Determine which of the following is its yield rate.",
        correct: semi
          ? { content: "Twice the half-year rate at which the PV of the coupons and redemption payment equals $P$", why: "The yield per half-year is the IRR of the half-yearly cash flows; the nominal annual rate convertible semiannually is twice it." }
          : { content: "The rate at which the present value of the coupons and the redemption payment equals $P$", why: "The yield is the investment's internal rate of return: price against every future payment." },
        distractors: semi
          ? [
              opt("The annual effective rate at which the PV of the coupons and redemption payment equals $P$", "RATE_NOMINAL_AS_EFFECTIVE", "That is the annual effective yield, $(1 + j)^2 - 1$, not the nominal rate $2j$.", 1, "interpretation", { confusedWith: "bond.terms" }),
              opt("Twice the half-yearly coupon divided by the price, for the coupon rate on the investment", "FORMULA_CURRENT_YIELD", "That is the current yield; it ignores the redemption gain or loss.", 0, "recognition"),
              opt("The annual coupon divided by the face amount, which fixes the size of every coupon", "CONC_BOND_YIELD_IS_COUPON_RATE", "That is the coupon rate.", 0, "recognition"),
              opt("Twice the half-year rate at which the PV of the coupons alone equals $P$", "CONC_IGNORED_REDEMPTION", "The redemption payment is part of the return.", 0, "application"),
              opt("The half-year rate at which the PV of the coupons and redemption payment equals $P$", "RATE_ANNUAL_FOR_PERIODIC", "That is the rate per half-year; the annual nominal rate is twice it.", 1, "interpretation"),
            ]
          : [
              opt("The coupon divided by the price, the return earned on the amount invested", "FORMULA_CURRENT_YIELD", "That is the current yield; it ignores the redemption gain or loss.", 0, "recognition", { conditionTrue: "It equals the yield when the price equals the redemption value." }),
              opt("The coupon divided by the face amount, which fixes the size of every coupon", "CONC_BOND_YIELD_IS_COUPON_RATE", "That is the coupon rate.", 0, "recognition"),
              opt("The coupon divided by the redemption value, the coupon per unit redeemed", "CONC_BOND_COUPON_RATE_AS_MODIFIED", "That is the modified coupon rate $g$.", 0, "recognition", { confusedWith: "bond.modified-coupon" }),
              opt("The rate at which the present value of the coupons alone equals $P$", "CONC_IGNORED_REDEMPTION", "The redemption payment is part of the return.", 0, "application"),
            ],
        steps,
        conditions,
        relationship,
        transfer,
        itemFormat: "definition",
        presentation: semi ? ["frequency"] : ["direct"],
        features: { unfamiliar: semi },
        params: { variant },
      });
    }
    // Variant 1: the rate coupon/price, interpreted.
    const F = 1000 * rng.int(1, 5);
    const n = rng.int(8, 20);
    const r = gridRate(rng, 0.04, 0.09, 0.005);
    const C = level === 1 ? F : F * (1 + 0.05 * rng.int(2, 4)) * (rng.int(0, 1) ? 1 : 0.85);
    const j = drawUntil(
      () => gridRate(rng, 0.02, 0.1, 0.0025),
      (x) => {
        const p = bondPrice(F * r, 1, C, x, n);
        return Math.abs(p - C) > 0.02 * C && Math.abs(x - r) > 0.003 && (level === 1 || (p - F) * (p - C) < 0);
      }
    );
    const P = round2(bondPrice(F * r, 1, C, j, n));
    const cy = (F * r) / P;
    const premium = P > C;
    const pvCy = priceE(F * r, C, cy, n);
    const lower = { expr: `(${pvCy} - ${lit(P)})`, op: "<" as const, than: 0 };
    const higher = { expr: `(${pvCy} - ${lit(P)})`, op: ">" as const, than: 0 };
    const cyText = mpc(cy, 3);
    return conceptQuestion({
      stem: `A ${n}-year bond with face amount ${mamt(F)} pays annual coupons of ${mamt(F * r)} and is ${C === F ? "redeemable at par" : `redeemable at ${mamt(C)}`}. Its price is ${mnum(P, 2)}. An analyst quotes the rate $${mamt(F * r)}/${mnum(P, 2)} = ${cyText}$.\n\nWhich of the following correctly describes this rate?`,
      correct: premium
        ? { content: "It is the current yield; the yield rate is lower, since the price exceeds the amount redeemed.", why: "Coupon ÷ price ignores the loss at redemption; the yield must make the PV equal the price, so it is lower.", check: lower }
        : { content: "It is the current yield; the yield rate is higher, since the amount redeemed exceeds the price.", why: "Coupon ÷ price ignores the gain at redemption; the yield must make the PV equal the price, so it is higher.", check: higher },
      distractors: [
        opt("It is the yield rate, since it relates each coupon to the amount invested.", "FORMULA_CURRENT_YIELD", "It ignores the redemption gain or loss.", 0, "recognition", { check: { expr: pvCy, op: "=", than: lit(P) }, conditionTrue: "True only for a bond priced at its redemption value." }),
        premium
          ? opt("It is the current yield; the yield rate is higher, since the coupons exceed the interest earned.", "CONC_DIRECTION_REVERSED", "A price above the redemption value means a loss at maturity, which lowers the yield.", 1, "conclusion", { check: higher })
          : opt("It is the current yield; the yield rate is lower, since the coupons fall short of the interest earned.", "CONC_DIRECTION_REVERSED", "A price below the redemption value means a gain at maturity, which raises the yield.", 1, "conclusion", { check: lower }),
        ...(level === 2
          ? [
              P > F
                ? opt("It is the current yield; the yield rate is lower, since the price exceeds the face amount.", "CONC_BOND_REDEMPTION_AS_FACE", `The gain or loss is measured against the redemption value ${amt2(C)}, not the face amount.`, 0, "interpretation", { check: lower })
                : opt("It is the current yield; the yield rate is higher, since the face amount exceeds the price.", "CONC_BOND_REDEMPTION_AS_FACE", `The gain or loss is measured against the redemption value ${amt2(C)}, not the face amount.`, 0, "interpretation", { check: higher }),
            ]
          : []),
        opt("It is the modified coupon rate, the coupon per unit of redemption value.", "CONC_BOND_COUPON_RATE_AS_MODIFIED", "The modified coupon rate divides by $C$, not by the price.", 0, "recognition", { check: { expr: `${lit(F * r)}/${lit(C)}`, op: "=", than: lit(cy) } }),
        opt("It is the current yield, which equals the yield rate for any bond held to maturity.", "CONC_PAR_ASSUMPTION", "The two agree only when the price equals the redemption value.", 1, "conclusion", { check: { expr: pvCy, op: "=", than: lit(P) } }),
      ],
      reference: { description: "The bond's PV at the quoted rate is compared with its price: a PV below the price means the yield is lower than the rate, above means higher." },
      steps: [...steps, ...(level === 2 ? [{ concept: "bond.face-redemption", reasoning: `The gain or loss at maturity is $C - P$ with $C = ${mamt(C)}$, not $F - P$.` }] : [])],
      conditions,
      relationship,
      counterexample: "When the price equals the redemption value, current yield, modified coupon rate and yield all coincide.",
      transfer,
      itemFormat: "interpretation",
      presentation: level === 2 ? ["hidden-structure"] : ["direct"],
      features: { unfamiliar: level === 2 },
      params: { F, n, r, C, j, variant },
    });
  },
});

const yieldEquation: ChoiceTemplate = conceptTemplate({
  id: "con-bond-yield-equation",
  family: "con-bond-yield",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.yield",
  secondary: ["BONDS.price_redemption", "BONDS.terms"],
  itemFormat: "equation-selection",
  conceptFamily: "equation",
  dimensions: ["equation_construction", "rate_conversion"],
  reasoning: ["translation", "formula_selection"],
  soaConcept: "Choosing the equation of value that defines a bond's yield rate.",
  variants: 2,
  generate(rng, level, variant) {
    const F = 1000 * rng.int(1, 5);
    const years = rng.int(6, 15);
    const semi = level >= 2;
    const m = semi ? 2 : 1;
    const N = years * m;
    const r = gridRate(rng, 0.04, 0.09, 0.005);
    const C = F * (1 + 0.05 * rng.int(1, 3));
    const y = yieldAway(rng, 0.03, 0.09, r);
    const jTrue = level === 3 ? Math.pow(1 + y, 0.5) - 1 : y / m;
    const cpn = (F * r) / m;
    const P = round2(bondPrice(cpn, 1, C, jTrue, N));
    // The unknown x is j per period (levels 1–2) or the annual effective i (level 3).
    const J = level === 3 ? "((1+x)**0.5-1)" : "x";
    const a = (k: number, jj: string) => `((1-(1+${jj})**(-${k}))/${jj})`;
    const s = (k: number, jj: string) => `(((1+${jj})**${k}-1)/${jj})`;
    const v = (k: number, jj: string) => `(1+${jj})**(-${k})`;
    const basic = (c: number, red: number | null, k = N, jj = J, factor = a) => `(${lit(c)}*${factor(k, jj)}${red === null ? "" : ` + ${lit(red)}*${v(k, jj)}`} - ${lit(P)})`;
    const pdE = (c: number, base: number, k = N, jj = J, sign = 1, factor = a) => `(${lit(base)} + ${sign}*(${lit(c)} - ${lit(base)}*${jj})*${factor(k, jj)} - ${lit(P)})`;
    const where = level === 3 ? ", \\quad 1 + i = (1+j)^2" : "";
    const Pm = mnum(P, 2);
    const unknown = level === 3 ? "the annual effective yield rate $i$" : semi ? "the yield rate per half-year, $j$" : "the annual effective yield rate, $j$";
    const couponText = semi ? `semiannual coupons at an annual rate of ${pc(r)}` : `annual coupons at a rate of ${pc(r)}`;
    const stem =
      variant === 0
        ? `A ${years}-year bond with face amount ${mamt(F)} pays ${couponText} and is redeemable at ${mamt(C)}. Its price is ${Pm}.\n\nDetermine which of the following equations is satisfied by ${unknown}.`
        : `An investor pays ${Pm} for a bond with face amount ${mamt(F)}, ${couponText}, redeemable at ${mamt(C)} at the end of ${years} years.\n\nDetermine which of the following equations is satisfied by ${unknown}.`;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    const levelSpecific: ConceptOption[] = [
      ...(level === 2 ? [opt(math(variant === 0 ? `${Pm} = ${mamt(F * r)}\\,${aS(N, "j")} + ${mamt(C)}\\,v^{${N}}` : `${Pm} - ${mamt(C)} = \\bigl(${mamt(F * r)} - ${mamt(C)}\\,j\\bigr)${aS(N, "j")}`), "RATE_ANNUAL_FOR_PERIODIC", "Each semiannual coupon is half the annual coupon.", 0, "application", { probe: variant === 0 ? basic(F * r, C) : pdE(F * r, C), confusedWith: "bond.terms" })] : []),
      ...(level === 3
        ? [
            opt(math(variant === 0 ? `${Pm} = ${mamt(cpn)}\\,${aS(N, "j")} + ${mamt(C)}\\,v^{${N}}, \\quad i = 2j` : `${Pm} - ${mamt(C)} = \\bigl(${mamt(cpn)} - ${mamt(C)}\\,j\\bigr)${aS(N, "j")}, \\quad i = 2j`), "RATE_DIVIDED_EFFECTIVE", "$2j$ is the nominal rate convertible semiannually, not the annual effective rate.", 1, "application", { probe: variant === 0 ? basic(cpn, C, N, "(x/2)") : pdE(cpn, C, N, "(x/2)"), confusedWith: "bond.terms" }),
            opt(math(variant === 0 ? `${Pm} = ${mamt(cpn)}\\,${aS(N, "j")} + ${mamt(C)}\\,v^{${N}}, \\quad 1 + j = (1+i)^2` : `${Pm} - ${mamt(C)} = \\bigl(${mamt(cpn)} - ${mamt(C)}\\,j\\bigr)${aS(N, "j")}, \\quad 1 + j = (1+i)^2`), "ALG_ROOT_ERROR", "A half-year is shorter than a year: $1 + i = (1+j)^2$, not the reverse.", 1, "application", { probe: variant === 0 ? basic(cpn, C, N, "((1+x)**2-1)") : pdE(cpn, C, N, "((1+x)**2-1)") }),
          ]
        : []),
    ];
    if (variant === 0) {
      correct = { content: math(`${Pm} = ${mamt(cpn)}\\,${aS(N, "j")} + ${mamt(C)}\\,v^{${N}}${where}`), why: `The yield equates the price with the PV of every coupon and the redemption value; its root is ${level === 3 ? `$i = ${mpc(y)}$` : `$j = ${dj(jTrue)}$`}.`, probe: basic(cpn, C) };
      distractors = [
        ...levelSpecific,
        opt(math(`${Pm} = ${mamt(cpn)}\\,${aS(N, "j")} + ${mamt(F)}\\,v^{${N}}${where}`), "CONC_BOND_REDEMPTION_AS_FACE", `The bond is redeemed at ${amt2(C)}, not its face amount.`, 0, "interpretation", { probe: basic(cpn, F), confusedWith: "bond.face-redemption" }),
        opt(math(`j = \\frac{${mamt(cpn)}}{${Pm}}${where}`), "FORMULA_CURRENT_YIELD", "Coupon over price is the current yield; it ignores the redemption payment.", 0, "selection", { probe: `(${J} - ${lit(cpn)}/${lit(P)})`, confusedWith: "bond.yield-definition" }),
        opt(math(`${Pm} = ${mamt(cpn)}\\,${sS(N, "j")} + ${mamt(C)}\\,v^{${N}}${where}`), "FORMULA_AV_FOR_PV", "The coupons' value at time 0 uses $a_{\\overline{n|}}$.", 1, "selection", { probe: basic(cpn, C, N, J, s) }),
        opt(math(`${Pm} = ${mamt((C * r) / m)}\\,${aS(N, "j")} + ${mamt(C)}\\,v^{${N}}${where}`), "CONC_BOND_COUPON_ON_REDEMPTION", "Coupons are based on the face amount.", 0, "interpretation", { probe: basic((C * r) / m, C) }),
        opt(math(`${Pm} = ${mamt(cpn)}\\,${aS(N, "j")}${where}`), "CONC_IGNORED_REDEMPTION", "The redemption payment is part of the return.", 1, "application", { probe: basic(cpn, null) }),
      ];
    } else {
      correct = { content: math(`${Pm} - ${mamt(C)} = \\bigl(${mamt(cpn)} - ${mamt(C)}\\,j\\bigr)${aS(N, "j")}${where}`), why: `Premium/discount form: $P - C = (Fr - Cj)a_{\\overline{n|}\\,j}$; its root is ${level === 3 ? `$i = ${mpc(y)}$` : `$j = ${dj(jTrue)}$`}.`, probe: pdE(cpn, C) };
      distractors = [
        ...levelSpecific,
        opt(math(`${Pm} - ${mamt(F)} = \\bigl(${mamt(cpn)} - ${mamt(F)}\\,j\\bigr)${aS(N, "j")}${where}`), "CONC_BOND_REDEMPTION_AS_FACE", `The premium or discount is measured against the redemption value ${amt2(C)}.`, 0, "interpretation", { probe: pdE(cpn, F), confusedWith: "bond.face-redemption" }),
        opt(math(`${Pm} - ${mamt(C)} = \\bigl(${mamt(C)}\\,j - ${mamt(cpn)}\\bigr)${aS(N, "j")}${where}`), "ALG_SIGN_ERROR", "The premium is coupon minus interest on $C$, $Fr - Cj$.", 1, "application", { probe: pdE(cpn, C, N, J, -1) }),
        opt(math(`${Pm} - ${mamt(C)} = \\bigl(${mamt(cpn)} - ${mamt(C)}\\,j\\bigr)${sS(N, "j")}${where}`), "FORMULA_AV_FOR_PV", "The premium is a time-0 value; it uses $a_{\\overline{n|}}$.", 1, "selection", { probe: pdE(cpn, C, N, J, 1, s) }),
        opt(math(`${Pm} - ${mamt(C)} = \\bigl(${mamt((C * r) / m)} - ${mamt(C)}\\,j\\bigr)${aS(N, "j")}${where}`), "CONC_BOND_COUPON_ON_REDEMPTION", "Coupons are based on the face amount.", 0, "interpretation", { probe: pdE((C * r) / m, C) }),
        opt(math(`${Pm} - ${mamt(C)} = ${N}\\bigl(${mamt(cpn)} - ${mamt(C)}\\,j\\bigr)${where}`), "SEQ_UNDISCOUNTED_SUM", "The excess coupons arrive at different dates and must be discounted.", 1, "application", { probe: `(${lit(C)} + ${N}*(${lit(cpn)} - ${lit(C)}*${J}) - ${lit(P)})` }),
      ];
    }
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { values: [{ label: level === 3 ? "i" : "j", expr: basic(cpn, C), bracket: level === 3 ? [0.004, 0.4] : [0.002, 0.3] }], description: `The explicit equation of value between the price and the ${N} coupons and redemption payment, solved numerically: ${level === 3 ? `$i = ${mpc(y)}$` : `$j = ${dj(jTrue)}$`}. Each option is solved and only the correct one has that root.` },
      steps: [
        { concept: "bond.yield-definition", reasoning: "The yield is the rate that equates the price with the PV of the coupons and the redemption payment." },
        { concept: "bond.face-redemption", reasoning: `Coupons are $${mamt(cpn)}$ per ${semi ? "half-year" : "year"} (from face); the redemption payment is $${mamt(C)}$.` },
        ...(level === 3 ? [{ concept: "bond.terms", reasoning: "The equation is in the half-year rate $j$; the annual effective rate satisfies $1 + i = (1+j)^2$." }] : []),
        { concept: "bond.price-forms", reasoning: "Either form may be used: $P = Fr\\,a_{\\overline{n|}} + Cv^n$ or $P - C = (Fr - Cj)a_{\\overline{n|}}$." },
      ],
      conditions: ["Bond held to maturity.", "One yield rate per coupon period discounts every payment."],
      relationship: "$P = Fr\\,a_{\\overline{n|}\\,j} + Cv_j^n \\iff P - C = (Fr - Cj)\\,a_{\\overline{n|}\\,j}$",
      counterexample: "Current yield and yield agree only when the price equals the redemption value.",
      transfer: {
        principle: "Write the equation of value first; the yield is its root, never a simple ratio.",
        unusual: "The unknown is a rate, so the equation cannot be rearranged into a closed form.",
        misread: "The rate basis asked for may differ from the coupon period.",
      },
      itemFormat: "equation-selection",
      presentation: levelTags(level, ["unknown-rate", "frequency"], ["unknown-rate", "frequency", "hidden-structure"]),
      features: { unfamiliar: level >= 2 },
      modelingDecisions: level === 3 ? 2 : undefined,
      params: { F, years, r, C, y, P, variant },
    });
  },
});

const yieldStatements: ChoiceTemplate = conceptTemplate({
  id: "con-bond-yield-statements",
  family: "con-bond-yield",
  topic: "BONDS",
  levels: [2, 3],
  objective: "BONDS.yield",
  secondary: ["BONDS.price_redemption", "BONDS.coupons"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "interpretation"],
  soaConcept: "Statements comparing coupon rate, current yield and yield rate, and the price–yield relationship.",
  variants: 2,
  generate(rng, level, variant) {
    const F = 1000 * rng.int(1, 5);
    const n = rng.int(8, 20);
    const r = gridRate(rng, 0.04, 0.09, 0.005);
    const C = level === 2 ? F : F * (1 + 0.05 * rng.int(1, 3));
    const Fr = F * r;
    const j = drawUntil(() => gridRate(rng, 0.03, 0.09, 0.005), (x) => Math.abs(x - r) >= 0.005 && Math.abs(Fr - C * x) >= 0.002 * F);
    const Pexact = bondPrice(Fr, 1, C, j, n);
    const P = round2(Pexact);
    const redText = C === F ? "redeemable at par" : `redeemable at ${mamt(C)}`;
    let statements: StatementSpec[];
    let stem: string;
    if (variant === 0) {
      stem = `A ${n}-year bond with face amount ${mamt(F)} pays annual coupons at a rate of ${pc(r)} and is ${redText}. Its price is ${mnum(P, 2)}.\n\nDetermine which of the following statements are true.`;
      const cy = Fr / P;
      const pAt = (rate: number) => priceE(Fr, C, rate, n);
      const iTrue = bondPrice(Fr, 1, C, r, n) < P;
      const iiTrue = (cy - r) * (bondPrice(Fr, 1, C, cy, n) - P) > 0;
      statements = [
        { key: "I", text: "The bond's annual effective yield rate is less than its coupon rate.", truth: iTrue, justification: `At the coupon rate the bond would be worth $${mnum(bondPrice(Fr, 1, C, r, n), 2)}$, ${iTrue ? "less" : "more"} than the price; since value falls as the rate rises, the yield is ${iTrue ? "below" : "above"} ${pc(r)}.`, misconception: "CONC_PRICE_YIELD_DIRECTION", check: { expr: pAt(r), op: "<", than: lit(P) }, stage: 1, failure: "application" },
        { key: "II", text: "The bond's current yield lies between its coupon rate and its yield rate.", truth: iiTrue, justification: iiTrue ? `The current yield ${pc(cy, 3)} sits between the two.` : `The current yield ${pc(cy, 3)} does not sit between the coupon rate and the yield here.`, misconception: "FORMULA_CURRENT_YIELD", check: { expr: `(${lit(cy)} - ${lit(r)})*(${pAt(cy)} - ${lit(P)})`, op: ">", than: 0 }, stage: 0, failure: "interpretation", conditionTrue: "It always holds for a bond redeemable at par that is not priced at par." },
        { key: "III", text: `At a yield rate equal to the coupon rate, the bond's price would equal its face amount.`, truth: C === F, justification: C === F ? "With $C = F$ and $j = r$, every coupon is exactly interest on $C$, so $P = C = F$." : `With $j = r$ the price is $C + (Fr - Cr)a_{\\overline{n|}} \\ne F$ because $C = ${mamt(C)}$.`, misconception: "CONC_BOND_REDEMPTION_AS_FACE", check: { expr: pAt(r), op: "=", than: lit(F) }, stage: 2, failure: "connection", conditionTrue: C === F ? "It fails when the redemption value differs from face." : "It holds for a bond redeemable at par." },
      ];
    } else {
      stem = `A ${n}-year bond with face amount ${mamt(F)} pays annual coupons at a rate of ${pc(r)} and is ${redText}. It is bought to yield an annual effective rate of ${pc(j)}.\n\nDetermine which of the following statements are true.`;
      const up = priceE(Fr, C, j + 0.01, n);
      const down = priceE(Fr, C, j - 0.01, n);
      const at = priceE(Fr, C, j, n);
      const flipI = rng.int(0, 1) === 1;
      const flipII = rng.int(0, 1) === 1;
      const premium = Fr > C * j;
      statements = [
        flipI
          ? { key: "I", text: `At a yield rate of ${pc(j + 0.01)}, the price would be higher.`, truth: false, justification: "Present values fall as the yield rises.", misconception: "CONC_PRICE_YIELD_DIRECTION", check: { expr: up, op: ">", than: at }, stage: 1, failure: "application" }
          : { key: "I", text: `At a yield rate of ${pc(j + 0.01)}, the price would be lower.`, truth: true, justification: "Present values fall as the yield rises.", misconception: "CONC_PRICE_YIELD_DIRECTION", check: { expr: up, op: "<", than: at }, stage: 1, failure: "application" },
        flipII
          ? { key: "II", text: "A 1% fall in the yield rate would raise the price by less than a 1% rise would lower it.", truth: false, justification: "The price–yield curve is convex: the rise for a fall in yield exceeds the fall for an equal rise.", misconception: "CONC_IGNORED_CONVEXITY", check: { expr: `(${down} - ${at}) - (${at} - ${up})`, op: "<", than: 0 }, stage: 1, failure: "connection" }
          : { key: "II", text: "A 1% fall in the yield rate would raise the price by more than a 1% rise would lower it.", truth: true, justification: "The price–yield curve is convex: the rise for a fall in yield exceeds the fall for an equal rise.", misconception: "CONC_IGNORED_CONVEXITY", check: { expr: `(${down} - ${at}) - (${at} - ${up})`, op: ">", than: 0 }, stage: 1, failure: "connection" },
        { key: "III", text: `The bond's current yield exceeds ${pc(j)}.`, truth: premium, justification: `$Fr - Pj = (Fr - Cj)v^n$, so the current yield exceeds the yield exactly when the bond is at a premium ($Fr ${premium ? ">" : "<"} Cj$).`, misconception: "FORMULA_CURRENT_YIELD", check: { expr: `${lit(Fr)}/${at}`, op: ">", than: lit(j) }, stage: 2, failure: "connection", ...(level === 3 ? { confusedWith: "bond.modified-coupon" } : {}) },
      ];
    }
    return statementQuestion({
      stem,
      statements,
      extra: multiFlipExtras(statements, variant === 0 ? "CONC_BOND_YIELD_IS_COUPON_RATE" : "CONC_RELATED_TERM", 2),
      steps: [
        { concept: "bond.yield-definition", reasoning: "The yield equates the price with the PV of all payments; current yield is only coupon ÷ price." },
        { concept: "bond.price-yield", reasoning: "Price falls as the yield rises, and the curve is convex; comparing a PV at a trial rate with the price places the yield." },
        { concept: "bond.premium-discount", reasoning: "Premium ($Fr > Cj$) or discount decides the order of coupon rate, current yield and yield." },
        ...(level === 3 ? [{ concept: "bond.modified-coupon", reasoning: "With $C \\ne F$ the comparisons are against $C$, so relations that hold at par can fail." }] : []),
      ],
      conditions: ["Annual coupons and annual effective yields.", "Bond held to maturity."],
      relationship: "$P - C = (Fr - Cj)a_{\\overline{n|}}$ and $Fr - Pj = (Fr - Cj)v^n$.",
      counterexample: "For a bond priced at its redemption value, coupon-based rates and the yield coincide.",
      transfer: {
        principle: "Locate an unknown yield by comparing the price with the PV at a trial rate.",
        unusual: "No yield is computed, yet statements about it can be settled.",
        misread: "Relations between coupon rate and yield that hold at par can fail when $C \\ne F$.",
      },
      presentation: levelTags(level, ["indirect-wording"], ["indirect-wording", "hidden-structure"]),
      features: { unfamiliar: true, steps: level === 3 ? 4 : 3 },
      modelingDecisions: level === 3 ? 1 : undefined,
      params: { F, n, r, C, j, variant },
    });
  },
});

// ================================================================ BONDS.amortization

const amortInterp: ChoiceTemplate = conceptTemplate({
  id: "con-bond-amort-interp",
  family: "con-bond-amortization",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.amortization",
  secondary: ["BONDS.book_market"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "terminology"],
  soaConcept: "What the premium amortized (or discount accumulated) in a coupon represents.",
  variants: 2,
  generate(rng, level, variant) {
    const premium = variant === 0;
    const word = premium ? "premium amortized" : "discount accumulated";
    const steps = [
      { concept: "bond.amortization", reasoning: "Each coupon splits into interest at the yield on the previous book value and an adjustment to book value." },
      { concept: "bond.book-value", reasoning: premium ? "For a premium bond the coupon exceeds the interest; the excess writes the book value down." : "For a discount bond the interest exceeds the coupon; the shortfall is added to book value." },
    ];
    const common = {
      steps,
      conditions: ["Scientific (yield) method of amortization.", "Interest at the purchase yield on the book value at the start of the period."],
      relationship: "$\\text{Coupon} = j\\cdot BV_{t-1} + (BV_{t-1} - BV_t)$, and $BV_{t-1} - BV_t = (Fr - Cj)v^{n-t+1}$.",
      counterexample: "In the first coupon the previous book value is the price, so ‘interest on the price’ and ‘interest on the previous book value’ coincide only then.",
      transfer: {
        principle: "A bond is a loan at the yield rate: coupons are payments, book value is the balance, the write-down is principal repaid.",
        unusual: "The quantity asked for is the principal part, not the interest part.",
        misread: "The amortization is not the interest earned.",
      },
    };
    if (level === 1) {
      return conceptQuestion({
        ...common,
        stem: premium
          ? "A bond is bought at a premium. Under the scientific method, determine which of the following is the amount of premium amortized in a given coupon."
          : "A bond is bought at a discount. Under the scientific method, determine which of the following is the amount of discount accumulated in a given coupon.",
        correct: premium
          ? { content: "The coupon less interest at the yield rate on the book value just after the previous coupon", why: "That excess repays part of the premium, reducing book value toward the redemption value." }
          : { content: "Interest at the yield rate on the book value just after the previous coupon, less the coupon", why: "That shortfall is added to book value, raising it toward the redemption value." },
        distractors: [
          opt(premium ? "Interest at the yield rate on the book value just after the previous coupon" : "Interest at the yield rate on the book value just after the previous coupon, all of it", "VAR_INTEREST_FOR_PRINCIPAL", "That is the interest part of the coupon, not the book-value adjustment.", 0, "interpretation", { confusedWith: "bond.amortization" }),
          opt(premium ? "The premium divided by the number of coupons, the same amount for every coupon" : "The discount divided by the number of coupons, the same amount for every coupon", "MODEL_STRAIGHT_LINE", "The scientific method gives amounts that grow by $1 + j$ each period.", 0, "selection"),
          opt(premium ? "The coupon less interest at the coupon rate on the book value just after the previous coupon" : "Interest at the coupon rate on the book value just after the previous coupon, less the coupon", "CONC_BOND_YIELD_IS_COUPON_RATE", "Interest is earned at the yield rate, not the coupon rate.", 1, "application"),
          opt(premium ? "The coupon less interest at the yield rate on the price originally paid for the bond" : "Interest at the yield rate on the price originally paid for the bond, less the coupon", "VAR_ORIGINAL_FOR_OUTSTANDING", "Interest accrues on the current book value, not the original price.", 1, "application", { conditionTrue: "It is correct for the first coupon only." }),
          opt(premium ? "The fall in the bond's market value between the previous coupon and this one" : "The rise in the bond's market value between the previous coupon and this one", "CONC_BOOK_MARKET_CONFUSION", "Amortization changes book value, which ignores market yields.", 1, "interpretation"),
        ],
        itemFormat: "interpretation",
        presentation: ["direct"],
      });
    }
    // Level 2: the same idea with numbers.
    const F = 1000 * rng.int(1, 5);
    const n = rng.int(10, 20);
    const r = gridRate(rng, 0.04, 0.09, 0.005);
    const j = drawUntil(() => gridRate(rng, 0.03, 0.09, 0.005), (x) => (premium ? r - x >= 0.005 : x - r >= 0.005));
    const C = F;
    const Fr = F * r;
    const t = rng.int(3, n - 2);
    const P = round2(bondPrice(Fr, 1, C, j, n));
    const B = round2(bondPrice(Fr, 1, C, j, n - t + 1));
    const truthAmt = `(${priceE(Fr, C, j, n - t + 1)} - ${priceE(Fr, C, j, n - t)})`;
    const sign = premium ? "" : "-1*";
    const truth = `${sign}${truthAmt}`;
    const tol = 2e-3;
    const claim = (e: string) => ({ expr: e, op: "=" as const, than: truth, tol });
    return conceptQuestion({
      ...common,
      stem: `A ${n}-year bond with face amount ${mamt(F)} and annual coupons at a rate of ${pc(r)} is redeemable at par. It is bought to yield an annual effective rate of ${pc(j)}. Its book value immediately after the ${ord(t - 1)} coupon is ${mnum(B, 2)}.\n\nDetermine which of the following is the amount of ${word} in the ${ord(t)} coupon.`,
      correct: premium
        ? { content: `$${mamt(Fr)} - ${dj(j)}(${mnum(B, 2)})$`, why: `Coupon less interest at the yield on the previous book value: $${mnum(Fr - j * B, 2)}$.`, check: claim(`(${lit(Fr)} - ${lit(j)}*${lit(B)})`) }
        : { content: `$${dj(j)}(${mnum(B, 2)}) - ${mamt(Fr)}$`, why: `Interest at the yield on the previous book value less the coupon: $${mnum(j * B - Fr, 2)}$.`, check: claim(`(${lit(j)}*${lit(B)} - ${lit(Fr)})`) },
      distractors: [
        opt(`$${dj(j)}(${mnum(B, 2)})$`, "VAR_INTEREST_FOR_PRINCIPAL", "That is the interest earned in the period.", 0, "interpretation", { check: claim(`(${lit(j)}*${lit(B)})`) }),
        opt(`$${premium ? `(${mnum(P, 2)} - ${mamt(C)})` : `(${mamt(C)} - ${mnum(P, 2)})`}/${n}$`, "MODEL_STRAIGHT_LINE", "The scientific method does not spread the premium or discount evenly.", 0, "selection", { check: claim(premium ? `((${lit(P)} - ${lit(C)})/${n})` : `((${lit(C)} - ${lit(P)})/${n})`) }),
        opt(premium ? `$${mamt(Fr)} - ${dj(r)}(${mnum(B, 2)})$` : `$${dj(r)}(${mnum(B, 2)}) - ${mamt(Fr)}$`, "CONC_BOND_YIELD_IS_COUPON_RATE", "Interest is at the yield rate.", 1, "application", { check: claim(premium ? `(${lit(Fr)} - ${lit(r)}*${lit(B)})` : `(${lit(r)}*${lit(B)} - ${lit(Fr)})`) }),
        opt(premium ? `$${mamt(Fr)} - ${dj(j)}(${mnum(P, 2)})$` : `$${dj(j)}(${mnum(P, 2)}) - ${mamt(Fr)}$`, "VAR_ORIGINAL_FOR_OUTSTANDING", "Interest accrues on the current book value, not the original price.", 1, "application", { check: claim(premium ? `(${lit(Fr)} - ${lit(j)}*${lit(P)})` : `(${lit(j)}*${lit(P)} - ${lit(Fr)})`) }),
      ],
      reference: { description: "The amount is computed as the difference between consecutive prospective book values." },
      itemFormat: "interpretation",
      presentation: ["indirect-wording"],
      features: { unfamiliar: true },
      params: { F, n, r, j, t, variant },
    });
  },
});

const amortRelationship: ChoiceTemplate = conceptTemplate({
  id: "con-bond-amort-relationship",
  family: "con-bond-amortization",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.amortization",
  secondary: ["BONDS.book_market", "BONDS.yield"],
  itemFormat: "comparative-statics",
  conceptFamily: "relationship",
  dimensions: ["relationships", "interpretation"],
  reasoning: ["financial_intuition", "concept_recognition", "multistep"],
  soaConcept: "How write-downs and book values evolve over a bond's term under the scientific method.",
  variants: 2,
  generate(rng, level, variant) {
    const F = 1000 * rng.int(1, 5);
    const semi = level >= 2 && variant === 0;
    const m = semi ? 2 : 1;
    const years = rng.int(10, 20);
    const N = years * m;
    if (variant === 0 && level === 3) {
      // Inverse: two write-downs reveal the yield.
      const r = gridRate(rng, 0.06, 0.1, 0.005);
      const y = drawUntil(() => gridRate(rng, 0.03, 0.08, 0.005), (x) => r - x >= 0.01);
      const j = y / 2;
      const cpn = (F * r) / 2;
      const A = (t: number) => (cpn - F * j) * Math.pow(1 + j, -(N - t + 1));
      const a1 = rng.int(2, 8);
      const k = rng.int(4, 10);
      const a2 = a1 + k;
      const X = round2(A(a1) * 10000) / 10000;
      const Y = round2(A(a2) * 10000) / 10000;
      const Xs = X.toFixed(4);
      const Ys = Y.toFixed(4);
      const claim = (e: string) => ({ expr: e, op: "=" as const, than: lit(y), tol: 1e-3 });
      return conceptQuestion({
        stem: `A bond with semiannual coupons is bought at a premium. Under the scientific method, the premium amortized in the ${ord(a1)} coupon is ${Xs} and in the ${ord(a2)} coupon is ${Ys}. The bond's face amount is ${mamt(F)}.\n\nDetermine which of the following equals the yield rate, expressed as an annual nominal rate convertible semiannually.`,
        correct: { content: `$2\\bigl[(${Ys}/${Xs})^{1/${k}} - 1\\bigr]$`, why: `Write-downs grow by $1 + j$ per half-year, so $(1+j)^{${k}} = ${Ys}/${Xs}$ and the nominal rate is $2j = ${mpc(y)}$.`, check: claim(`2*((${Ys}/${Xs})**(1/${k}) - 1)`) },
        distractors: [
          opt(`$2\\bigl[(${Ys}/${Xs})^{1/${2 * k}} - 1\\bigr]$`, "ALG_ROOT_ERROR", `${k} coupons apart means ${k} half-years of growth, not ${2 * k}.`, 1, "application", { check: claim(`2*((${Ys}/${Xs})**(1/${2 * k}) - 1)`) }),
          opt(`$(${Ys}/${Xs})^{1/${k}} - 1$`, "RATE_ANNUAL_FOR_PERIODIC", "That is the rate per half-year; the nominal annual rate is twice it.", 2, "conclusion", { check: claim(`((${Ys}/${Xs})**(1/${k}) - 1)`) }),
          opt(`$(${Ys}/${Xs})^{2/${k}} - 1$`, "RATE_NOMINAL_AS_EFFECTIVE", "That is the annual effective rate, not the nominal rate convertible semiannually.", 2, "conclusion", { check: claim(`((${Ys}/${Xs})**(2/${k}) - 1)`) }),
          opt(`$2(${Ys} - ${Xs})/(${k} \\times ${Xs})$`, "SEQ_GEOMETRIC_AS_ARITHMETIC", "Write-downs grow geometrically, not by a fixed amount.", 1, "selection", { check: claim(`2*(${Ys} - ${Xs})/(${k}*${Xs})`) }),
          opt(`$2\\bigl[(${Xs}/${Ys})^{1/${k}} - 1\\bigr]$`, "CONC_DIRECTION_REVERSED", "Write-downs grow toward maturity; the later amount is the larger.", 0, "recognition", { check: claim(`2*((${Xs}/${Ys})**(1/${k}) - 1)`) }),
        ],
        reference: { description: "Write-downs $(Fr - Cj)v^{n-t+1}$ grow by $1 + j$ per coupon; the stated amounts were built from the true half-year yield, against which each option is checked." },
        steps: [
          { concept: "bond.amortization", reasoning: "The write-down in coupon $t$ is $(Fr - Cj)v^{n-t+1}$, so consecutive write-downs grow by $1 + j$." },
          { concept: "bond.book-value", reasoning: `Between coupons ${a1} and ${a2} there are ${k} periods: $(1+j)^{${k}} = ${Ys}/${Xs}$.` },
          { concept: "bond.terms", reasoning: "$j$ is per half-year; the nominal annual rate convertible semiannually is $2j$." },
        ],
        conditions: ["Scientific method.", "One yield rate throughout."],
        relationship: "$\\dfrac{\\text{write-down}_{t+k}}{\\text{write-down}_{t}} = (1+j)^k$",
        counterexample: "Under straight-line amortization the two amounts would be equal and reveal nothing about the yield.",
        transfer: {
          principle: "A geometric pattern in write-downs is a pattern in $v^{n-t+1}$; the ratio of two terms isolates $1 + j$.",
          unusual: "The yield is recovered from the amortization schedule rather than from a price.",
          misread: "The face amount is not needed.",
        },
        itemFormat: "comparative-statics",
        presentation: ["inverse", "hidden-structure", "irrelevant-info"],
        features: { unfamiliar: true },
        modelingDecisions: 2,
        params: { F, r, y, a1, a2, variant },
      });
    }
    const r = gridRate(rng, 0.04, 0.09, 0.005);
    const C = level === 1 ? F : F * (1 + 0.05 * rng.int(1, 3)) * (rng.int(0, 1) ? 1 : 0.9);
    const y = drawUntil(
      () => gridRate(rng, 0.03, 0.1, 0.005),
      (x) => {
        if (Math.abs(F * r - C * x) < 0.003 * F) return false;
        if (level === 3) {
          const p = bondPrice(F * r, 1, C, x, N);
          return (p - F) * (p - C) < 0;
        }
        return Math.abs(x - r) >= 0.005;
      }
    );
    const j = y / m;
    const cpn = (F * r) / m;
    const premium = cpn > C * j;
    const BV = (t: number) => priceE(cpn, C, j, N - t);
    const t0 = rng.int(1, N - 3);
    const d1 = `(${BV(t0)} - ${BV(t0 + 1)})`;
    const d2 = `(${BV(t0 + 1)} - ${BV(t0 + 2)})`;
    const ratio = `(${d2}/${d1})`;
    const redText = C === F ? "redeemable at par" : `redeemable at ${mamt(C)}`;
    const couponText = semi ? `semiannual coupons at an annual rate of ${pc(r)}` : `annual coupons at a rate of ${pc(r)}`;
    const yText = semi ? `an annual nominal rate of ${pc(y)} convertible semiannually` : `an annual effective rate of ${pc(y)}`;
    const P = bondPrice(cpn, 1, C, j, N);
    if (variant === 0) {
      const word = premium ? "premium amortized" : "discount accumulated";
      const absEx = Math.abs(cpn - C * j);
      return conceptQuestion({
        stem: `A ${years}-year bond with face amount ${mamt(F)} pays ${couponText} and is ${redText}. It is bought to yield ${yText}.\n\nDetermine which of the following describes how the amount of ${word} changes from one coupon to the next under the scientific method.`,
        correct: { content: `Each amount is ${dj(1 + j)} times the amount in the previous coupon.`, why: `Write-downs are $|Fr - Cj|v^{n-t+1}$, so each is $1 + j = ${dj(1 + j)}$ times the last.`, check: { expr: ratio, op: "=", than: lit(1 + j) } },
        distractors: [
          opt("Each amount is equal to the amount in the previous coupon.", "MODEL_STRAIGHT_LINE", "Equal amounts are the straight-line method, not the scientific method.", 1, "selection", { check: { expr: ratio, op: "=", than: 1 } }),
          opt(`Each amount is ${dj(1 / (1 + j)).slice(0, 8)} times the amount in the previous coupon.`, "CONC_DIRECTION_REVERSED", "Write-downs grow toward maturity; they do not shrink.", 1, "conclusion", { check: { expr: ratio, op: "=", than: lit(1 / (1 + j)) } }),
          opt(`Each amount exceeds the previous one by ${dj(round2(j * absEx * 100) / 100)}.`, "SEQ_GEOMETRIC_AS_ARITHMETIC", "The amounts grow by a constant factor, not a constant difference.", 1, "selection", { check: { expr: `(${d2} - ${d1})*${premium ? 1 : -1}`, op: "=", than: lit(round2(j * absEx * 100) / 100) } }),
          opt(`Each amount is ${dj(1 + r / m)} times the amount in the previous coupon.`, "CONC_BOND_YIELD_IS_COUPON_RATE", "Interest accrues at the yield rate, so the growth factor is $1 + j$.", 0, "application", { check: { expr: ratio, op: "=", than: lit(1 + r / m) } }),
          ...(semi ? [opt(`Each amount is ${dj(1 + y)} times the amount in the previous coupon.`, "RATE_ANNUAL_FOR_PERIODIC", "Coupons are half-yearly, so the factor is one plus the half-year yield.", 0, "application", { check: { expr: ratio, op: "=", than: lit(1 + y) } })] : []),
        ],
        reference: { description: "Consecutive write-downs computed as differences of prospective book values; their ratio is compared with each option." },
        steps: [
          { concept: "bond.amortization", reasoning: "Write-down $= \\text{coupon} - j\\cdot BV_{t-1}$; since $BV$ moves by the write-down, the next write-down is $(1 + j)$ times larger." },
          { concept: "bond.premium-discount", reasoning: `The bond is at a ${premium ? "premium" : "discount"} ($Fr ${premium ? ">" : "<"} Cj$), but either way the amounts grow by $1 + j$.` },
          ...(semi ? [{ concept: "bond.terms", reasoning: `The yield per half-year is ${pc(j)}.` }] : []),
        ],
        conditions: ["Scientific method at the purchase yield."],
        relationship: "$BV_{t-1} - BV_t = (Fr - Cj)v^{n-t+1}$",
        counterexample: "Under straight-line amortization the amounts would be equal.",
        transfer: {
          principle: "A bond is a loan at the yield: principal repaid in successive payments grows by $1 + j$.",
          unusual: "No amount is computed; only the pattern matters.",
          misread: "The growth factor uses the yield, not the coupon rate.",
        },
        itemFormat: "comparative-statics",
        presentation: semi ? ["frequency"] : ["direct"],
        features: { unfamiliar: semi },
        params: { F, years, r, C, y, variant },
      });
    }
    // Variant 1: the path of book value.
    const dir = premium ? "decreases" : "increases";
    const odir = premium ? "increases" : "decreases";
    const growth = { expr: ratio, op: ">" as const, than: 1 };
    const opts: ConceptOption[] = [
      opt(`It ${dir} to ${amt2(C)} at maturity, by the same amount each period.`, "MODEL_STRAIGHT_LINE", "Equal steps are the straight-line method.", 1, "selection", { check: { expr: ratio, op: "=", than: 1 } }),
      opt(`It ${dir} to ${amt2(C)} at maturity, by smaller amounts each period.`, "CONC_DIRECTION_REVERSED", "The steps grow by $1 + j$; they do not shrink.", 1, "conclusion", { check: { expr: ratio, op: "<", than: 1 } }),
      ...(level === 3
        ? [opt(`It ${P > F ? "decreases" : "increases"} to ${amt2(F)}, the face amount, by larger amounts each period.`, "CONC_BOND_REDEMPTION_AS_FACE", `Book value ends at the redemption value ${amt2(C)}, so it ${dir} although the price is ${P > F ? "above" : "below"} face.`, 0, "interpretation", { check: { expr: lit(C), op: "=", than: lit(F) }, confusedWith: "bond.face-redemption" })]
        : []),
      opt(`It ${odir} to ${amt2(C)} at maturity, by larger amounts each period.`, level >= 2 ? "CONC_BOND_COUPON_RATE_AS_MODIFIED" : "CONC_PRICE_YIELD_DIRECTION", premium ? "A premium bond's book value is written down." : "A discount bond's book value is written up.", 0, "recognition", { check: { expr: `(${BV(t0)} - ${BV(t0 + 1)})*${premium ? -1 : 1}`, op: ">", than: 0 } }),
      opt(`It stays at the price paid until maturity, then becomes ${amt2(C)}.`, "VAR_ORIGINAL_FOR_OUTSTANDING", "Book value changes with every coupon.", 1, "interpretation", { check: { expr: BV(1), op: "=", than: lit(P) } }),
      opt(`It moves with market yields, rising when they fall, and reaches ${amt2(C)} at maturity.`, "CONC_BOOK_MARKET_CONFUSION", "Book value ignores market yields; that describes market value.", 0, "interpretation"),
    ];
    return conceptQuestion({
      stem: `A ${years}-year bond with face amount ${mamt(F)} pays annual coupons at a rate of ${pc(r)} and is ${redText}. It is bought to yield an annual effective rate of ${pc(y)}${level === 3 ? `, at a price of ${mnum(P, 2)}` : ""}.\n\nDetermine which of the following describes the bond's book value over its term under the scientific method.`,
      correct: { content: `It ${dir} to ${amt2(C)} at maturity, by larger amounts each period.`, why: `The bond is at a ${premium ? "premium" : "discount"} relative to $C$ ($Fr ${premium ? ">" : "<"} Cj$), so book value ${dir} to $C$; the steps grow by $1 + j$.`, check: growth },
      distractors: opts,
      reference: { description: "Book values computed prospectively at successive coupon dates; their steps are compared." },
      steps: [
        { concept: "bond.modified-coupon", reasoning: `Compare $Fr = ${mamt(F * r)}$ with $Cj = ${mnum(C * y, 2)}$ to classify the bond.` },
        { concept: "bond.book-value", reasoning: "Book value runs from the price to the redemption value $C$." },
        { concept: "bond.amortization", reasoning: "The steps are the write-downs, which grow by $1 + j$." },
      ],
      conditions: ["Scientific method at the purchase yield.", "Book value at maturity equals the redemption value."],
      relationship: "$BV_t = C + (Fr - Cj)a_{\\overline{n-t|}}$",
      counterexample: "A bond priced at its redemption value keeps a constant book value.",
      transfer: {
        principle: "Book value always ends at $C$; the sign of $Fr - Cj$ gives the direction and $1 + j$ the growth of the steps.",
        unusual: level === 3 ? "The price lies between the face amount and the redemption value." : "The whole path, not one value, is asked for.",
        misread: "Comparing the price with face instead of with $C$ can reverse the direction.",
      },
      itemFormat: "comparative-statics",
      presentation: levelTags(level, ["indirect-wording"], ["hidden-structure", "indirect-wording"]),
      features: { unfamiliar: level >= 2 },
      modelingDecisions: level === 3 ? 1 : undefined,
      params: { F, years, r, C, y, variant },
    });
  },
});

const amortDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-bond-amort-diagnosis",
  family: "con-bond-amortization",
  topic: "BONDS",
  levels: [2, 3],
  objective: "BONDS.amortization",
  secondary: ["BONDS.book_market", "BONDS.coupons"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "timing"],
  reasoning: ["validation", "concept_recognition", "cashflow_modelling"],
  soaConcept: "Diagnosing an amortization error: the wrong discount exponent, or the whole coupon counted as interest.",
  variants: 2,
  generate(rng, level, variant) {
    const F = 1000 * rng.int(1, 5);
    const semi = level === 3;
    const m = semi ? 2 : 1;
    const years = rng.int(8, 15);
    const N = years * m;
    const r = gridRate(rng, 0.05, 0.1, 0.005);
    const C = level === 3 ? F * (1 + 0.05 * rng.int(1, 2)) : F;
    const cpn = (F * r) / m;
    const y = drawUntil(() => gridRate(rng, 0.03, 0.08, 0.005), (x) => cpn - (C * x) / m >= 0.004 * F / m);
    const j = y / m;
    const P = bondPrice(cpn, 1, C, j, N);
    const Pr = round2(P);
    const couponText = semi ? `semiannual coupons at an annual rate of ${pc(r)}` : `annual coupons at a rate of ${pc(r)}`;
    const yText = semi ? `an annual nominal rate of ${pc(y)} convertible semiannually` : `an annual effective rate of ${pc(y)}`;
    const redText = C === F ? "redeemable at par" : `redeemable at ${mamt(C)}`;
    let stem: string;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    if (variant === 0) {
      const t = drawUntil(() => rng.int(2, N - 2), (x) => x !== N - x + 1 && x - 1 !== N - x + 1 && Math.abs(2 * x - N - 1) >= 2);
      const yearOf = Math.ceil(t / m);
      const label = semi ? `the ${t % 2 === 1 ? "first" : "second"} coupon of year ${yearOf}` : `the ${ord(t)} coupon`;
      const ex = cpn - C * j;
      const truth = `(${priceE(cpn, C, j, N - t + 1)} - ${priceE(cpn, C, j, N - t)})`;
      const amtE = (e: number, k: number) => `(${lit(e)}*${vPow(j, k)})`;
      const proposed = ex * Math.pow(1 + j, -t);
      stem =
        `A ${years}-year bond with face amount ${mamt(F)} pays ${couponText} and is ${redText}. It is bought to yield ${yText}. A candidate calculates the premium amortized in ${label} as\n\n` +
        `$$\\bigl(${mamt(cpn)} - ${mamt(C)}(${dj(j)})\\bigr)${vS(j, t)} = ${mnum(proposed, 4)}.$$\n\nWhich of the following correctly describes the candidate's calculation?`;
      correct = { content: `The exponent should be ${N - t + 1}, since the write-downs grow toward maturity.`, why: `The write-down in coupon $t$ is $(Fr - Cj)v^{n-t+1}$: here $${mnum(ex * Math.pow(1 + j, -(N - t + 1)), 4)}$.`, check: { expr: amtE(ex, N - t + 1), op: "=", than: truth } };
      distractors = [
        opt("The calculation is correct, since the write-downs shrink over time.", "CONC_DIRECTION_REVERSED", "Write-downs grow by $1 + j$ each period.", 1, "conclusion", { check: { expr: amtE(ex, t), op: "=", than: truth } }),
        opt(`The exponent should be ${t - 1}, the number of coupons already paid.`, "TIMING_BALANCE_INDEX", "The exponent counts the periods from this coupon to maturity, plus one.", 1, "application", { check: { expr: amtE(ex, t - 1), op: "=", than: truth } }),
        opt(`The amount should be the premium divided by ${N}, the number of coupons.`, "MODEL_STRAIGHT_LINE", "The scientific method does not spread the premium evenly.", 0, "selection", { check: { expr: `((${lit(P)} - ${lit(C)})/${N})`, op: "=", than: truth } }),
        opt(`The amount should be ${dj(j)} times the book value after the previous coupon.`, "VAR_INTEREST_FOR_PRINCIPAL", "That is the interest part of the coupon.", 0, "interpretation", { check: { expr: `(${lit(j)}*${priceE(cpn, C, j, N - t + 1)})`, op: "=", than: truth } }),
        ...(C !== F ? [opt(`The interest term should use ${amt2(F)} in place of ${amt2(C)}.`, "CONC_BOND_REDEMPTION_AS_FACE", "The write-down compares the coupon with interest on the redemption value.", 0, "interpretation", { check: { expr: amtE(cpn - F * j, t), op: "=", than: truth } })] : []),
      ];
    } else {
      const terms: string[] = [];
      for (let t = 1; t <= N; t += 1) terms.push(`${lit(j)}*${priceE(cpn, C, j, N - t + 1)}`);
      const truth = `(${terms.join(" + ")})`;
      const tol = 1e-4;
      const claim = (e: string) => ({ expr: e, op: "=" as const, than: truth, tol });
      stem =
        `A ${years}-year bond with face amount ${mamt(F)} pays ${couponText} and is ${redText}. It is bought for ${mnum(Pr, 2)}, which gives ${yText}, and held to maturity. A candidate calculates the total interest earned over the term as\n\n` +
        `$$${N} \\times ${mamt(cpn)} = ${mnum(N * cpn, 2)}.$$\n\nWhich of the following correctly describes the candidate's calculation?`;
      correct = { content: `The premium ${mnum(Pr, 2)} − ${amt2(C)} is a return of capital and must be subtracted.`, why: `Total interest is total coupons plus $C - P$: $${mnum(N * cpn + C - Pr, 2)}$.`, check: claim(`(${lit(N * cpn)} + ${lit(C)} - ${lit(Pr)})`) };
      distractors = [
        opt("The calculation is correct, since each coupon is entirely interest income.", "CONC_BOND_COUPON_AS_INTEREST", "Part of each coupon writes down the premium.", 0, "interpretation", { check: claim(lit(N * cpn)) }),
        opt(`The premium ${mnum(Pr, 2)} − ${amt2(C)} is extra income and must be added.`, "CONC_DIRECTION_REVERSED", "Paying a premium lowers the income, since only $C$ comes back.", 1, "conclusion", { check: claim(`(${lit(N * cpn)} + ${lit(Pr)} - ${lit(C)})`) }),
        opt(`Total interest should be ${N} times ${dj(j)} times the price ${mnum(Pr, 2)}.`, "VAR_ORIGINAL_FOR_OUTSTANDING", "Interest is earned on a book value that falls each period, not on the price.", 1, "application", { check: claim(`(${N}*${lit(j)}*${lit(Pr)})`) }),
        opt(`Total interest should be the price accumulated for ${N} periods, less the price.`, "MODEL_REINVEST_AT_YIELD", "That also counts interest on reinvested coupons, which the bond itself does not earn.", 1, "selection", { check: claim(`(${lit(Pr)}*(1+${lit(j)})**${N} - ${lit(Pr)})`) }),
        ...(C !== F ? [opt(`The difference ${mnum(Pr, 2)} − ${amt2(F)} must be subtracted from the coupons.`, "CONC_BOND_REDEMPTION_AS_FACE", `Only ${amt2(C)} is returned at maturity, so the premium is measured against $C$.`, 0, "interpretation", { check: claim(`(${lit(N * cpn)} - ${lit(Pr)} + ${lit(F)})`) })] : []),
      ];
    }
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { description: variant === 0 ? "The write-down is computed as the difference between consecutive prospective book values." : "Total interest is the sum over all coupons of the yield times the book value at the start of each period." },
      steps: [
        { concept: "bond.amortization", reasoning: "Each coupon is interest $j\\cdot BV_{t-1}$ plus a write-down $(Fr - Cj)v^{n-t+1}$." },
        { concept: "bond.book-value", reasoning: "Write-downs add up to $P - C$, taking book value from the price to the redemption value." },
        { concept: "bond.premium-discount", reasoning: variant === 0 ? "Write-downs grow toward maturity: the first is $(Fr - Cj)v^n$, the last $(Fr - Cj)v$." : "Total interest = total coupons − premium = $n\\cdot Fr + C - P$." },
        ...(level === 3 ? [{ concept: "bond.terms", reasoning: `Work per half-year: coupons $${mamt(cpn)}$, yield ${pc(j)}, ${N} periods; premium measured against $C = ${mamt(C)}$.` }] : []),
      ],
      conditions: ["Scientific method at the purchase yield.", "Bond held to maturity."],
      relationship: "$BV_{t-1} - BV_t = (Fr - Cj)v^{n-t+1}$; $\\sum_t j\\,BV_{t-1} = n\\,Fr + C - P$.",
      counterexample: "For a bond bought at its redemption value, every coupon is entirely interest.",
      transfer: {
        principle: "Treat the bond as a loan at the yield: coupons are payments, write-downs are principal, the rest is interest.",
        unusual: "A worked solution is judged rather than produced.",
        misread: "Write-downs grow toward maturity, so early ones are the smallest.",
      },
      itemFormat: "error-diagnosis",
      presentation: levelTags(level, ["indirect-wording"], ["indirect-wording", "frequency", "valuation-date"]),
      features: { unfamiliar: true },
      modelingDecisions: level === 3 ? 1 : undefined,
      params: { F, years, r, C, y, variant },
    });
  },
});

// ================================================================ BONDS.reinvestment

/** Realized return per period, as an expression: (AV/P)^(1/N) − 1. */
const realizedE = (cpn: number, C: number, k: number, N: number, P: number): string => `((((${couponAV(cpn, k, N)}) + ${lit(C)})/${lit(P)})**(1/${N}) - 1)`;

const reinvestInterp: ChoiceTemplate = conceptTemplate({
  id: "con-bond-reinvest-interp",
  family: "con-bond-reinvestment",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.reinvestment",
  secondary: ["BONDS.yield"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "relationships"],
  soaConcept: "How the reinvestment rate moves the investor's realized return away from the purchase yield.",
  variants: 2,
  generate(rng, level, variant) {
    const semi = level === 2;
    const m = semi ? 2 : 1;
    const F = 1000 * rng.int(1, 5);
    const years = rng.int(8, 20);
    const N = years * m;
    const r = gridRate(rng, 0.04, 0.09, 0.005);
    const y = yieldAway(rng, 0.04, 0.09, r, 0.005);
    const kA = drawUntil(() => gridRate(rng, 0.02, 0.11, 0.005), (x) => Math.abs(x - y) >= 0.01 && Math.abs(x - r) >= 0.005);
    const j = y / m;
    const k = kA / m;
    const cpn = (F * r) / m;
    const P = bondPrice(cpn, 1, F, j, N);
    const Y = realizedE(cpn, F, k, N, P);
    const show = (perPeriod: number) => pc(perPeriod * m, 3);
    const basis = semi ? "annual nominal rates convertible semiannually" : "annual effective rates";
    const kLow = kA < y;
    const eq = (v: number) => ({ expr: Y, op: "=" as const, than: lit(v) });
    const steps = [
      { concept: "bond.reinvestment", reasoning: `Accumulated value at maturity is $Fr\\,s_{\\overline{n|}\\,k} + C$, with coupons growing at the reinvestment rate ${show(k)}.` },
      { concept: "bond.price-yield", reasoning: `The price is the PV at the purchase yield ${show(j)}; the purchase yield is realized only if coupons also earn ${show(j)}.` },
      { concept: "bond.yield-definition", reasoning: "The realized return solves $P(1+y)^n = AV$; it is a blend of the purchase yield and the reinvestment rate." },
    ];
    const common = {
      steps,
      conditions: ["Coupons reinvested on receipt at one rate until maturity.", "Bond held to maturity and redeemed at par."],
      relationship: "$P(1 + y)^n = Fr\\,s_{\\overline{n|}\\,k} + C$, so $y$ lies between $k$ and $j$.",
      counterexample: "A zero-coupon bond has nothing to reinvest, so it realizes its purchase yield whatever the reinvestment rate.",
      transfer: {
        principle: "A purchase yield assumes reinvestment at that yield; a different reinvestment rate pulls the realized return toward it.",
        unusual: "Two rates of return describe the same bond.",
        misread: "The purchase yield is a price-setting rate, not a guaranteed return.",
      },
    };
    if (variant === 0) {
      return conceptQuestion({
        ...common,
        stem: `A ${years}-year bond with face amount ${mamt(F)} pays ${semi ? `semiannual coupons at an annual rate of ${pc(r)}` : `annual coupons at a rate of ${pc(r)}`} and is redeemable at par. It is bought to yield ${show(j)}, and each coupon is reinvested on receipt at ${show(k)}; both rates are ${basis}. The bond is held to maturity.\n\nWhich of the following is true of the investor's realized return over the ${years} years, on the same basis?`,
        correct: { content: `It lies strictly between ${show(Math.min(j, k))} and ${show(Math.max(j, k))}.`, why: `Coupons earn ${show(k)} while the bond itself earns ${show(j)}, so the overall return is a blend of the two.`, check: { expr: `(${Y} - ${lit(k)})*(${lit(j)} - ${Y})`, op: ">", than: 0 } },
        distractors: [
          opt(`It equals ${show(j)}, the yield at which the bond was bought.`, "CONC_BOND_REALIZED_EQUALS_YIELD", "That holds only if coupons are reinvested at the purchase yield.", 1, "connection", { check: eq(j), conditionTrue: "True if the coupons were reinvested at the purchase yield." }),
          opt(`It equals ${show(k)}, the rate at which the coupons are reinvested.`, "CONC_RELATED_TERM", "The amount paid for the bond still earns the purchase yield until maturity.", 2, "conclusion", { check: eq(k) }),
          kLow
            ? opt(`It is below ${show(k)}, since the coupons earn less than the yield.`, "CONC_DIRECTION_REVERSED", "Lower reinvestment pulls the return toward $k$, not past it.", 2, "conclusion", { check: { expr: Y, op: "<", than: lit(k) } })
            : opt(`It is above ${show(k)}, since the coupons earn more than the yield.`, "CONC_DIRECTION_REVERSED", "Higher reinvestment pulls the return toward $k$, not past it.", 2, "conclusion", { check: { expr: Y, op: ">", than: lit(k) } }),
          opt(`It equals ${show(r / m)}, the bond's coupon rate.`, "CONC_BOND_YIELD_IS_COUPON_RATE", "The coupon rate only sizes the coupons.", 0, "recognition", { check: eq(r / m) }),
          opt(`It equals ${show(cpn / P)}, the bond's current yield.`, "FORMULA_CURRENT_YIELD", "Current yield ignores both redemption and reinvestment.", 0, "recognition", { check: eq(cpn / P) }),
        ],
        reference: { description: "The realized return computed from the accumulated value of the coupons (term by term at the reinvestment rate) plus the redemption payment, against the price." },
        itemFormat: "interpretation",
        presentation: semi ? ["frequency"] : ["direct"],
        features: { unfamiliar: semi },
        params: { F, years, r, y, kA, variant },
      });
    }
    const zeroY = `((${lit(F)}/(${lit(F)}*${vPow(j, N)}))**(1/${N}) - 1)`;
    const rel = kLow ? "less" : "more";
    return conceptQuestion({
      ...common,
      stem: `Bond X is a ${years}-year zero-coupon bond. Bond Y is a ${years}-year bond with ${semi ? `semiannual coupons at an annual rate of ${pc(r)}` : `annual coupons at a rate of ${pc(r)}`}. Both have face amount ${mamt(F)}, are redeemable at par, and are bought to yield ${show(j)}. Coupons are reinvested on receipt at ${show(k)}; rates are ${basis}. Both bonds are held to maturity.\n\nWhich of the following correctly compares the investor's realized returns?`,
      correct: { content: `X earns exactly ${show(j)}; Y earns ${rel} than ${show(j)}.`, why: `X has no coupons to reinvest, so it realizes its yield; Y's coupons earn ${show(k)}, pulling its return ${kLow ? "down" : "up"}.`, check: { expr: Y, op: kLow ? "<" : ">", than: lit(j) } },
      distractors: [
        opt(`X and Y both earn exactly ${show(j)}.`, "CONC_BOND_REALIZED_EQUALS_YIELD", "Y realizes its purchase yield only if its coupons earn that yield.", 1, "connection", { check: eq(j) }),
        opt(`X earns exactly ${show(j)}; Y earns ${kLow ? "more" : "less"} than ${show(j)}.`, "CONC_DIRECTION_REVERSED", `Reinvesting at ${show(k)} pulls Y's return ${kLow ? "down" : "up"}.`, 2, "conclusion", { check: { expr: Y, op: kLow ? ">" : "<", than: lit(j) } }),
        opt(`X and Y both earn ${rel} than ${show(j)}.`, "CONC_OUTSIDE_ASSUMPTIONS", "A zero-coupon bond has nothing to reinvest.", 0, "application", { check: { expr: zeroY, op: kLow ? "<" : ">", than: lit(j) } }),
        opt(`X earns exactly ${show(j)}; Y earns exactly ${show(k)}.`, "CONC_RELATED_TERM", "Y's price still earns the purchase yield; only the coupons earn $k$.", 2, "conclusion", { check: eq(k) }),
      ],
      reference: { description: "Each bond's realized return computed from its accumulated value at maturity against its price." },
      itemFormat: "comparative-statics",
      presentation: ["compare-streams"],
      features: { unfamiliar: true },
      params: { F, years, r, y, kA, variant },
    });
  },
});

const reinvestExpr: ChoiceTemplate = conceptTemplate({
  id: "con-bond-reinvest-expr",
  family: "con-bond-reinvestment",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.reinvestment",
  secondary: ["BONDS.book_market", "BONDS.terms"],
  itemFormat: "expression-selection",
  conceptFamily: "timeline",
  dimensions: ["timing", "equation_construction"],
  reasoning: ["cashflow_modelling", "valuation_dates", "formula_selection"],
  soaConcept: "Selecting the accumulated value of a bond investment with coupons reinvested at a different rate, at maturity or at a sale date.",
  variants: 2,
  generate(rng, level, variant) {
    const semi = level >= 2;
    const m = semi ? 2 : 1;
    const F = 1000 * rng.int(1, 5);
    const years = rng.int(8, 20);
    const N = years * m;
    const r = gridRate(rng, 0.04, 0.09, 0.005);
    const y = yieldAway(rng, 0.04, 0.09, r, 0.005);
    const kA = drawUntil(() => gridRate(rng, 0.02, 0.1, 0.005), (x) => Math.abs(x - y) >= 0.01);
    const j = y / m;
    const k = level === 3 ? Math.pow(1 + kA, 0.5) - 1 : kA / m;
    const kName = level === 3 ? "k" : dj(k);
    const where = level === 3 ? `, \\quad k = (${dj(1 + kA)})^{1/2} - 1` : "";
    const cpn = (F * r) / m;
    const P = round2(bondPrice(cpn, 1, F, j, N));
    const couponText = semi ? `semiannual coupons at an annual rate of ${pc(r)}` : `annual coupons at a rate of ${pc(r)}`;
    const yText = semi ? `an annual nominal rate of ${pc(y)} convertible semiannually` : `an annual effective rate of ${pc(y)}`;
    const kText = level === 3 ? `an annual effective rate of ${pc(kA)}` : semi ? `an annual nominal rate of ${pc(kA)} convertible semiannually` : `an annual effective rate of ${pc(kA)}`;
    const sale = variant === 1;
    const t = sale ? rng.int(3, years - 3) * m : N;
    const y2 = sale ? drawUntil(() => gridRate(rng, 0.03, 0.1, 0.005), (x) => Math.abs(x - y) >= 0.005 && Math.abs(x - kA) >= 0.005 && Math.abs(x - r) >= 0.005) : y;
    const j2 = y2 / m;
    const R = N - t;
    const when = semi ? `the end of year ${t / m}` : `the end of year ${t}`;
    const stem = sale
      ? `An investor buys a ${years}-year bond with face amount ${mamt(F)} and ${couponText}, redeemable at par, for ${mnum(P, 2)}, a yield of ${yText}. Each coupon is reinvested on receipt at ${kText}. Immediately after the coupon at ${when}, the investor sells the bond at a price based on the yield then prevailing, ${semi ? `${pc(y2)} convertible semiannually` : pc(y2)}.\n\nDetermine which of the following expressions equals the investor's total accumulated value at ${when}.`
      : `An investor buys a ${years}-year bond with face amount ${mamt(F)} and ${couponText}, redeemable at par, for ${mnum(P, 2)}, a yield of ${yText}. Each coupon is reinvested on receipt at ${kText}. The bond is held to maturity.\n\nDetermine which of the following expressions equals the investor's total accumulated value at the end of ${years} years.`;
    const saleE = (rate: number, periods = R) => `${lit(cpn)}*${aExpr(periods, rate)} + ${lit(F)}*${vPow(rate, periods)}`;
    const saleS = (rate: number, periods = R) => `${mamt(cpn)}\\,${aS(periods, rate)} + ${mamt(F)}${vS(rate, periods)}`;
    const end = sale ? saleE(j2) : lit(F);
    const endS = sale ? saleS(j2) : mamt(F);
    const truth = `(${couponAV(cpn, k, t)} + ${end})`;
    const correct: ConceptOption = { content: math(`${mamt(cpn)}\\,${sS(t, kName)} + ${endS}${where}`), why: `Coupons accumulate at the reinvestment rate; ${sale ? "the bond is sold at its market value, the PV of the remaining payments at the new yield" : "the redemption payment arrives at maturity"}.`, probe: `(${lit(cpn)}*${sExpr(t, k)} + ${end})` };
    const kWrong = level === 3 ? kA / 2 : kA;
    const lastStage = level >= 2 ? 2 : 1;
    const distractors: ConceptOption[] = [
      ...(level === 2 ? [opt(math(`${mamt(cpn)}\\,${sS(t, kA)} + ${endS}`), "RATE_ANNUAL_FOR_PERIODIC", "Coupons are reinvested per half-year at half the nominal annual rate.", 1, "application", { probe: `(${lit(cpn)}*${sExpr(t, kWrong)} + ${end})` })] : []),
      ...(level === 3 ? [opt(math(`${mamt(cpn)}\\,${sS(t, dj(kA / 2))} + ${endS}`), "RATE_DIVIDED_EFFECTIVE", "An annual effective rate converts to a half-year rate by a square root, not by halving.", 1, "application", { probe: `(${lit(cpn)}*${sExpr(t, kWrong)} + ${end})`, confusedWith: "bond.terms" })] : []),
      opt(math(`${mamt(cpn)}\\,${sS(t, j)} + ${endS}${where}`), "MODEL_REINVEST_AT_YIELD", "The coupons earn the stated reinvestment rate, not the purchase yield.", 1, "selection", { probe: `(${lit(cpn)}*${sExpr(t, j)} + ${end})`, conditionTrue: "Correct only if the reinvestment rate equalled the purchase yield." }),
      opt(math(`${t}(${mamt(cpn)}) + ${endS}${where}`), "CONC_BOND_COUPONS_NOT_REINVESTED", "Reinvested coupons earn interest until the valuation date.", 1, "application", { probe: `(${lit(t * cpn)} + ${end})` }),
      ...(sale
        ? [
            opt(math(`${mamt(cpn)}\\,${sS(t, kName)} + ${saleS(j)}${where}`), "CONC_BOOK_MARKET_CONFUSION", "The sale price is the market value at the yield now prevailing, not the book value at the purchase yield.", lastStage, "interpretation", { probe: `(${lit(cpn)}*${sExpr(t, k)} + ${saleE(j)})`, confusedWith: "bond.book-vs-market" }),
            opt(math(`${mamt(cpn)}\\,${sS(t, kName)} + ${mamt(F)}${where}`), "TIMING_VALUATION_DATE", `The face amount is paid only at maturity; at ${when} the bond is worth its market value.`, lastStage, "application", { probe: `(${lit(cpn)}*${sExpr(t, k)} + ${lit(F)})` }),
            opt(math(`${mamt(cpn)}\\,${sS(t, kName)} + ${saleS(j2, N)}${where}`), "TIMING_BALANCE_INDEX", `Only the ${R} coupons after the sale belong to the buyer.`, lastStage, "application", { probe: `(${lit(cpn)}*${sExpr(t, k)} + ${saleE(j2, N)})` }),
          ]
        : [
            opt(math(`${mnum(P, 2)}${accS(k, N)}`.replace(`(${dj(1 + k)})`, level === 3 ? "(1+k)" : `(${dj(1 + k)})`) + where), "MODEL_INTEREST_ON_ORIGINAL", "Only the coupons are reinvested at $k$; the bond itself pays fixed amounts.", 1, "selection", { probe: `(${lit(P)}*(1+${lit(k)})**${N})` }),
            opt(math(`${mamt(cpn)}\\,${sdS(t, kName)} + ${mamt(F)}${where}`), "TIMING_IMMEDIATE_AS_DUE", "Each coupon is reinvested when paid, at the end of its period; the last earns no interest.", 1, "application", { probe: `(${lit(cpn)}*${sExpr(t, k)}*(1+${lit(k)}) + ${lit(F)})` }),
            opt(math(`${mamt(cpn)}\\,${sS(t, kName)}${where}`), "CONC_IGNORED_REDEMPTION", "The redemption payment is part of the accumulated value.", 0, "application", { probe: `(${lit(cpn)}*${sExpr(t, k)})` }),
          ]),
    ];
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { values: [{ label: "AV", expr: truth }], description: `Each coupon accumulated term by term at the reinvestment rate to ${sale ? "the sale date, plus the sale price at the new yield" : "maturity, plus the redemption payment"}.` },
      steps: [
        { concept: "bond.reinvestment", reasoning: `Coupons of $${mamt(cpn)}$ are reinvested at ${level === 3 ? "$k = (1 + i)^{1/2} - 1$ per half-year" : `${pc(k)} per period`} until ${sale ? "the sale" : "maturity"}: $${mamt(cpn)}\\,s_{\\overline{${t}|}}$.` },
        ...(sale ? [{ concept: "bond.book-vs-market", reasoning: "The sale price is the market value: the PV of the remaining payments at the yield prevailing at the sale." }] : [{ concept: "bond.face-redemption", reasoning: "At maturity the redemption payment is added to the accumulated coupons." }]),
        ...(level >= 2 ? [{ concept: "bond.terms", reasoning: "All rates are converted to the half-year coupon period." }] : []),
      ],
      conditions: ["Coupons reinvested on receipt at one rate.", sale ? "Sale immediately after a coupon at the market yield." : "Bond held to maturity."],
      relationship: sale ? "$AV_t = Fr\\,s_{\\overline{t|}\\,k} + \\bigl(Fr\\,a_{\\overline{n-t|}\\,j'} + Cv_{j'}^{n-t}\\bigr)$" : "$AV_n = Fr\\,s_{\\overline{n|}\\,k} + C$",
      counterexample: "If coupons are reinvested at the purchase yield, the accumulated value at maturity is simply $P(1+j)^n$.",
      transfer: {
        principle: "Value every cash flow at the valuation date with the rate it actually earns: coupons at $k$, the bond itself at the yield relevant to that date.",
        unusual: "Three rates appear and each belongs to a different piece.",
        misread: "The purchase price does not grow at the reinvestment rate.",
      },
      itemFormat: "expression-selection",
      presentation: levelTags(level, ["frequency", ...(sale ? (["valuation-date"] as Presentation[]) : [])], ["frequency", "valuation-date", "hidden-structure"]),
      features: { multipleValuationDates: sale, unfamiliar: level >= 2 || sale },
      modelingDecisions: level === 3 ? 2 : undefined,
      params: { F, years, r, y, kA, y2, t, variant },
    });
  },
});

const reinvestDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-bond-reinvest-diagnosis",
  family: "con-bond-reinvestment",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.reinvestment",
  secondary: ["BONDS.yield"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "relationships"],
  reasoning: ["validation", "cashflow_modelling", "financial_intuition"],
  soaConcept: "Diagnosing a reinvestment error: coupons reinvested at the yield when told otherwise, or a return averaged instead of compounded.",
  variants: 2,
  generate(rng, level, variant) {
    const semi = level === 2;
    const m = semi ? 2 : 1;
    const F = 1000 * rng.int(1, 5);
    const years = rng.int(8, 20);
    const N = years * m;
    const r = gridRate(rng, 0.04, 0.09, 0.005);
    const y = yieldAway(rng, 0.04, 0.09, r, 0.005);
    const kA = drawUntil(() => gridRate(rng, 0.02, 0.1, 0.005), (x) => Math.abs(x - y) >= 0.01);
    const j = y / m;
    const k = kA / m;
    const cpn = (F * r) / m;
    const P = round2(bondPrice(cpn, 1, F, j, N));
    const couponText = semi ? `semiannual coupons at an annual rate of ${pc(r)}` : `annual coupons at a rate of ${pc(r)}`;
    const rateText = (x: number) => (semi ? `an annual nominal rate of ${pc(x)} convertible semiannually` : `an annual effective rate of ${pc(x)}`);
    const AVtruth = `(${couponAV(cpn, k, N)} + ${lit(F)})`;
    let stem: string;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    if (variant === 0) {
      const proposed = P * Math.pow(1 + j, N);
      stem =
        `A ${years}-year bond with face amount ${mamt(F)} and ${couponText}, redeemable at par, is bought for ${mnum(P, 2)} to yield ${rateText(y)}. Each coupon is reinvested on receipt at ${rateText(kA)}. A candidate calculates the accumulated value at maturity as\n\n$$${mnum(P, 2)}${accS(j, N)} = ${mnum(proposed, 2)}.$$\n\nWhich of the following correctly describes the candidate's calculation?`;
      correct = { content: `It assumes the coupons earn ${pc(j)} per period; at ${pc(k)} the value is $${mamt(cpn)}\\,${sS(N, k)} + ${mamt(F)}$.`, why: `Accumulating the price at the yield is the same as reinvesting every coupon at the yield; here they earn ${pc(k)}.`, check: { expr: `(${lit(cpn)}*${sExpr(N, k)} + ${lit(F)})`, op: "=", than: AVtruth } };
      distractors = [
        opt("It is correct, since a price accumulated at its yield gives the value at maturity.", "CONC_BOND_REALIZED_EQUALS_YIELD", "That holds only when coupons are reinvested at the yield.", 1, "connection", { check: { expr: `(${lit(P)}*(1+${lit(j)})**${N})`, op: "=", than: AVtruth } }),
        opt(`The price should be accumulated at ${pc(k)} per period instead of ${pc(j)}.`, "MODEL_INTEREST_ON_ORIGINAL", "Only the coupons are reinvested; the bond itself pays fixed amounts.", 0, "selection", { check: { expr: `(${lit(P)}*(1+${lit(k)})**${N})`, op: "=", than: AVtruth } }),
        opt(`The value should be ${N} coupons of ${amt2(cpn)} plus ${amt2(F)}, with no interest on coupons.`, "CONC_BOND_COUPONS_NOT_REINVESTED", "Reinvested coupons earn interest until maturity.", 1, "application", { check: { expr: lit(N * cpn + F), op: "=", than: AVtruth } }),
        opt(`The coupons and redemption should be accumulated separately at ${pc(j)} per period.`, "MODEL_REINVEST_AT_YIELD", "That changes the route, not the error: $Fr\\,s_{\\overline{n|}\\,j} + C = P(1+j)^n$.", 1, "selection", { check: { expr: `(${lit(cpn)}*${sExpr(N, j)} + ${lit(F)})`, op: "=", than: AVtruth } }),
        ...(semi ? [opt(`The coupons should be accumulated at ${pc(kA)} per half-year.`, "RATE_ANNUAL_FOR_PERIODIC", "A nominal rate convertible semiannually is halved for each half-year.", 1, "application", { check: { expr: `(${lit(cpn)}*${sExpr(N, kA)} + ${lit(F)})`, op: "=", than: AVtruth } })] : []),
      ];
    } else {
      const AV = round2(cpn * sn(N, k) + F);
      const proposed = (AV / P - 1) / years;
      const truth = `(exp(log(${lit(AV)}/${lit(P)})/${years}) - 1)`;
      const claim = (e: string) => ({ expr: e, op: "=" as const, than: truth });
      stem =
        `A ${years}-year bond with face amount ${mamt(F)} and ${couponText}, redeemable at par, is bought for ${mnum(P, 2)} to yield ${rateText(y)}. With coupons reinvested at ${rateText(kA)}, the investor's accumulated value at maturity is ${mnum(AV, 2)}. A candidate calculates the investor's annual effective rate of return as\n\n$$\\frac{${mnum(AV, 2)}/${mnum(P, 2)} - 1}{${years}} = ${mpc(proposed, 3)}.$$\n\nWhich of the following correctly describes the candidate's calculation?`;
      correct = { content: `Returns compound, so the rate should be $(${mnum(AV, 2)}/${mnum(P, 2)})^{1/${years}} - 1$.`, why: `The annual effective return solves $P(1+i)^{${years}} = AV$: $${mpc(Math.pow(AV / P, 1 / years) - 1, 3)}$.`, check: claim(`((${lit(AV)}/${lit(P)})**(1/${years}) - 1)`) };
      distractors = [
        opt("It is correct, since the total growth is spread evenly over the years.", "MODEL_COMPOUND_AS_SIMPLE", "Spreading total growth evenly is simple interest; an effective rate compounds.", 2, "selection", { check: claim(lit(proposed)) }),
        opt(`The return is ${pc(y)}, the yield at which the bond was bought.`, "CONC_BOND_REALIZED_EQUALS_YIELD", "The purchase yield is realized only if coupons earn it.", 1, "connection", { check: claim(lit(semi ? Math.pow(1 + j, 2) - 1 : y)) }),
        opt(`The base should be the face amount: $(${mnum(AV, 2)}/${mamt(F)})^{1/${years}} - 1$.`, "VAR_FACE_FOR_PRICE", "The return is measured on the amount actually invested, the price.", 2, "interpretation", { check: claim(`((${lit(AV)}/${lit(F)})**(1/${years}) - 1)`) }),
        semi
          ? opt(`The rate should be $(${mnum(AV, 2)}/${mnum(P, 2)})^{1/${N}} - 1$.`, "RATE_ANNUAL_FOR_PERIODIC", "That is the return per half-year, not the annual effective rate.", 2, "application", { check: claim(`((${lit(AV)}/${lit(P)})**(1/${N}) - 1)`) })
          : opt(`The rate should be $(${mnum(AV, 2)}/${mnum(P, 2)})^{1/${years + 1}} - 1$.`, "SEQ_TERM_COUNT", `The money is invested for ${years} years, not ${years + 1}.`, 2, "application", { check: claim(`((${lit(AV)}/${lit(P)})**(1/${years + 1}) - 1)`) }),
      ];
    }
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { description: variant === 0 ? "Coupons accumulated term by term at the reinvestment rate plus the redemption payment." : "The annual effective return that grows the price to the stated accumulated value." },
      steps: [
        { concept: "bond.reinvestment", reasoning: "Coupons grow at the reinvestment rate: $AV = Fr\\,s_{\\overline{n|}\\,k} + C$." },
        { concept: "bond.price-yield", reasoning: "$P(1+j)^n = Fr\\,s_{\\overline{n|}\\,j} + C$ assumes reinvestment at the purchase yield." },
        { concept: "bond.yield-definition", reasoning: "The realized annual effective return solves $P(1+i)^n = AV$." },
      ],
      conditions: ["Coupons reinvested on receipt at one rate.", "Bond held to maturity."],
      relationship: "$AV = Fr\\,s_{\\overline{n|}\\,k} + C$, realized return $= (AV/P)^{1/n} - 1$.",
      counterexample: "If $k = j$, the candidate's accumulated value would be right.",
      transfer: {
        principle: "Separate what the bond pays from what the coupons earn after they are paid.",
        unusual: "A worked solution is judged rather than produced.",
        misread: "A ‘yield’ is a pricing rate; the realized return depends on reinvestment.",
      },
      itemFormat: "error-diagnosis",
      presentation: semi ? ["frequency", "indirect-wording"] : ["direct"],
      features: { unfamiliar: semi },
      params: { F, years, r, y, kA, variant },
    });
  },
});

// ================================================================ BONDS.callable

interface CallSetup {
  F: number;
  m: number;
  n: number;
  r: number;
  y: number;
  j: number;
  cpn: number;
  a: number;
  last: number;
  dates: number[];
  callPrice: (year: number) => number;
  priceTo: (year: number) => string;
  value: (year: number) => number;
  minYear: number;
  minValue: number;
}

/** A bond callable on coupon dates from year `a` through year `last`, maturing at year `n`. */
function callSetup(F: number, m: number, n: number, r: number, y: number, a: number, last: number, callPrice: (year: number) => number): CallSetup {
  const j = y / m;
  const cpn = (F * r) / m;
  const dates: number[] = [];
  for (let t = a; t <= last; t += 1 / m) dates.push(Number(t.toFixed(4)));
  dates.push(n);
  const value = (year: number) => bondPrice(cpn, 1, year === n ? F : callPrice(year), j, Math.round(year * m));
  const priceTo = (year: number) => priceE(cpn, year === n ? F : callPrice(year), j, Math.round(year * m));
  let minYear = dates[0];
  for (const d of dates) if (value(d) < value(minYear)) minYear = d;
  return { F, m, n, r, y, j, cpn, a, last, dates, callPrice, priceTo, value, minYear, minValue: value(minYear) };
}

const callDate: ChoiceTemplate = conceptTemplate({
  id: "con-bond-call-date",
  family: "con-bond-callable",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.callable",
  secondary: ["BONDS.price_redemption"],
  itemFormat: "applicability",
  conceptFamily: "applicability",
  dimensions: ["applicability", "conditions"],
  reasoning: ["concept_recognition", "financial_intuition"],
  soaConcept: "Which redemption date to assume when pricing a callable bond to guarantee a yield.",
  variants: 2,
  generate(rng, level, variant) {
    const premium = variant === 0;
    const m = level === 2 ? 2 : 1;
    const F = 1000 * rng.int(1, 5);
    const n = rng.int(15, 25);
    const a = rng.int(5, 9);
    const last = n - 1;
    const r = gridRate(rng, 0.05, 0.09, 0.005);
    const y = drawUntil(() => gridRate(rng, 0.03, 0.11, 0.005), (x) => (premium ? r - x >= 0.01 : x - r >= 0.01));
    const s = callSetup(F, m, n, r, y, a, last, () => F);
    const mid = Math.round((a + last) / 2);
    const expect = drawUntil(() => rng.int(a + 1, last - 1), (x) => x !== mid);
    const atMost = (year: number) => ({ expr: s.priceTo(year), op: "<=" as const, than: lit(s.minValue) });
    const couponText = m === 2 ? `semiannual coupons at an annual rate of ${pc(r)}` : `annual coupons at a rate of ${pc(r)}`;
    const yText = m === 2 ? `an annual nominal rate of ${pc(y)} convertible semiannually` : `an annual effective rate of ${pc(y)}`;
    const stem =
      `A bond with face amount ${mamt(F)} pays ${couponText} and matures at par at the end of ${n} years. The issuer may call it at par on any coupon date from the end of year ${a} through the end of year ${last}.${level === 2 ? ` The issuer has said it expects to call the bond at the end of year ${expect}.` : ""} An investor wants to be certain of a yield of at least ${yText}.\n\nDetermine which redemption date the investor should assume in setting the price.`;
    const dateOpt = (year: number, why: string) => `The end of year ${year}, ${why}`;
    const correctYear = premium ? a : n;
    const all: ConceptOption[] = premium
      ? [
          opt(dateOpt(last, "the last call date"), "MODEL_WRONG_CALL_DATE", "For a premium bond the earliest redemption is the investor's worst case.", 2, "conclusion", { check: atMost(last), conditionTrue: "The latest date is the worst case for a discount bond." }),
          opt(dateOpt(n, "the maturity date of the bond"), "CONC_BOND_CALL_IGNORED", "The call lets the issuer repay early, which hurts a premium-bond holder.", 0, "recognition", { check: atMost(n) }),
          opt(dateOpt(mid, "the middle of the call period"), "CONC_BOND_CALL_AVERAGE", "A guarantee must hold for every date, not on average.", 1, "application", { check: atMost(mid) }),
          ...(level === 2 ? [opt(dateOpt(expect, "the date the issuer expects to call"), "TRANS_IRRELEVANT_INFO", "An expectation is not a guarantee; the issuer may call on any date.", 1, "application", { check: atMost(expect) })] : []),
        ]
      : [
          opt(dateOpt(a, "the earliest call date"), "MODEL_WRONG_CALL_DATE", "For a discount bond the latest redemption is the investor's worst case.", 2, "conclusion", { check: atMost(a), conditionTrue: "The earliest date is the worst case for a premium bond." }),
          opt(dateOpt(last, "the last call date"), "TIMING_MISSING_PERIOD", "The bond may also run to maturity, one year later, which is worse still.", 1, "application", { check: atMost(last) }),
          opt(dateOpt(mid, "the middle of the call period"), "CONC_BOND_CALL_AVERAGE", "A guarantee must hold for every date, not on average.", 1, "application", { check: atMost(mid) }),
          ...(level === 2 ? [opt(dateOpt(expect, "the date the issuer expects to call"), "TRANS_IRRELEVANT_INFO", "An expectation is not a guarantee; the issuer may call on any date.", 1, "application", { check: atMost(expect) })] : []),
        ];
    all.push(opt("Whichever possible date gives the highest price, to protect the investor", "CONC_DIRECTION_REVERSED", "The highest price gives the lowest yield on other dates; the guarantee needs the lowest price.", 2, "conclusion", { check: { expr: lit(Math.max(...s.dates.map(s.value))), op: "<=", than: lit(s.minValue) } }));
    return conceptQuestion({
      stem,
      correct: { content: premium ? dateOpt(a, "the earliest call date") : dateOpt(n, "the maturity date of the bond"), why: premium ? "The bond is at a premium, which is lost fastest if it is repaid early: the earliest call gives the lowest price." : "The bond is at a discount, whose gain is received latest at maturity: that date gives the lowest price.", check: atMost(correctYear) },
      distractors: all,
      reference: { description: "The price to every possible redemption date is computed; the guaranteed-yield price is the minimum." },
      steps: [
        { concept: "bond.premium-discount", reasoning: `Coupon rate ${pc(r)} ${premium ? "exceeds" : "is below"} the yield ${pc(y)}, so priced to any date the bond is at a ${premium ? "premium" : "discount"}.` },
        { concept: "bond.callable", reasoning: "The issuer chooses the date, so the investor must price to the date that gives the lowest price." },
        { concept: "bond.yield-to-call", reasoning: premium ? "A premium is recovered through coupons over time; early redemption leaves the least time." : "A discount is gained at redemption; the later it comes, the lower its present value." },
      ],
      conditions: ["Call price equals par on every call date.", "The investor needs a yield guaranteed whatever the issuer does."],
      relationship: "Guaranteed-yield price $= \\min_t \\bigl[C + (Fr - Cj)a_{\\overline{t|}}\\bigr]$ over all possible redemption dates $t$.",
      counterexample: "If call prices differ between dates, the earliest date need not be the worst case even for a premium bond.",
      transfer: {
        principle: "When someone else chooses the date, price for the date that is worst for you.",
        unusual: "The answer is a date, not an amount.",
        misread: "The issuer's stated expectation is not a commitment.",
      },
      itemFormat: "applicability",
      presentation: level === 2 ? ["irrelevant-info", "frequency"] : ["direct"],
      features: { unfamiliar: level === 2 },
      params: { F, n, a, r, y, variant },
    });
  },
});

const callStatements: ChoiceTemplate = conceptTemplate({
  id: "con-bond-call-statements",
  family: "con-bond-callable",
  topic: "BONDS",
  levels: [2, 3],
  objective: "BONDS.callable",
  secondary: ["BONDS.yield"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["relationships", "conditions"],
  soaConcept: "Statements about yield to call, yield to maturity and the guaranteed-yield price of a callable bond.",
  variants: 2,
  generate(rng, level, variant) {
    const F = 1000 * rng.int(1, 5);
    const n = rng.int(12, 20);
    const a = rng.int(4, 6);
    const last = n - 1;
    const r = gridRate(rng, 0.05, 0.09, 0.005);
    const premiumBond = level === 3 ? true : rng.int(0, 1) === 1;
    const y = drawUntil(() => gridRate(rng, 0.03, 0.11, 0.005), (x) => (premiumBond ? r - x >= 0.01 : x - r >= 0.01));
    const b = level === 3 ? a + rng.int(2, 4) : a;
    const cp = level === 3 ? 0.05 * rng.int(1, 2) : 0;
    const s = callSetup(F, 1, n, r, y, a, last, (yr) => (yr <= b && level === 3 ? F * (1 + cp) : F));
    const Pmin = lit(s.minValue);
    const Pa = s.priceTo(a);
    const Pn = s.priceTo(n);
    const callText = level === 3
      ? `It may be called at ${mamt(F * (1 + cp))} on any coupon date from the end of year ${a} through the end of year ${b}, and at par on any coupon date from the end of year ${b + 1} through the end of year ${last}.`
      : `It may be called at par on any coupon date from the end of year ${a} through the end of year ${last}.`;
    let statements: StatementSpec[];
    let stem: string;
    if (variant === 0) {
      stem = `A bond with face amount ${mamt(F)} pays annual coupons at a rate of ${pc(r)} and matures at par at the end of ${n} years. ${callText} It is bought at the highest price that guarantees the investor an annual effective yield of at least ${pc(y)}.\n\nDetermine which of the following statements are true.`;
      const iTrue = s.value(a) <= s.minValue + 1e-9;
      const iiTrue = s.value(n) > s.minValue + 1e-6;
      statements = [
        { key: "I", text: `The price is the present value at ${pc(y)} of the payments up to and including a call at the end of year ${a}.`, truth: iTrue, justification: iTrue ? `Year ${a} gives the lowest price of all possible dates.` : `Year ${s.minYear} gives a lower price than year ${a}, so year ${a} is not the worst case.`, misconception: level === 3 ? "CONC_OUTSIDE_ASSUMPTIONS" : "MODEL_WRONG_CALL_DATE", check: { expr: Pa, op: "<=", than: Pmin }, stage: 1, failure: "application" },
        { key: "II", text: "If the bond is not called, the investor's yield exceeds the guaranteed yield.", truth: iiTrue, justification: iiTrue ? `Priced at the minimum, the bond is cheaper than its price to maturity at ${pc(y)}, so held to maturity it yields more.` : "The price is the price to maturity, so held to maturity it yields exactly the guaranteed rate.", misconception: "CONC_BOND_CALL_IGNORED", check: { expr: Pn, op: ">", than: Pmin }, stage: 2, failure: "connection" },
        { key: "III", text: `If the bond is called at the end of year ${a}, the investor's yield is less than ${pc(y)}.`, truth: false, justification: "The price is at most the price to every possible date, so every redemption date yields at least the guaranteed rate.", misconception: "CONC_DIRECTION_REVERSED", check: { expr: Pa, op: "<", than: Pmin }, stage: 2, failure: "conclusion" },
      ];
    } else {
      const P = s.value(n);
      stem = `A bond with face amount ${mamt(F)} pays annual coupons at a rate of ${pc(r)} and matures at par at the end of ${n} years. ${callText} An investor pays ${mnum(P, 2)}, the price that gives an annual effective yield of ${pc(y)} if the bond is held to maturity.\n\nDetermine which of the following statements are true.`;
      const certain = P <= s.minValue + 1e-6;
      const PnE = lit(P);
      statements = [
        { key: "I", text: `The investor is certain to earn an annual effective yield of at least ${pc(y)}.`, truth: certain, justification: certain ? "Maturity is the worst case here, so every earlier redemption yields more." : `A redemption at the end of year ${s.minYear} would yield less, because the price exceeds the price to that date.`, misconception: "CONC_BOND_CALL_IGNORED", check: { expr: PnE, op: "<=", than: Pmin }, stage: 1, failure: "application" },
        { key: "II", text: `If the bond is called at the end of year ${a}, the investor's yield exceeds ${pc(y)}.`, truth: s.value(a) > P + 1e-6, justification: s.value(a) > P ? `At ${pc(y)} the payments to year ${a} are worth more than the price paid, so the yield to that call exceeds ${pc(y)}.` : `At ${pc(y)} the payments to year ${a} are worth less than the price paid, so the yield to that call is below ${pc(y)}.`, misconception: "CONC_DIRECTION_REVERSED", check: { expr: Pa, op: ">", than: PnE }, stage: 2, failure: "conclusion" },
        { key: "III", text: `A lower price would be needed to guarantee a yield of ${pc(y)}.`, truth: !certain, justification: certain ? "The price paid already guarantees the yield." : `The guaranteed-yield price is the minimum, ${mnum(s.minValue, 2)}.`, misconception: "MODEL_WRONG_CALL_DATE", check: { expr: PnE, op: ">", than: Pmin }, stage: 1, failure: "selection" },
      ];
    }
    return statementQuestion({
      stem,
      statements,
      extra: multiFlipExtras(statements, "CONC_BOND_CALL_AVERAGE", 2),
      steps: [
        { concept: "bond.premium-discount", reasoning: `Compare each coupon with interest on the redemption amount at ${pc(y)} to see whether early redemption helps or hurts.` },
        { concept: "bond.callable", reasoning: "The guaranteed-yield price is the lowest of the prices to all possible redemption dates." },
        { concept: "bond.yield-to-call", reasoning: "At a given price, a redemption date whose price at the yield exceeds that price yields more than the yield, and vice versa." },
        ...(level === 3 ? [{ concept: "bond.face-redemption", reasoning: `Call prices differ by date (${mamt(F * (1 + cp))} early, par later), so the earliest date need not be the worst.` }] : []),
      ],
      conditions: ["The issuer may redeem on any listed date.", "Annual effective yields."],
      relationship: "Guaranteed-yield price $= \\min_t P_t$; yield to date $t$ exceeds $j$ exactly when $P_t(j) > P$.",
      counterexample: "With equal call prices, a premium bond's worst case is the earliest call and a discount bond's is maturity.",
      transfer: {
        principle: "Compare the price paid with the price to each date at the target yield; the sign tells you whether that date yields more or less.",
        unusual: "Yields to several dates are compared without computing any of them.",
        misread: level === 3 ? "A call premium on early dates can move the worst case later." : "The issuer's option works against the investor.",
      },
      presentation: levelTags(level, ["compare-streams"], ["compare-streams", "hidden-structure"]),
      features: { unfamiliar: true, steps: level === 3 ? 4 : 3 },
      modelingDecisions: level === 3 ? 2 : undefined,
      params: { F, n, a, b, cp, r, y, variant },
    });
  },
});

const callDiagnosis: ChoiceTemplate = conceptTemplate({
  id: "con-bond-call-diagnosis",
  family: "con-bond-callable",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.callable",
  secondary: ["BONDS.price_redemption"],
  itemFormat: "error-diagnosis",
  conceptFamily: "error-diagnosis",
  dimensions: ["error_recognition", "applicability"],
  reasoning: ["validation", "concept_recognition", "financial_intuition"],
  soaConcept: "Diagnosing a callable bond priced to the wrong redemption date.",
  variants: 2,
  generate(rng, level, variant) {
    const premium = variant === 0;
    const m = level === 2 ? 2 : 1;
    const F = 1000 * rng.int(1, 5);
    const n = rng.int(14, 22);
    const a = rng.int(5, 8);
    const last = n - 1;
    const r = gridRate(rng, 0.05, 0.09, 0.005);
    const premiumSchedule = level === 3 && premium;
    let b = a;
    let cp = 0;
    let y = 0;
    let s!: CallSetup;
    drawUntil(
      () => {
        y = drawUntil(() => gridRate(rng, 0.03, 0.11, 0.005), (x) => (premium ? r - x >= 0.01 : x - r >= 0.01));
        b = premiumSchedule ? a + rng.int(2, 5) : a;
        cp = premiumSchedule ? 0.05 * rng.int(1, 3) : 0;
        s = callSetup(F, m, n, r, y, a, last, (yr) => (premiumSchedule && yr <= b ? F * (1 + cp) : F));
        return s;
      },
      (st) => !premiumSchedule || (st.minYear === b + 1 && st.value(a) - st.minValue > 0.002 * F && st.value(b) - st.minValue > 0.002 * F)
    );
    const isMin = (yr: number) => ({ expr: s.priceTo(yr), op: "=" as const, than: lit(s.minValue) });
    const mid = Math.round((a + last) / 2);
    const couponText = m === 2 ? `semiannual coupons at an annual rate of ${pc(r)}` : `annual coupons at a rate of ${pc(r)}`;
    const yText = m === 2 ? `an annual nominal rate of ${pc(y)} convertible semiannually` : `an annual effective rate of ${pc(y)}`;
    const callText = premiumSchedule
      ? `It may be called at ${mamt(F * (1 + cp))} on any coupon date from the end of year ${a} through the end of year ${b}, and at par on any coupon date from the end of year ${b + 1} through the end of year ${last}.`
      : `It may be called at par on any coupon date from the end of year ${a} through the end of year ${last}.`;
    const candYear = premiumSchedule ? a : premium ? n : a;
    const candPrice = s.value(candYear);
    const stem =
      `A bond with face amount ${mamt(F)} pays ${couponText} and matures at par at the end of ${n} years. ${callText}${level === 3 && !premium ? ` Market commentators expect a call at the end of year ${mid}.` : ""} A candidate calculates the price that guarantees ${yText} by pricing the bond to the end of year ${candYear}, obtaining ${mnum(candPrice, 2)}.\n\nWhich of the following correctly describes the candidate's calculation?`;
    let correct: ConceptOption;
    let distractors: ConceptOption[];
    if (premiumSchedule) {
      correct = { content: `Price to the end of year ${b + 1}, the first date the bond is callable at par.`, why: `The call premium makes early calls costlier for the issuer; comparing all dates, year ${b + 1} gives the lowest price, $${mnum(s.minValue, 2)}$.`, check: isMin(b + 1) };
      distractors = [
        opt("It is correct, since a premium bond is always priced to its earliest call date.", "CONC_OUTSIDE_ASSUMPTIONS", "That rule assumes equal call prices; here early calls pay a call premium.", 1, "application", { check: isMin(a), conditionTrue: "Correct if every call price were par." }),
        opt(`The date is right, but the redemption amount at year ${a} should be ${amt2(F)}.`, "CONC_BOND_REDEMPTION_AS_FACE", `A call at year ${a} pays ${amt2(F * (1 + cp))}, not par.`, 0, "interpretation", { check: { expr: priceE(s.cpn, F, s.j, a * m), op: "=", than: lit(s.minValue) } }),
        opt(`Price to the end of year ${n}, since the bond may never be called.`, "MODEL_WRONG_CALL_DATE", "For a premium bond, maturity gives the highest price, not the lowest.", 2, "conclusion", { check: isMin(n) }),
        opt(`Price to the end of year ${b}, the last date with a call premium.`, "TIMING_BALANCE_INDEX", `The call premium still applies at year ${b}; the price to year ${b + 1} is lower.`, 1, "application", { check: isMin(b) }),
        opt(`Price to the end of year ${mid}, the middle of the call period.`, "CONC_BOND_CALL_AVERAGE", "A guarantee must hold for every date.", 1, "application", { check: isMin(mid) }),
      ];
    } else if (premium) {
      correct = { content: `Price to the end of year ${a}, the earliest call, since the bond is at a premium.`, why: `Early repayment cuts off the coupons that recover the premium: year ${a} gives the lowest price, $${mnum(s.minValue, 2)}$.`, check: isMin(a) };
      distractors = [
        opt("It is correct, since the issuer is not obliged to call the bond.", "CONC_BOND_CALL_IGNORED", "The investor must allow for the issuer calling on the worst date.", 0, "recognition", { check: isMin(n) }),
        opt(`Price to the end of year ${mid}, the middle of the call period.`, "CONC_BOND_CALL_AVERAGE", "A guarantee must hold for every date.", 1, "application", { check: isMin(mid) }),
        opt(`Price to the end of year ${last}, the last call date.`, "MODEL_WRONG_CALL_DATE", "For a premium bond, later dates give higher prices.", 2, "conclusion", { check: isMin(last) }),
        opt("Price at the coupon rate, so that the redemption date does not matter.", "CONC_BOND_YIELD_IS_COUPON_RATE", "The investor needs the stated yield; at the coupon rate the price is simply par.", 1, "selection", { check: { expr: lit(F), op: "=", than: lit(s.minValue) } }),
      ];
    } else {
      correct = { content: `Price to the end of year ${n}, maturity, since the bond is at a discount.`, why: `The discount is gained at redemption; the latest redemption gives the lowest price, $${mnum(s.minValue, 2)}$.`, check: isMin(n) };
      distractors = [
        opt("It is correct, since callable bonds are priced to their earliest call date.", "CONC_OUTSIDE_ASSUMPTIONS", "That rule applies to premium bonds; for a discount bond early redemption helps the investor.", 1, "application", { check: isMin(a), conditionTrue: "Correct for a premium bond with equal call prices." }),
        opt(`Price to the end of year ${mid}, the middle of the call period.`, "CONC_BOND_CALL_AVERAGE", "A guarantee must hold for every date.", 1, "application", { check: isMin(mid) }),
        opt(`Price to the end of year ${last}, the last call date.`, "TIMING_MISSING_PERIOD", `The bond may run to year ${n}, which gives an even lower price.`, 1, "application", { check: isMin(last) }),
        opt("Price at the coupon rate, so that the redemption date does not matter.", "CONC_BOND_YIELD_IS_COUPON_RATE", "The investor needs the stated yield; at the coupon rate the price is simply par.", 1, "selection", { check: { expr: lit(F), op: "=", than: lit(s.minValue) } }),
        ...(level === 3 ? [opt(`Price to the end of year ${mid}, when a call is expected.`, "TRANS_IRRELEVANT_INFO", "An expected call is not a guarantee.", 1, "application", { check: isMin(mid) })] : []),
      ];
    }
    return conceptQuestion({
      stem,
      correct,
      distractors,
      reference: { description: "The price to every possible redemption date (with its call price) is computed; the guaranteed-yield price is the minimum, and each proposed date is checked against it." },
      steps: [
        { concept: "bond.premium-discount", reasoning: `Coupon rate ${pc(r)} versus yield ${pc(y)}: the bond is at a ${premium ? "premium" : "discount"} to par.` },
        { concept: "bond.callable", reasoning: "The guaranteed-yield price is the lowest price over all possible redemption dates." },
        ...(premiumSchedule
          ? [
              { concept: "bond.face-redemption", reasoning: `Calls up to year ${b} pay ${amt2(F * (1 + cp))}; the extra redemption amount raises those prices.` },
              { concept: "bond.yield-to-call", reasoning: `Within each call-price segment the earliest date is lowest for a premium bond; compare years ${a} and ${b + 1}.` },
            ]
          : [{ concept: "bond.yield-to-call", reasoning: premium ? "Premium: the earliest redemption is worst for the investor." : "Discount: the latest redemption is worst for the investor." }]),
      ],
      conditions: ["The issuer chooses the redemption date.", "The investor requires the yield on every possible date."],
      relationship: "Guaranteed-yield price $= \\min_t \\bigl[C_t + (Fr - C_t j)a_{\\overline{t|}}\\bigr]$ over redemption dates $t$ with call prices $C_t$.",
      counterexample: "With level call prices, a premium bond's worst case is always the earliest call.",
      transfer: {
        principle: "Price every candidate date and take the smallest; shortcuts hold only when call prices are level.",
        unusual: "A worked solution is judged rather than produced.",
        misread: "The rule ‘premium → earliest call’ assumes equal call prices.",
      },
      itemFormat: "error-diagnosis",
      presentation: levelTags(level, ["frequency", "indirect-wording"], premiumSchedule ? ["hidden-structure", "compare-streams"] : ["irrelevant-info", "compare-streams"]),
      features: { unfamiliar: level >= 2 },
      modelingDecisions: level === 3 ? 2 : undefined,
      params: { F, n, a, b, cp, r, y, variant },
    });
  },
});

// ================================================================ BONDS.terms

const termsCashflows: ChoiceTemplate = conceptTemplate({
  id: "con-bond-terms-cashflows",
  family: "con-bond-terms",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.terms",
  secondary: ["BONDS.coupons"],
  itemFormat: "definition",
  conceptFamily: "definition",
  dimensions: ["terminology", "interpretation"],
  soaConcept: "Translating a bond's quoted terms into its cash flows, and back.",
  variants: 2,
  generate(rng, level, variant) {
    const m = level === 2 ? 4 : 2;
    const per = m === 4 ? "every three months" : "every six months";
    const payable = m === 4 ? "quarterly" : "semiannually";
    const F = 1000 * rng.int(1, 5);
    const n = rng.int(5, 15);
    const r = gridRate(rng, 0.04, 0.1, 0.005);
    const C = F * (1 + 0.05 * rng.int(1, 3));
    const X = (F * r) / m;
    const steps = [
      { concept: "bond.terms", reasoning: `An annual coupon rate payable ${payable} gives $Fr/${m}$ ${per}, ${m * n} coupons in ${n} years.` },
      { concept: "bond.face-redemption", reasoning: "Coupons are based on the face amount; the redemption value is paid at maturity with the last coupon." },
    ];
    const common = {
      steps,
      conditions: ["Coupon rates are nominal annual rates.", "Coupons are based on face."],
      relationship: `Coupon $= Fr/${m}$ per period for ${m}n periods; final payment $C$ besides the last coupon.`,
      counterexample: "With annual coupons and redemption at par, the coupon is $Fr$ and the final payment $F$.",
      transfer: {
        principle: "Translate every quoted rate to the payment period before writing cash flows.",
        unusual: "Several numbers in the description play different roles.",
        misread: "A coupon rate ‘payable quarterly’ is still an annual rate.",
      },
      params: { F, n, r, C, m, variant },
    };
    if (variant === 0) {
      return conceptQuestion({
        ...common,
        stem: `A ${n}-year bond with face amount ${mamt(F)} has coupons at an annual rate of ${pc(r)} payable ${payable} and is redeemable at ${mamt(C)}.\n\nDetermine which of the following describes the bond's payments.`,
        correct: { content: `${m * n} payments of ${amt2(X)}, one ${per}, and ${amt2(C)} at the end of year ${n}`, why: `Each coupon is $${mamt(F)} \\times ${mpc(r)}/${m} = ${mamt(X)}$; the redemption value $${mamt(C)}$ is paid with the last coupon.` },
        distractors: [
          opt(`${m * n} payments of ${amt2(F * r)}, one ${per}, and ${amt2(C)} at the end of year ${n}`, "RATE_ANNUAL_FOR_PERIODIC", `The annual coupon is split into ${m} payments.`, 0, "interpretation", { confusedWith: "bond.terms" }),
          opt(`${m * n} payments of ${amt2((C * r) / m)}, one ${per}, and ${amt2(C)} at the end of year ${n}`, "CONC_BOND_COUPON_ON_REDEMPTION", "Coupons are based on face, not on the redemption value.", 1, "interpretation", { confusedWith: "bond.face-redemption" }),
          opt(`${m * n} payments of ${amt2(X)}, one ${per}, and ${amt2(F)} at the end of year ${n}`, "CONC_BOND_REDEMPTION_AS_FACE", `The bond is redeemable at ${amt2(C)}.`, 1, "interpretation"),
          opt(`${n} payments of ${amt2(X)}, one at each year end, and ${amt2(C)} at the end of year ${n}`, "SEQ_TERM_COUNT", `Coupons are paid ${payable}, ${m * n} times in all.`, 0, "application"),
          opt(`${m * n} payments of ${amt2(round2(F * (Math.pow(1 + r, 1 / m) - 1)))}, one ${per}, and ${amt2(C)} at the end of year ${n}`, "RATE_NOMINAL_AS_EFFECTIVE", "A coupon rate is nominal: divide by the number of payments, do not take a root.", 0, "interpretation"),
        ],
        itemFormat: "definition",
        presentation: level === 2 ? ["frequency"] : ["direct"],
        features: { unfamiliar: level === 2 },
      });
    }
    return conceptQuestion({
      ...common,
      stem: `A bond with face amount ${mamt(F)} pays ${mamt(X)} ${per} for ${n} years, and ${mamt(C)} together with the last of these payments.\n\nDetermine which of the following describes the bond.`,
      correct: { content: `Coupon rate ${pc(r)} payable ${payable}, redeemable at ${amt2(C)}`, why: `${m} coupons of $${mamt(X)}$ a year on face $${mamt(F)}$ is an annual rate of ${pc(r)}; the extra final amount is the redemption value.` },
      distractors: [
        opt(`Coupon rate ${pc(r / m)} payable ${payable}, redeemable at ${amt2(C)}`, "RATE_ANNUAL_FOR_PERIODIC", `That is the rate per period; the quoted coupon rate is annual, ${m} times it.`, 0, "interpretation"),
        opt(`Coupon rate ${pc((m * X) / C, 3)} payable ${payable}, redeemable at ${amt2(C)}`, "CONC_BOND_COUPON_ON_REDEMPTION", "The coupon rate is measured against face, not the redemption value.", 1, "interpretation", { conditionTrue: "That ratio is the modified coupon rate, not the coupon rate." }),
        opt(`Coupon rate ${pc(r)} payable ${payable}, redeemable at par`, "CONC_BOND_REDEMPTION_AS_FACE", `The final amount ${amt2(C)} differs from face.`, 1, "interpretation"),
        opt(`Coupon rate ${pc(Math.pow(1 + X / F, m) - 1, 3)} payable ${payable}, redeemable at ${amt2(C)}`, "RATE_NOMINAL_AS_EFFECTIVE", "Coupon rates are quoted as nominal rates, not compounded.", 0, "interpretation"),
        opt(`Coupon rate ${pc(r)} payable ${payable}, redeemable at ${amt2(C + X)}`, "CONC_DOUBLE_COUNTED", "The last coupon is paid in addition to the redemption value, not as part of it.", 1, "interpretation"),
      ],
      itemFormat: "interpretation",
      presentation: level === 2 ? ["inverse", "frequency"] : ["inverse"],
      features: { unfamiliar: true },
    });
  },
});

const termsYieldExpr: ChoiceTemplate = conceptTemplate({
  id: "con-bond-terms-yield-expr",
  family: "con-bond-terms",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.terms",
  secondary: ["BONDS.price_redemption"],
  itemFormat: "expression-selection",
  conceptFamily: "notation",
  dimensions: ["rate_conversion", "equation_construction"],
  reasoning: ["translation", "formula_selection"],
  soaConcept: "Pricing a semiannual-coupon bond to a yield requirement quoted on another basis.",
  variants: 2,
  generate(rng, level, variant) {
    const F = 1000 * rng.int(1, 5);
    const n = rng.int(5, 15);
    const N = 2 * n;
    const r = gridRate(rng, 0.04, 0.09, 0.005);
    const C = F * (1 + 0.05 * rng.int(1, 3));
    const cpn = (F * r) / 2;
    type Rate = { j: number; shown: string; id?: MisconceptionId; why?: string };
    let q: string;
    let truthJ: Rate;
    let wrong: Rate[];
    let concept2: string;
    if (level === 1) {
      const y = gridRate(rng, 0.03, 0.1, 0.005);
      q = variant === 0 ? `an annual nominal rate of ${pc(y)} convertible semiannually` : `a return of ${pc(y)} per year compounded semiannually`;
      truthJ = { j: y / 2, shown: `${dj(y)}/2` };
      wrong = [
        { j: y, shown: dj(y), id: "RATE_ANNUAL_FOR_PERIODIC", why: "A nominal annual rate is halved for each half-year." },
        { j: Math.pow(1 + y, 0.5) - 1, shown: `(${dj(1 + y)})^{1/2} - 1`, id: "RATE_NOMINAL_AS_EFFECTIVE", why: "The rate is nominal convertible semiannually, not annual effective." },
      ];
      concept2 = "tvm.nominal-vs-effective";
    } else if (level === 2) {
      if (variant === 0) {
        const i = gridRate(rng, 0.03, 0.1, 0.005);
        q = `an annual effective rate of ${pc(i)}`;
        truthJ = { j: Math.pow(1 + i, 0.5) - 1, shown: `(${dj(1 + i)})^{1/2} - 1` };
        wrong = [
          { j: i / 2, shown: `${dj(i)}/2`, id: "RATE_DIVIDED_EFFECTIVE", why: "An effective rate converts by a root, not by halving." },
          { j: Math.pow(1 + i, 2) - 1, shown: `(${dj(1 + i)})^{2} - 1`, id: "ALG_ROOT_ERROR", why: "A half-year is half a year: use the power $1/2$, not $2$." },
          { j: i, shown: dj(i), id: "RATE_ANNUAL_FOR_PERIODIC", why: "The annual rate cannot be used for each half-year." },
        ];
      } else {
        const i4 = gridRate(rng, 0.03, 0.1, 0.005);
        q = `an annual nominal rate of ${pc(i4)} convertible quarterly`;
        truthJ = { j: Math.pow(1 + i4 / 4, 2) - 1, shown: `(1 + ${dj(i4)}/4)^{2} - 1` };
        wrong = [
          { j: i4 / 2, shown: `${dj(i4)}/2`, id: "RATE_NOMINAL_AS_EFFECTIVE", why: "Quarterly conversion compounds twice within each half-year." },
          { j: i4 / 4, shown: `${dj(i4)}/4`, id: "TIMING_MISSING_PERIOD", why: "Each half-year contains two quarters." },
          { j: Math.pow(1 + i4 / 4, 4) - 1, shown: `(1 + ${dj(i4)}/4)^{4} - 1`, id: "RATE_ANNUAL_FOR_PERIODIC", why: "That is the annual effective rate, not the half-year rate." },
        ];
      }
      concept2 = "tvm.nominal-vs-effective";
    } else if (variant === 0) {
      const d = gridRate(rng, 0.03, 0.09, 0.005);
      q = `a force of interest of ${pc(d)}`;
      truthJ = { j: Math.exp(d / 2) - 1, shown: `e^{${dj(d)}/2} - 1` };
      wrong = [
        { j: d / 2, shown: `${dj(d)}/2`, id: "RATE_FORCE_AS_EFFECTIVE", why: "A force of interest accumulates as $e^{\\delta t}$." },
        { j: Math.exp(d) - 1, shown: `e^{${dj(d)}} - 1`, id: "RATE_ANNUAL_FOR_PERIODIC", why: "That is the annual effective rate, not the half-year rate." },
        { j: Math.exp(2 * d) - 1, shown: `e^{2(${dj(d)})} - 1`, id: "ALG_ROOT_ERROR", why: "Half a year at force $\\delta$ accumulates to $e^{\\delta/2}$." },
      ];
      concept2 = "tvm.force-of-interest";
    } else {
      const d = gridRate(rng, 0.03, 0.09, 0.005);
      q = `an annual nominal rate of discount of ${pc(d)} convertible semiannually`;
      truthJ = { j: 1 / (1 - d / 2) - 1, shown: `(1 - ${dj(d)}/2)^{-1} - 1` };
      wrong = [
        { j: d / 2, shown: `${dj(d)}/2`, id: "RATE_DISCOUNT_AS_INTEREST", why: "A discount rate per half-year converts to interest by $j = d/(1-d)$." },
        { j: Math.pow(1 - d / 2, -2) - 1, shown: `(1 - ${dj(d)}/2)^{-2} - 1`, id: "RATE_ANNUAL_FOR_PERIODIC", why: "That is the annual effective rate, not the half-year rate." },
        { j: Math.pow(1 - d, -0.5) - 1, shown: `(1 - ${dj(d)})^{-1/2} - 1`, id: "RATE_NOMINAL_AS_EFFECTIVE", why: "The discount rate is nominal convertible semiannually, not annual effective." },
      ];
      concept2 = "tvm.discount-vs-interest";
    }
    const jj = truthJ.j;
    const expr = (c: number, red: number, rate: number, k = N) => priceE(c, red, rate, k);
    const show = (c: number, red: number, k: number, rate: string) => `${mamt(c)}\\,${aS(k, "j")} + ${mamt(red)}\\,v^{${k}}, \\quad j = ${rate}`;
    const stem =
      variant === 0
        ? `A ${n}-year bond with face amount ${mamt(F)} pays semiannual coupons at an annual rate of ${pc(r)} and is redeemable at ${mamt(C)}. It is priced to yield ${q}.\n\nDetermine which of the following expressions equals the price, where $v = 1/(1+j)$.`
        : `An investor requires ${q} on a bond with face amount ${mamt(F)}, redeemable at ${mamt(C)} in ${n} years, with coupons at an annual rate of ${pc(r)} payable semiannually.\n\nDetermine which of the following expressions equals the most the investor will pay, where $v = 1/(1+j)$.`;
    return conceptQuestion({
      stem,
      correct: { content: math(show(cpn, C, N, truthJ.shown)), why: `Coupons $${mamt(cpn)}$ per half-year for ${N} half-years, redemption $${mamt(C)}$, at the equivalent half-year rate $j = ${truthJ.shown}$.`, probe: expr(cpn, C, jj) },
      distractors: [
        ...wrong.map((w, k) => opt(math(show(cpn, C, N, w.shown)), w.id!, w.why!, 1, "application", { probe: expr(cpn, C, w.j), ...(k === 0 ? { confusedWith: "bond.terms" } : {}) })),
        opt(math(show(cpn, C, n, truthJ.shown)), "SEQ_TERM_COUNT", `${n} years of semiannual coupons is ${N} periods.`, 0, "interpretation", { probe: expr(cpn, C, jj, n) }),
        opt(math(show(cpn, F, N, truthJ.shown)), "CONC_BOND_REDEMPTION_AS_FACE", `The bond is redeemable at ${amt2(C)}.`, 0, "interpretation", { probe: expr(cpn, F, jj) }),
        opt(math(show(F * r, C, N, truthJ.shown)), "CONC_BOND_COUPON_ON_REDEMPTION", "Each semiannual coupon is half the annual coupon.", 0, "interpretation", { probe: expr(F * r, C, jj) }),
      ],
      reference: { values: [{ label: "P", expr: priceTerms(cpn, C, jj, N) }], description: `The price written term by term at the half-year rate equivalent to the quoted yield, $j = ${dj(round2(jj * 1e6) / 1e6)}$.` },
      steps: [
        { concept: "bond.terms", reasoning: `Coupons: $${mamt(cpn)}$ every half-year, ${N} in all; redemption $${mamt(C)}$.` },
        { concept: concept2, reasoning: `Convert the quoted yield to a half-year effective rate: $j = ${truthJ.shown}$.` },
        { concept: "bond.price-yield", reasoning: "Price = PV of coupons and redemption at the per-period yield." },
      ],
      conditions: ["All rates must be per coupon period before discounting.", "Coupons are based on face."],
      relationship: "$P = \\tfrac{Fr}{2}\\,a_{\\overline{2n|}\\,j} + C\\,v_j^{2n}$ with $j$ the half-year effective rate.",
      counterexample: "If the yield were quoted convertible semiannually, $j$ would simply be half the nominal rate.",
      transfer: {
        principle: "Convert the yield requirement to the coupon period first; the price formula never changes.",
        unusual: level === 3 ? "The yield is quoted as a force of interest or a discount rate." : "The yield and the coupons are quoted on different bases.",
        misread: "Halving works only for a rate convertible semiannually.",
      },
      itemFormat: "expression-selection",
      presentation: levelTags(level, ["frequency"], ["frequency", "hidden-structure"]),
      features: { unfamiliar: level >= 2, multiConcept: true },
      modelingDecisions: level === 3 ? 1 : undefined,
      params: { F, n, r, C, variant },
    });
  },
});

const termsStatements: ChoiceTemplate = conceptTemplate({
  id: "con-bond-terms-statements",
  family: "con-bond-terms",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.terms",
  secondary: ["BONDS.coupons", "BONDS.price_redemption"],
  itemFormat: "statement-combination",
  conceptFamily: "statements",
  dimensions: ["terminology", "rate_conversion"],
  soaConcept: "Statements about par, coupon payments, quoted yields and zero-coupon prices.",
  variants: 2,
  generate(rng, level, variant) {
    const F = 1000 * rng.int(1, 5);
    const n = rng.int(5, 15);
    const r = gridRate(rng, 0.04, 0.1, 0.005);
    const y = gridRate(rng, 0.03, 0.1, 0.005);
    const pick = () => rng.int(0, 1) === 1;
    let statements: StatementSpec[];
    let stem: string;
    if (variant === 0) {
      const t1 = pick();
      const t2 = pick();
      const t3 = pick();
      const X = t2 ? (F * r) / 2 : F * r;
      const Z = t3 ? Math.pow(1 + y / 2, 2) - 1 : y + y / 2;
      stem = "Determine which of the following statements are true.";
      statements = [
        { key: "I", text: t1 ? `A bond redeemable at par repays its face amount at maturity, in addition to the final coupon.` : `A bond redeemable at par repays the price paid for it at maturity, in addition to the final coupon.`, truth: t1, justification: "‘At par’ means the redemption value equals the face amount, whatever the price.", misconception: "VAR_FACE_FOR_PRICE", stage: 0, failure: "recognition" },
        { key: "II", text: `A bond with face amount ${mamt(F)} and an annual coupon rate of ${pc(r)} payable semiannually pays ${mamt(X)} every six months.`, truth: t2, justification: `Each coupon is $${mamt(F)} \\times ${mpc(r)}/2 = ${mamt((F * r) / 2)}$.`, misconception: "RATE_ANNUAL_FOR_PERIODIC", check: { expr: lit(X), op: "=", than: `${lit(F)}*${lit(r)}/2` }, stage: 1, failure: "application" },
        { key: "III", text: `A yield of ${pc(y)} convertible semiannually is equivalent to an annual effective yield of ${pc(Z, 4)}.`, truth: t3, justification: `$(1 + ${dj(y)}/2)^2 - 1 = ${mpc(Math.pow(1 + y / 2, 2) - 1, 4)}$.`, misconception: "RATE_NOMINAL_AS_EFFECTIVE", check: { expr: lit(Z), op: "=", than: `((1+${lit(y)}/2)**2 - 1)` }, stage: 1, failure: "application" },
      ];
    } else {
      const C = level === 1 && pick() ? F : F * (1 + 0.05 * rng.int(1, 3));
      const i = gridRate(rng, 0.03, 0.09, 0.005);
      const t1 = pick();
      const Pz = t1 ? C * Math.pow(1 + i, -n) : C / (1 + n * i);
      const t3 = C === F ? true : pick();
      const g = t3 ? (F * r) / C : (C * r) / F;
      stem = `A ${n}-year bond with face amount ${mamt(F)} pays annual coupons at a rate of ${pc(r)} and is ${C === F ? "redeemable at par" : `redeemable at ${mamt(C)}`}.\n\nDetermine which of the following statements are true.`;
      statements = [
        { key: "I", text: `A ${n}-year zero-coupon bond redeemable at ${mamt(C)} and bought to yield an annual effective ${pc(i)} costs ${mnum(Pz, 2)}.`, truth: t1, justification: `Its price is $${mamt(C)}(1.${String(Math.round(i * 1000)).padStart(3, "0").replace(/0+$/, "") || "0"})^{-${n}} = ${mnum(C * Math.pow(1 + i, -n), 2)}$.`.replace(/\(1\.[0-9]*\)/, `(${dj(1 + i)})`), misconception: "MODEL_COMPOUND_AS_SIMPLE", check: { expr: lit(Pz), op: "=", than: `${lit(C)}*${vPow(i, n)}` }, stage: 1, failure: "selection" },
        { key: "II", text: "If the bond's yield rate equalled its coupon rate, its price would equal its face amount.", truth: C === F, justification: C === F ? "With $C = F$ and $j = r$ each coupon is exactly interest on $C$, so $P = F$." : `With $j = r$, $P = C + (Fr - Cr)a_{\\overline{n|}} \\ne F$ because $C = ${mamt(C)}$.`, misconception: "CONC_BOND_REDEMPTION_AS_FACE", check: { expr: priceE(F * r, C, r, n), op: "=", than: lit(F) }, stage: 2, failure: "connection" },
        { key: "III", text: `The bond's modified coupon rate is ${pc(g, 4)}.`, truth: t3, justification: `$g = Fr/C = ${mamt(F * r)}/${mamt(C)} = ${mpc((F * r) / C, 4)}$.`, misconception: "ALG_INVERTED_RATIO", check: { expr: lit(g), op: "=", than: `${lit(F * r)}/${lit(C)}` }, stage: 2, failure: "application" },
      ];
    }
    return statementQuestion({
      stem,
      statements,
      extra: multiFlipExtras(statements, variant === 0 ? "CONC_RELATED_TERM" : "CONC_BOND_YIELD_IS_COUPON_RATE", 2),
      steps: [
        { concept: "bond.terms", reasoning: "Quoted coupon and yield rates are nominal annual rates; convert them to the payment period." },
        { concept: "bond.face-redemption", reasoning: "‘At par’ means $C = F$; coupons are based on $F$." },
        { concept: variant === 0 ? "tvm.nominal-vs-effective" : "bond.modified-coupon", reasoning: variant === 0 ? "$1 + i = (1 + i^{(2)}/2)^2$." : "$g = Fr/C$; a zero-coupon bond's price is $Cv^n$." },
      ],
      conditions: ["Rates as quoted; coupons based on face."],
      relationship: "Coupon $= Fr/m$ per period; $1 + i = (1 + i^{(m)}/m)^m$; $g = Fr/C$.",
      counterexample: "For annual coupons and a yield quoted annual effective, no conversion is needed.",
      transfer: {
        principle: "Read each term literally: what is paid, when, and on what base.",
        unusual: "Several unrelated terms are judged together.",
        misread: "Par refers to the face amount, never to the price.",
      },
      presentation: level === 2 ? ["indirect-wording"] : ["direct"],
      features: { unfamiliar: level === 2, steps: 3 },
      params: { F, n, r, y, variant },
    });
  },
});

// ================================================================ cross-topic: spot rates

const spotCross: ChoiceTemplate = conceptTemplate({
  id: "con-bond-spot-cross",
  family: "con-bond-cross",
  topic: "BONDS",
  levels: [2, 3],
  objective: "BONDS.price_redemption",
  secondary: ["BONDS.yield", "ALM.spot_forward", "ALM.yield_curves"],
  itemFormat: "expression-selection",
  conceptFamily: "cross-topic",
  dimensions: ["transfer", "equation_construction", "relationships"],
  reasoning: ["formula_selection", "concept_recognition", "transfer"],
  soaConcept: "A coupon bond as a sum of zero-coupon payments priced off a term structure, and what its yield summarizes.",
  variants: 2,
  generate(rng, level, variant) {
    const n = level === 3 ? 4 : 3;
    const F = 1000 * rng.int(1, 5);
    const C = level === 3 ? F * (1 + 0.05 * rng.int(1, 2)) : F;
    const r = gridRate(rng, 0.03, 0.08, 0.005);
    const cpn = F * r;
    const up = rng.int(0, 1) === 1;
    const f0 = gridRate(rng, 0.02, 0.05, 0.0025);
    // One-year forward rates; spot rates follow from them.
    const fwd: number[] = [f0];
    for (let k = 1; k < n; k += 1) fwd.push(Math.max(0.005, fwd[k - 1] + (up ? 1 : -1) * gridRate(rng, 0.0025, 0.0075, 0.0025)));
    const D: number[] = [];
    let prod = 1;
    for (const f of fwd) {
      prod *= 1 + f;
      D.push(1 / prod);
    }
    const spot = D.map((d, k) => Math.pow(d, -1 / (k + 1)) - 1);
    const giveForwards = level === 3;
    const cf = (t: number) => cpn + (t === n ? C : 0);
    const P = D.reduce((sum, d, k) => sum + cf(k + 1) * d, 0);
    const truth = `(${D.map((_, k) => `${lit(cf(k + 1))}/(${fwd.slice(0, k + 1).map((f) => `(1+${lit(f)})`).join("*")})`).join(" + ")})`;
    const table = giveForwards
      ? { type: "table" as const, columns: ["Year $t$", "One-year forward rate from $t-1$ to $t$"], rows: fwd.map((f, k) => [String(k + 1), pc(f, 4)]) }
      : { type: "table" as const, columns: ["Term $t$ (years)", "Spot rate $s_t$"], rows: spot.map((s, k) => [String(k + 1), pc(round2(s * 1e6) / 1e6, 4)]) };
    // Level 2 displays spot rates rounded to 4 decimals of a percent; use the displayed values throughout.
    const sp = giveForwards ? spot : spot.map((s) => Number((s * 100).toFixed(4)) / 100);
    const Dp = giveForwards ? D : sp.map((s, k) => Math.pow(1 + s, -(k + 1)));
    const Pp = Dp.reduce((sum, d, k) => sum + cf(k + 1) * d, 0);
    const truthP = giveForwards ? truth : `(${sp.map((s, k) => `${lit(cf(k + 1))}*(1+${lit(s)})**(-${k + 1})`).join(" + ")})`;
    const redText = C === F ? "redeemable at par" : `redeemable at ${mamt(C)}`;
    const termsText = `A ${n}-year bond with face amount ${mamt(F)} pays annual coupons at a rate of ${pc(r)} and is ${redText}.`;
    const atRate = (x: number) => priceE(cpn, C, x, n);
    const steps = [
      { concept: "bond.spot-pricing", reasoning: "Each payment is a zero-coupon amount, discounted at the spot rate for its own date." },
      ...(giveForwards ? [{ concept: "alm.spot-forward", reasoning: "Discount factors are products of one-year forward factors: $v_t = \\prod_{k=1}^{t}(1 + f_{k-1,k})^{-1}$." }] : []),
      { concept: "alm.single-yield", reasoning: "The bond's yield is the one rate that reproduces the price; it is a weighted summary dominated by the final payment." },
      { concept: "bond.face-redemption", reasoning: `The final payment is the last coupon plus the redemption value, $${mamt(cf(n))}$.` },
    ];
    const common = {
      exhibits: [table],
      steps,
      conditions: ["Annual coupons; the term structure applies to every payment.", "No default or call."],
      relationship: "$P = \\sum_t CF_t\\,(1 + s_t)^{-t}$; the yield $j$ solves $P = \\sum_t CF_t (1+j)^{-t}$.",
      counterexample: "With a flat term structure, every spot rate, forward rate and the yield coincide.",
      transfer: {
        principle: "Price each payment with its own discount factor; a single yield is an output, not an input.",
        unusual: giveForwards ? "Only forward rates are given." : "A table of rates replaces a single yield.",
        misread: "Forward rates are not spot rates, and neither is an average of the other.",
      },
      params: { n, F, C, r, up, variant },
    };
    if (variant === 0) {
      const fShow = (k: number) => dj(1 + fwd[k]);
      const sShow = (k: number) => dj(1 + sp[k]);
      const term = (k: number, amt: number) =>
        giveForwards ? `\\frac{${mamt(amt)}}{${fwd.slice(0, k + 1).map((_, q) => `(${fShow(q)})`).join("")}}` : `${mamt(amt)}(${sShow(k)})^{-${k + 1}}`;
      const sumShow = (fn: (k: number) => string) => Array.from({ length: n }, (_, k) => fn(k)).join(" + ");
      const avg = (giveForwards ? fwd : sp).reduce((s2, x) => s2 + x, 0) / n;
      const lastRate = giveForwards ? fwd[n - 1] : sp[n - 1];
      const flat = (x: number, k: number, amt: number) => `${mamt(amt)}(${dj(1 + x)})^{-${k + 1}}`;
      const flatE = (x: number, withC = true, red = C) => `(${Array.from({ length: n }, (_, k) => `${lit(cpn + (k === n - 1 && withC ? red : 0))}*(1+${lit(x)})**(-${k + 1})`).join(" + ")})`;
      const rates = giveForwards ? fwd : sp;
      return conceptQuestion({
        ...common,
        stem: `${termsText} The ${giveForwards ? "one-year forward rates" : "annual effective spot rates"} are shown below.\n\nDetermine which of the following expressions equals the price of the bond.`,
        correct: { content: math(sumShow((k) => term(k, cf(k + 1)))), why: `Each payment is discounted with its own discount factor: $P = ${mnum(Pp, 2)}$.`, probe: truthP },
        distractors: [
          ...(giveForwards
            ? [opt(math(sumShow((k) => flat(fwd[k], k, cf(k + 1)))), "CONC_FORWARD_REVERSED", "A forward rate applies only to its own year; payments at time $t$ need the product of the forward factors.", 1, "connection", { probe: `(${fwd.map((f, k) => `${lit(cf(k + 1))}*(1+${lit(f)})**(-${k + 1})`).join(" + ")})`, confusedWith: "alm.spot-forward" })]
            : [opt(math(sumShow((k) => `${mamt(cf(k + 1))}(${sShow(k)})^{-1}`)), "TIMING_MISSING_PERIOD", "A $t$-year spot rate applies for all $t$ years: the factor is $(1 + s_t)^{-t}$.", 0, "application", { probe: `(${sp.map((s, k) => `${lit(cf(k + 1))}*(1+${lit(s)})**(-1)`).join(" + ")})` })]),
          opt(math(sumShow((k) => flat(lastRate, k, cf(k + 1)))), "MODEL_SINGLE_RATE", "Earlier payments have their own rates; the longest rate is not the discount rate for every payment.", 0, "selection", { probe: flatE(lastRate), confusedWith: "alm.single-yield" }),
          opt(math(sumShow((k) => flat(avg, k, cf(k + 1)))), "CONC_BOND_YIELD_AVERAGE_SPOT", "An average of the rates is neither the yield nor a valid discount rate for each payment.", 1, "selection", { probe: flatE(avg) }),
          opt(math(sumShow((k) => term(k, cpn))), "CONC_IGNORED_REDEMPTION", "The redemption payment is part of the final cash flow.", 2, "application", { probe: `(${Dp.map((d) => `${lit(cpn)}*${lit(d)}`).join(" + ")})` }),
          ...(C !== F ? [opt(math(sumShow((k) => term(k, cpn + (k === n - 1 ? F : 0)))), "CONC_BOND_REDEMPTION_AS_FACE", `The final payment includes ${amt2(C)}, not the face amount.`, 2, "interpretation", { probe: `(${Dp.map((d, k) => `${lit(cpn + (k === n - 1 ? F : 0))}*${lit(d)}`).join(" + ")})` })] : []),
          ...(!giveForwards ? [opt(math(sumShow((k) => `${mamt(cf(k + 1))}(${dj(1 + rates[0])})^{-${k + 1}}`)), "TRANS_IGNORED_CONDITION", "The one-year rate applies only to the first payment.", 0, "selection", { probe: flatE(rates[0]) })] : []),
        ],
        reference: { values: [{ label: "P", expr: truthP }], description: `Each payment discounted with its own discount factor${giveForwards ? " built from the forward rates" : ""}: $P = ${mnum(Pp, 2)}$.` },
        itemFormat: "expression-selection",
        presentation: giveForwards ? ["combined-topics", "hidden-structure"] : ["combined-topics"],
        features: { unfamiliar: true, multiConcept: true },
        modelingDecisions: giveForwards ? 2 : undefined,
      });
    }
    const s1 = spot[0];
    const sn_ = spot[n - 1];
    const mid = (s1 + sn_) / 2;
    const avgS = spot.reduce((a2, b2) => a2 + b2, 0) / n;
    const fl = fwd[n - 1];
    const Pl = lit(P);
    const sideClaim = (towardN: boolean) => ({ expr: `(${atRate(mid)} - ${Pl})*(${lit(sn_)} - ${lit(s1)})*${towardN ? 1 : -1}`, op: ">" as const, than: 0 });
    const eqAt = (x: number) => ({ expr: atRate(x), op: "=" as const, than: Pl });
    const sTxt = (x: number) => pc(round2(x * 1e6) / 1e6, 3);
    return conceptQuestion({
      ...common,
      stem: `${termsText} The ${giveForwards ? "one-year forward rates" : "annual effective spot rates"} are shown below, and the bond is priced from them.\n\nWhich of the following is true of the bond's annual effective yield to maturity?`,
      correct: { content: `It is closer to the ${n}-year spot rate, ${sTxt(sn_)}, than to the 1-year spot rate, ${sTxt(s1)}.`, why: `Most of the bond's value sits in the final payment, so the yield is pulled toward $s_${n}$.`, check: sideClaim(true) },
      distractors: [
        opt(`It is closer to the 1-year spot rate, ${sTxt(s1)}, than to the ${n}-year spot rate, ${sTxt(sn_)}.`, "CONC_DIRECTION_REVERSED", "The final payment, discounted near $s_n$, carries most of the value.", 2, "conclusion", { check: sideClaim(false) }),
        opt(`It equals ${sTxt(avgS)}, the arithmetic average of the ${n} spot rates.`, "CONC_BOND_YIELD_AVERAGE_SPOT", "The yield weights each rate by the value of the payment it discounts.", 2, "selection", { check: eqAt(avgS) }),
        opt(`It equals ${sTxt(sn_)}, the spot rate for the bond's maturity date of ${n} years.`, "MODEL_SINGLE_RATE", "Earlier coupons are discounted at lower or higher rates, so the yield differs from $s_n$.", 2, "selection", { check: eqAt(sn_), confusedWith: "alm.single-yield" }),
        opt(`It equals ${sTxt(fl)}, the one-year forward rate for the bond's final year.`, "CONC_FORWARD_REVERSED", "A forward rate prices one year only; the yield summarizes the whole term.", 1, "connection", { check: eqAt(fl), confusedWith: "alm.spot-forward" }),
      ],
      reference: { description: "The price from the term structure is compared with the bond's value at trial rates (the midpoint of the spot range and each quoted rate) to locate the yield." },
      itemFormat: "correct-statement",
      presentation: giveForwards ? ["combined-topics", "hidden-structure", "indirect-wording"] : ["combined-topics", "indirect-wording"],
      features: { unfamiliar: true, multiConcept: true },
      modelingDecisions: giveForwards ? 2 : undefined,
    });
  },
});

const callInterpretation: ChoiceTemplate = conceptTemplate({
  id: "con-bond-call-interpretation",
  family: "con-bond-callable",
  topic: "BONDS",
  levels: [1, 2],
  objective: "BONDS.callable",
  secondary: ["BONDS.terms", "BONDS.yield"],
  itemFormat: "interpretation",
  conceptFamily: "interpretation",
  dimensions: ["interpretation", "terminology"],
  soaConcept: "What the price of a callable bond guarantees, and what is paid on a call date (call price versus face and redemption value).",
  variants: 2,
  generate(rng, level, variant) {
    const F = 1000 * rng.int(1, 5);
    const n = rng.int(14, 22);
    const a = rng.int(5, 8);
    const last = n - 1;
    const r = gridRate(rng, 0.05, 0.09, 0.005);
    const y = drawUntil(() => gridRate(rng, 0.03, 0.08, 0.005), (x) => r - x >= 0.01);
    const transfer = {
      principle: "The issuer picks the redemption date, so the investor can count only on the outcome of the least favourable date.",
      unusual: "A single price stands for many possible redemption dates.",
      misread: "Call price, face amount and redemption at maturity are different amounts.",
    };
    if (variant === 0) {
      const s = callSetup(F, 1, n, r, y, a, last, () => F);
      const P = s.minValue;
      const avg = s.dates.reduce((sum, d) => sum + s.value(d), 0) / s.dates.length;
      const yT = level === 2 ? pc(y) : "$j$";
      const stem =
        level === 2
          ? `A bond with face amount ${mamt(F)} pays annual coupons at a rate of ${pc(r)} and matures at par at the end of ${n} years. It may be called at par on any coupon date from the end of year ${a} through the end of year ${last}. An investor pays ${mnum(P, 2)}, the lowest of the prices at an annual effective yield of ${pc(y)} to each possible redemption date.\n\nWhich of the following describes what this price gives the investor?`
          : "A callable bond is bought at the lowest of its prices, at an annual effective yield $j$, to each of its possible redemption dates.\n\nWhich of the following describes what this price gives the investor?";
      const chk = (c: { expr: string; op: "<=" | ">=" | "="; than: string }) => (level === 2 ? { check: c } : {});
      return conceptQuestion({
        stem,
        correct: { content: `An annual effective yield of at least ${yT} on whichever date the bond is redeemed`, why: "The price is no more than the price to any date at that yield, so every redemption date yields at least the target.", ...chk({ expr: lit(P), op: "<=", than: lit(s.minValue) }) },
        distractors: [
          opt(`An annual effective yield of exactly ${yT} if the bond is never called`, "CONC_BOND_CALL_IGNORED", "For this premium bond the price is set by the earliest call, so running to maturity yields more than the target.", 1, "interpretation", { ...chk({ expr: s.priceTo(n), op: "=", than: lit(P) }), conditionTrue: "True for a discount bond, whose worst case is maturity." }),
          opt(`An annual effective yield of at most ${yT} on whichever date the bond is redeemed`, "CONC_DIRECTION_REVERSED", "Paying the lowest price makes every other date yield more, not less.", 1, "conclusion", chk({ expr: lit(P), op: ">=", than: lit(Math.max(...s.dates.map(s.value))) })),
          opt(`An annual effective yield of ${yT} on average over the possible redemption dates`, "CONC_BOND_CALL_AVERAGE", "The price is the minimum, not an average; the target is a floor on every date.", 1, "interpretation", chk({ expr: lit(P), op: "=", than: lit(avg) })),
          opt(`An annual effective return of ${yT} whatever rate the coupons are reinvested at`, "CONC_BOND_REALIZED_EQUALS_YIELD", "A yield guarantee concerns the bond's own payments; the realized return also depends on reinvestment.", 0, "recognition"),
          opt(`An annual effective yield of exactly ${yT} on every possible redemption date`, "CONC_RELATED_TERM", "Only the worst-case date yields exactly the target; the others yield more.", 1, "conclusion"),
        ],
        reference: { description: "The price to every possible redemption date at the target yield is computed; the price paid is the minimum." },
        steps: [
          { concept: "bond.callable", reasoning: "The issuer chooses the redemption date, so a guaranteed yield needs the lowest price over all dates." },
          { concept: "bond.yield-to-call", reasoning: "At that price, the worst date yields exactly the target and every other date yields more." },
          ...(level === 2 ? [{ concept: "bond.premium-discount", reasoning: `Coupon rate ${pc(r)} exceeds ${pc(y)}: a premium bond, whose worst date is the earliest call.` }] : []),
        ],
        conditions: ["The issuer may redeem on any listed date.", "Yield measured on the bond's own payments."],
        relationship: "Guaranteed-yield price $= \\min_t P_t(j)$; the yield to date $t$ is at least $j$ for every $t$.",
        counterexample: "For a non-callable bond the price at yield $j$ gives exactly $j$, since there is only one redemption date.",
        transfer,
        itemFormat: "interpretation",
        presentation: level === 2 ? ["compare-streams"] : ["direct"],
        features: { unfamiliar: level === 2 },
        params: { F, n, a, r, y, variant },
      });
    }
    const semi = level === 2;
    const m = semi ? 2 : 1;
    const b = a + rng.int(2, 4);
    const cp = 0.05 * rng.int(1, 3);
    const C1 = F * (1 + cp);
    const t = rng.int(a, b);
    const cpn = (F * r) / m;
    return conceptQuestion({
      stem: `A bond with face amount ${mamt(F)} pays ${semi ? `semiannual coupons at an annual rate of ${pc(r)}` : `annual coupons at a rate of ${pc(r)}`} and matures at par at the end of ${n} years. It may be called at ${mamt(C1)} on any coupon date from the end of year ${a} through the end of year ${b}, and at par on any later coupon date before maturity. It was bought to yield an annual effective rate of ${pc(y)}.\n\nThe bond is called at the end of year ${t}. Determine which of the following the investor receives on that date.`,
      correct: { content: `The coupon of ${amt2(cpn)} and the call price of ${amt2(C1)}`, why: `On a call date the investor receives that date's coupon plus the call price, here ${amt2(C1)}.` },
      distractors: [
        opt(`The call price of ${amt2(C1)}, which includes the final coupon`, "CONC_DOUBLE_COUNTED", "The call price is paid in addition to the coupon due that day.", 1, "interpretation"),
        opt(`The coupon of ${amt2(cpn)} and the face amount of ${amt2(F)}`, "CONC_BOND_REDEMPTION_AS_FACE", `A call before year ${b + 1} pays the call price ${amt2(C1)}, not par.`, 0, "interpretation", { conditionTrue: `Correct for a call after year ${b}.` }),
        opt(`The coupon of ${amt2(cpn)} and the bond's book value at ${pc(y)}`, "CONC_BOOK_MARKET_CONFUSION", "Book value is an accounting value; the call price is fixed by contract.", 0, "recognition"),
        opt(`The coupon of ${amt2((C1 * r) / m)} and the call price of ${amt2(C1)}`, "CONC_BOND_COUPON_ON_REDEMPTION", "Coupons are always based on face.", 1, "application"),
        ...(semi ? [opt(`The coupon of ${amt2(F * r)} and the call price of ${amt2(C1)}`, "RATE_ANNUAL_FOR_PERIODIC", "With semiannual coupons each coupon is half the annual coupon.", 1, "application")] : []),
      ],
      steps: [
        { concept: "bond.callable", reasoning: `A call at year ${t} ends the bond: the investor receives the coupon due and the call price for that date.` },
        { concept: "bond.face-redemption", reasoning: `Coupons are based on face ($${mamt(cpn)}$); a call between years ${a} and ${b} repays the call price ${amt2(C1)}.` },
        ...(semi ? [{ concept: "bond.terms", reasoning: "A coupon rate payable semiannually gives half the annual coupon each half-year." }] : []),
      ],
      conditions: ["Calls occur on coupon dates.", "Call prices are fixed by the bond's terms."],
      relationship: "Final payment on a call at $t$: $Fr + C_t$, with $C_t$ the call price at $t$.",
      counterexample: `A call after year ${b} would repay par, ${amt2(F)}.`,
      transfer,
      itemFormat: "definition",
      presentation: semi ? ["frequency", "irrelevant-info"] : ["irrelevant-info"],
      features: { unfamiliar: semi },
      params: { F, n, a, b, cp, r, y, t, variant },
    });
  },
});

export const BOND_CONCEPT_TEMPLATES: ChoiceTemplate[] = [
  priceDefinition,
  priceFormula,
  priceDiagnosis,
  bookMarketInterp,
  bookValueExpr,
  bookMarketStatements,
  couponRates,
  premiumClassify,
  couponDiagnosis,
  yieldDefinition,
  yieldEquation,
  yieldStatements,
  amortInterp,
  amortRelationship,
  amortDiagnosis,
  reinvestInterp,
  reinvestExpr,
  reinvestDiagnosis,
  callInterpretation,
  callDate,
  callStatements,
  callDiagnosis,
  termsCashflows,
  termsYieldExpr,
  termsStatements,
  spotCross,
];
