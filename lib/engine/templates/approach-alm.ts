/**
 * Solution-approach bank — General cash flows, portfolios and ALM.
 *
 * Routes the rest of the bank does not use: the yield read back from a
 * perpetuity's duration, a duration updated by PV-weighting instead of being
 * recomputed, and an internal rate of return used as an *input* to recover
 * unknown cash flows.
 */
import type { AnswerFormat, DistractorCandidate, QuestionDraft, QuestionTemplate } from "../types";
import { explain, round2, routeVisual } from "./approach-kit";
import { MONEY2, amt, chain, dec, distractor, drawUntil, features, gridAmount, gridRate, lit, mamt, mnum, mpc, pc, shown, step } from "./kit";

const L = lit;
const YEARS: AnswerFormat = { kind: "time", decimals: 2, unit: "years" };

// ===================================================================== Duration of a perpetuity, read backwards

const perpDuration: QuestionTemplate = {
  id: "apx-alm-perp-duration",
  family: "apx-alm-perp-duration",
  topic: "ALM",
  levels: [1, 2, 3],
  objective: "ALM.approx_pv_change",
  secondary: ["ALM.duration", "ANNUITIES.perpetuities"],
  reasoning: ["formula_reconstruction", "concept_recognition", "algebra"],
  soaConcept: "A perpetuity's Macaulay duration is (1+i)/i, so a stated duration reveals the yield; the price change follows exactly or by an approximation.",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const D = rng.choice([11, 13, 15, 17, 21]);
    const i = 1 / (D - 1);
    const R = gridAmount(rng, 100, 2000, 50);
    const up = rng.next() < 0.6;
    const size = rng.choice([0.01, 0.015, 0.02, 0.025, 0.03]);
    const dlt = up ? size : -size;
    const P0 = R / i;
    const iE = `(1/${D - 1})`;
    const exact = R / (i + dlt);
    const modApprox = P0 * (1 - (D - 1) * dlt);
    const macApprox = P0 * Math.pow((1 + i) / (1 + i + dlt), D);
    const dir = up ? "increases" : "decreases";
    const dltE = L(dlt);

    let answer: number;
    let calc: string;
    let model: string;
    let ask: string;
    const distractors: DistractorCandidate[] = [];
    const exactD = distractor("CONC_ALM_APPROX_EXACT", exact, `${L(R)}/(${iE}+${dltE})`, {
      derivation: `$${mamt(R)}/(i + \\Delta i) = ${shown(exact, fmt)}$`,
      method: "Computed the exact new price instead of the approximation asked for.",
      feedback: "The question specifies an approximation; the exact value differs by the higher-order terms.",
    });
    const sameD = distractor("VAR_OTHER_UNKNOWN", P0, `${L(R)}/${iE}`, {
      derivation: `$${mamt(R)}/i = ${shown(P0, fmt)}$`,
      method: "Gave the price before the yield change.",
      feedback: `The yield ${dir}; the price moves the other way.`,
    });

    if (level === 1) {
      answer = exact;
      calc = `${L(R)}/(${iE}+${dltE})`;
      model = `${L(R)}*(1+${iE}+${dltE})/(${iE}+${dltE}) - ${L(R)}`;
      ask = "Calculate the price of the perpetuity after the change.";
      const iMod = 1 / D;
      distractors.push(
        sameD,
        distractor("FORMULA_MODIFIED_FOR_MACAULAY", R / (iMod + dlt), `${L(R)}/(1/${D}+${dltE})`, {
          derivation: `$i = 1/D = ${dec(iMod, 6)}$; $= ${shown(R / (iMod + dlt), fmt)}$`,
          method: "Took i = 1/D, which holds for modified duration.",
          feedback: `For a perpetuity-immediate the Macaulay duration is $\\tfrac{1+i}{i}$, so $i = \\tfrac{1}{D-1} = ${dec(i, 6)}$; it is the modified duration that equals $1/i$.`,
        }),
        distractor("TIMING_IMMEDIATE_AS_DUE", (R * (1 + i + dlt)) / (i + dlt), `${L(R)}*(1+${iE}+${dltE})/(${iE}+${dltE})`, {
          derivation: `$${mamt(R)}\\,\\ddot a_{\\overline{\\infty|}} = ${shown((R * (1 + i + dlt)) / (i + dlt), fmt)}$`,
          method: "Valued a perpetuity-due.",
          feedback: "Payments are at the end of each year.",
        }),
        distractor("CHAL_WRONG_APPROXIMATION", modApprox, `${L(R)}/${iE}*(1-${D - 1}*${dltE})`, {
          derivation: `$P(1 - D_{mod}\\Delta i) = ${shown(modApprox, fmt)}$`,
          method: "Used the first-order approximation instead of repricing.",
          feedback: "A perpetuity reprices exactly in one step: $R/(i + \\Delta i)$.",
        }),
        distractor("CONC_PRICE_YIELD_DIRECTION", R / (i - dlt), `${L(R)}/(${iE}-${dltE})`, {
          derivation: `$${mamt(R)}/(i - \\Delta i) = ${shown(R / (i - dlt), fmt)}$`,
          method: "Moved the yield the wrong way.",
          feedback: `The yield ${dir} by ${pc(size, 2)}.`,
        })
      );
    } else if (level === 2) {
      answer = modApprox;
      calc = `${L(R)}/${iE}*(1-${D - 1}*${dltE})`;
      model = `${L(R)}/${iE} - ${L(R)}/${iE}**2*${dltE}`;
      ask = "Calculate the new price using the first-order modified approximation.";
      distractors.push(
        exactD,
        distractor("FORMULA_MODIFIED_FOR_MACAULAY", P0 * (1 - D * dlt), `${L(R)}/${iE}*(1-${D}*${dltE})`, {
          derivation: `$P(1 - D\\,\\Delta i) = ${shown(P0 * (1 - D * dlt), fmt)}$`,
          method: "Used the Macaulay duration in the modified approximation.",
          feedback: `$D_{mod} = D/(1+i) = ${D}/(1 + 1/${D - 1}) = ${D - 1}$.`,
        }),
        distractor("CHAL_WRONG_APPROXIMATION", macApprox, `${L(R)}/${iE}*((1+${iE})/(1+${iE}+${dltE}))**${D}`, {
          derivation: `$P\\left(\\tfrac{1+i}{1+i+\\Delta i}\\right)^{D} = ${shown(macApprox, fmt)}$`,
          method: "Used the first-order Macaulay approximation.",
          feedback: "The question asks for the modified (linear) approximation.",
        }),
        distractor("CONC_PRICE_YIELD_DIRECTION", P0 * (1 + (D - 1) * dlt), `${L(R)}/${iE}*(1+${D - 1}*${dltE})`, {
          derivation: `$P(1 + D_{mod}\\Delta i) = ${shown(P0 * (1 + (D - 1) * dlt), fmt)}$`,
          method: "Moved the price in the same direction as the yield.",
          feedback: "Price falls when the yield rises: $P(i+\\Delta i) \\approx P(i)(1 - D_{mod}\\Delta i)$.",
        }),
        sameD
      );
    } else {
      answer = macApprox;
      calc = `${L(R)}/${iE}*((1+${iE})/(1+${iE}+${dltE}))**${D}`;
      model = `${L(R)}/${iE}*(1+${dltE}/(1+${iE}))**(-${D})`;
      ask = "Calculate the new price using the first-order Macaulay approximation.";
      distractors.push(
        exactD,
        distractor("CHAL_WRONG_APPROXIMATION", modApprox, `${L(R)}/${iE}*(1-${D - 1}*${dltE})`, {
          derivation: `$P(1 - D_{mod}\\Delta i) = ${shown(modApprox, fmt)}$`,
          method: "Used the first-order modified approximation.",
          feedback: "The Macaulay approximation is $P\\left(\\tfrac{1+i}{1+i+\\Delta i}\\right)^{D}$.",
        }),
        distractor("FORMULA_MODIFIED_FOR_MACAULAY", P0 * Math.pow((1 + i) / (1 + i + dlt), D - 1), `${L(R)}/${iE}*((1+${iE})/(1+${iE}+${dltE}))**${D - 1}`, {
          derivation: `$P\\left(\\tfrac{1+i}{1+i+\\Delta i}\\right)^{${D - 1}} = ${shown(P0 * Math.pow((1 + i) / (1 + i + dlt), D - 1), fmt)}$`,
          method: "Used the modified duration as the exponent.",
          feedback: `The Macaulay approximation raises the ratio to the Macaulay duration, ${D}.`,
        }),
        distractor("CONC_PRICE_YIELD_DIRECTION", P0 * Math.pow((1 + i + dlt) / (1 + i), D), `${L(R)}/${iE}*((1+${iE}+${dltE})/(1+${iE}))**${D}`, {
          derivation: `$P\\left(\\tfrac{1+i+\\Delta i}{1+i}\\right)^{D} = ${shown(P0 * Math.pow((1 + i + dlt) / (1 + i), D), fmt)}$`,
          method: "Inverted the ratio of accumulation factors.",
          feedback: "Price falls when the yield rises, so the ratio is old over new.",
        }),
        sameD
      );
    }

    const steps = [
      step("G.duration-special", `Perpetuity-immediate: $D = \\tfrac{1+i}{i}$, so $i = \\tfrac{1}{D - 1}$.`, ["i", i, "current yield"], ["D"], { rearranged: true }),
      step("B.perpetuity", "Current price: payment over yield.", ["P_0", P0, "current price"], ["R", "i"]),
    ];
    if (level === 1) steps.push(step("B.perpetuity", "Reprice at the new yield.", ["P_1", answer, "new price"], ["R", "i"]));
    if (level === 2) steps.push(step("G.modified", "$D_{mod} = D/(1+i) = D - 1$.", ["D_mod", D - 1, "modified duration"], ["D", "i"]), step("G.approx-modified", "First-order modified approximation.", ["P_1", answer, "approximate new price"], ["P_0", "D_mod"]));
    if (level === 3) steps.push(step("G.approx-macaulay", "First-order Macaulay approximation.", ["P_1", answer, "approximate new price"], ["P_0", "D", "i"]));
    const chainSpec = chain(steps, {
      methods: ["rearrangement", "substitution"],
      reasoning: "The duration is the only information about the yield; invert the perpetuity's duration formula.",
      unconventional: true,
      stages: Object.fromEntries(distractors.map((d) => [d.misconception, d.misconception === "FORMULA_MODIFIED_FOR_MACAULAY" && level === 1 ? 0 : steps.length - 1])),
    });

    return {
      stem: `A perpetuity-immediate pays ${amt(R)} at the end of each year. At the current annual effective yield, its Macaulay duration is ${D} years. The yield then ${dir} by ${pc(size, 2)} (for example, from $i$ to $i ${up ? "+" : "-"} ${mpc(size, 2)}$).\n\n${ask}`,
      answer: { value: answer, calc, format: fmt, derivation: `$i = 1/${D - 1}$; $= ${shown(answer, fmt)}$` },
      model: { expr: model, description: "Price from the yield implied by the duration." },
      distractors,
      explanation: explain({
        intuition: `The yield is not stated, but a perpetuity's Macaulay duration depends on nothing else: $D = (1+i)/i$. Read the yield off the duration, then price.`,
        unknowns: [{ symbol: "$i$", meaning: "current yield" }],
        relationships: ["$D_{mac} = \\dfrac{1+i}{i}$", "$D_{mod} = \\dfrac{1}{i} = D_{mac} - 1$", "$P = R/i$"],
        conditions: ["Level payments forever, first payment in one year."],
        valuationDate: "Now",
        modelChoice: level === 1 ? "Exact repricing." : level === 2 ? "First-order modified approximation." : "First-order Macaulay approximation.",
        assumptions: ["Flat yield; the change applies to the annual effective yield."],
        solution: [
          { title: "Yield", body: `$i = 1/(${D} - 1) = ${dec(i, 6)}$; $P_0 = ${mnum(P0, 2)}$` },
          {
            title: "New price",
            body:
              level === 1
                ? `$${mamt(R)}/(${dec(i, 6)} ${up ? "+" : "-"} ${dec(size, 3)}) = ${shown(answer, fmt)}$`
                : level === 2
                  ? `$${mnum(P0, 2)}(1 - ${D - 1} \\times ${dec(dlt, 3)}) = ${shown(answer, fmt)}$`
                  : `$${mnum(P0, 2)}\\left(\\tfrac{${dec(1 + i, 6)}}{${dec(1 + i + dlt, 6)}}\\right)^{${D}} = ${shown(answer, fmt)}$`,
          },
        ],
        alternative: {
          name: "Modified duration directly",
          body: "For a perpetuity-immediate $D_{mod} = 1/i$, so $i = 1/D_{mod}$ — but only if the duration given is the modified one.",
          whenUseful: "When the question quotes modified duration.",
        },
        principle: "Closed-form durations can be inverted to recover a yield.",
        unusual: "The yield must be recovered from the duration.",
        misread: "$1/i$ is the modified duration of a perpetuity-immediate; the Macaulay duration is one year more.",
      }),
      visuals: [routeVisual(chainSpec, "Route: duration → yield → price", "The duration formula is used backwards.")],
      markers: [i, P0, answer],
      presentation: ["unknown-rate", "hidden-structure"],
      features: features({ steps: level === 1 ? 3 : 4, unfamiliar: true, multiConcept: level > 1 }),
      params: { D, R, dlt, level },
      chain: chainSpec,
    };
  },
};

// ===================================================================== Duration updated by PV weighting

const durationMerge: QuestionTemplate = {
  id: "apx-alm-duration-merge",
  family: "apx-alm-duration-merge",
  topic: "ALM",
  levels: [1, 2, 3],
  objective: "ALM.duration",
  secondary: ["ALM.portfolio", "TVM.present_future_value"],
  reasoning: ["concept_recognition", "valuation_dates", "financial_intuition"],
  soaConcept: "A stream's duration updated after a new cash flow is added — as a PV-weighted average, without listing the stream's cash flows.",
  generate(rng, level): QuestionDraft {
    const fmt = YEARS;
    const i = gridRate(rng, 0.03, 0.08, 0.0025);
    const X = gridAmount(rng, 10000, 200000, 5000);
    const Vg = gridAmount(rng, 50000, 500000, 10000);
    const Dg = gridAmount(rng, level === 3 ? 4 : 3, level === 3 ? 13 : 12, 0.5);
    const t = drawUntil(() => rng.int(1, 20), (tt) => Math.abs(tt - Dg) >= 2);
    let V = Vg;
    let D = Dg;
    let Dm = 0;
    if (level === 2) {
      Dm = Math.round((Dg / (1 + i)) * 10000) / 10000;
      D = Dm * (1 + i);
    }
    if (level === 3) {
      V = Vg * (1 + i);
      D = Dg - 1;
    }
    const pvX = X * Math.pow(1 + i, -t);
    const answer = (V * D + pvX * t) / (V + pvX);
    const vE = level === 3 ? `(${L(Vg)}*(1+${L(i)}))` : L(Vg);
    const dE = level === 2 ? `(${L(Dm)}*(1+${L(i)}))` : level === 3 ? `(${L(Dg)}-1)` : L(Dg);
    const pvXE = `${L(X)}*(1+${L(i)})**(-${t})`;
    const calc = `(${vE}*${dE} + ${pvXE}*${t})/(${vE} + ${pvXE})`;
    const model = `${dE} + (${t} - ${dE})*${pvXE}/(${vE} + ${pvXE})`;

    const distractors: DistractorCandidate[] = [
      distractor("MODEL_UNDISCOUNTED_WEIGHTS", (V * D + X * t) / (V + X), `(${vE}*${dE} + ${L(X)}*${t})/(${vE} + ${L(X)})`, {
        derivation: `$\\dfrac{V D + X t}{V + X} = ${shown((V * D + X * t) / (V + X), fmt)}$`,
        method: "Weighted the new liability by its face amount.",
        feedback: `Duration weights are present values: use $Xv^{${t}} = ${mnum(pvX, 2)}$.`,
      }),
      distractor("ALLOC_EVEN_SPLIT", (D + t) / 2, `(${dE} + ${t})/2`, {
        derivation: `$(${dec(D, 2)} + ${t})/2 = ${shown((D + t) / 2, fmt)}$`,
        method: "Averaged the two durations equally.",
        feedback: "The average is weighted by present value.",
      }),
      distractor("CONC_ALM_DURATIONS_ADDED", D + t, `${dE} + ${t}`, {
        derivation: `$${dec(D, 2)} + ${t} = ${shown(D + t, fmt)}$`,
        method: "Added the two durations.",
        feedback: "Durations of parts combine as a weighted average, never as a sum: the result must lie between the two.",
      }),
      distractor("ALG_DIVIDE_ERROR", (V * D + pvX * t) / V, `(${vE}*${dE} + ${pvXE}*${t})/${vE}`, {
        derivation: `$\\dfrac{VD + Xv^{${t}}t}{V} = ${shown((V * D + pvX * t) / V, fmt)}$`,
        method: "Divided by the old present value only.",
        feedback: "The denominator is the total present value after the addition.",
      }),
    ];
    if (level === 1) {
      distractors.push(
        distractor("FORMULA_MODIFIED_FOR_MACAULAY", answer / (1 + i), `(${calc})/(1+${L(i)})`, {
          derivation: `$${dec(answer, 4)}/(1+i) = ${shown(answer / (1 + i), fmt)}$`,
          method: "Converted the answer to a modified duration.",
          feedback: "The question asks for the Macaulay duration.",
        })
      );
    }
    if (level === 2) {
      const wrong = (V * Dm + pvX * t) / (V + pvX);
      distractors.push(
        distractor("FORMULA_MODIFIED_FOR_MACAULAY", wrong, `(${vE}*${L(Dm)} + ${pvXE}*${t})/(${vE} + ${pvXE})`, {
          derivation: `$\\dfrac{V D_{mod} + Xv^{${t}}t}{V + Xv^{${t}}} = ${shown(wrong, fmt)}$`,
          method: "Averaged the modified duration with a Macaulay duration.",
          feedback: `Convert first: $D_{mac} = D_{mod}(1+i) = ${dec(D, 4)}$.`,
        })
      );
    }
    if (level === 3) {
      const stale = (Vg * Dg + pvX * t) / (Vg + pvX);
      distractors.push(
        distractor("TIMING_VALUATION_DATE", stale, `(${L(Vg)}*${L(Dg)} + ${pvXE}*${t})/(${L(Vg)} + ${pvXE})`, {
          derivation: `$\\dfrac{${mamt(Vg)}(${dec(Dg, 1)}) + Xv^{${t}}t}{${mamt(Vg)} + Xv^{${t}}} = ${shown(stale, fmt)}$`,
          method: "Used last year's present value and duration as if they were current.",
          feedback: `A year later, with no cash flows, the present value has grown to $V(1+i)$ and every cash flow is a year closer: $D = ${dec(Dg, 1)} - 1$.`,
        })
      );
      const half = (V * Dg + pvX * t) / (V + pvX);
      distractors.push(
        distractor("TIMING_MISSING_PERIOD", half, `(${vE}*${L(Dg)} + ${pvXE}*${t})/(${vE} + ${pvXE})`, {
          derivation: `$\\dfrac{V(1+i)(${dec(Dg, 1)}) + Xv^{${t}}t}{V(1+i) + Xv^{${t}}} = ${shown(half, fmt)}$`,
          method: "Grew the present value a year but left the duration unchanged.",
          feedback: "Each cash flow is one year nearer, so the duration falls by exactly one year.",
        }),
        distractor("FORMULA_MODIFIED_FOR_MACAULAY", answer / (1 + i), `(${calc})/(1+${L(i)})`, {
          derivation: `$${dec(answer, 4)}/(1+i) = ${shown(answer / (1 + i), fmt)}$`,
          method: "Converted the answer to a modified duration.",
          feedback: "The question asks for the Macaulay duration.",
        })
      );
    }

    const steps = [] as ReturnType<typeof step>[];
    if (level === 2) steps.push(step("G.modified", "Convert the stated modified duration to Macaulay: $D = D_{mod}(1+i)$.", ["D", D, "Macaulay duration of the stream"], ["D_mod", "i"], { rearranged: true }));
    if (level === 3) {
      steps.push(step("A.compound", "One year on with no cash flows: present value grows by $1+i$.", ["V", V, "present value now"], ["V_0", "i"], { valuationDate: "now" }));
      steps.push(step("G.macaulay", "Every cash flow is a year nearer, so the duration falls by one.", ["D", D, "duration now"], ["D_0"], { derived: true }));
    }
    steps.push(step("A.discount-factor", "Present value of the new liability.", ["PV_X", pvX, "PV of the new liability"], ["X", "i", "t"]));
    steps.push(step("G.portfolio-duration", "Duration of the combined stream: PV-weighted average of the two durations.", ["D_new", answer, "combined Macaulay duration"], ["V", "D", "PV_X", "t"]));
    const chainSpec = chain(steps, {
      methods: ["decomposition", "valuation_dates"],
      reasoning: "Treat the existing stream as one block with known PV and duration; a single liability's duration is its due date.",
      stages: Object.fromEntries(distractors.map((d) => [d.misconception, ["TIMING_VALUATION_DATE", "TIMING_MISSING_PERIOD", "FORMULA_MODIFIED_FOR_MACAULAY"].includes(d.misconception) && level > 1 ? 0 : steps.length - 1])),
    });

    const head =
      level === 3
        ? `One year ago, at an annual effective rate of ${pc(i)}, a stream of liabilities had a present value of ${amt(Vg)} and a Macaulay duration of ${dec(Dg, 1)} years. No liability payments have been made since.`
        : level === 2
          ? `At an annual effective rate of ${pc(i)}, a stream of liabilities has a present value of ${amt(Vg)} and a modified duration of ${dec(Dm, 4)}.`
          : `At an annual effective rate of ${pc(i)}, a stream of liabilities has a present value of ${amt(Vg)} and a Macaulay duration of ${dec(Dg, 1)} years.`;

    return {
      stem: `${head} A new liability of ${amt(X)}, due ${t} year${t === 1 ? "" : "s"} from now, is added to the stream${level === 3 ? " today" : ""}.\n\nCalculate the Macaulay duration of the combined stream${level === 3 ? " now" : ""}, at the same rate.`,
      answer: { value: answer, calc, format: fmt, derivation: `$\\dfrac{VD + Xv^{${t}}t}{V + Xv^{${t}}} = ${shown(answer, fmt)}$` },
      model: { expr: model, description: "The old duration shifted toward the new due date by the new liability's share of present value." },
      distractors,
      explanation: explain({
        intuition: "Duration is a present-value-weighted average of times. The old stream is one block — its PV and duration are all you need — and the new liability is a block of its own whose duration is simply its due date.",
        unknowns: [{ symbol: "$D_{new}$", meaning: "Macaulay duration of the combined stream" }],
        relationships: [`$D_{new} = \\dfrac{V D + Xv^{${t}}\\,${t}}{V + Xv^{${t}}}$`],
        conditions: ["Same rate for both blocks."],
        valuationDate: "Now",
        modelChoice: "Portfolio duration as a PV-weighted average.",
        assumptions: ["Flat yield curve at the stated rate."],
        solution: [
          ...(level === 2 ? [{ title: "Macaulay duration", body: `$D = ${dec(Dm, 4)}(1 + ${dec(i, 4)}) = ${dec(D, 4)}$` }] : []),
          ...(level === 3 ? [{ title: "Roll forward one year", body: `$V = ${mamt(Vg)}(${dec(1 + i, 4)}) = ${mnum(V, 2)}$, $D = ${dec(Dg, 1)} - 1 = ${dec(D, 1)}$` }] : []),
          { title: "New liability", body: `$Xv^{${t}} = ${mnum(pvX, 2)}$` },
          { title: "Weighted average", body: `$\\dfrac{${mnum(V, 2)}(${dec(D, 4)}) + ${mnum(pvX, 2)}(${t})}{${mnum(V + pvX, 2)}} = ${shown(answer, fmt)}$` },
        ],
        alternative: {
          name: "Shift form",
          body: "$D_{new} = D + (t - D) \\times \\dfrac{Xv^t}{V + Xv^t}$: the duration moves toward t in proportion to the new PV share.",
          whenUseful: "A quick check of direction and size.",
        },
        principle: "Durations of blocks combine as a PV-weighted average.",
        unusual: "The stream's individual cash flows are never listed.",
        misread: "Weights are present values, not face amounts.",
      }),
      visuals: [routeVisual(chainSpec, "Route: duration as a weighted average", "The old stream is one block.")],
      markers: [pvX, answer],
      presentation: level === 1 ? ["hidden-structure"] : ["hidden-structure", "valuation-date"],
      features: features({ steps: steps.length, unfamiliar: true, multipleValuationDates: level === 3 }),
      params: { i, X, V: Vg, D: Dg, t, level },
      chain: chainSpec,
    };
  },
};

// ===================================================================== The IRR as an input

const irrInverse: QuestionTemplate = {
  id: "apx-alm-irr-inverse",
  family: "apx-alm-irr-inverse",
  topic: "ALM",
  levels: [1, 2, 3],
  objective: "ALM.rates_of_return",
  secondary: ["TVM.equation_of_value"],
  reasoning: ["simultaneous_equations", "cashflow_modelling", "algebra"],
  soaConcept: "The IRR used as a condition: unknown project cash flows recovered from the IRR (and an NPV at another rate).",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const j = gridRate(rng, 0.06, 0.15, 0.005);
    const v = (r: number, t: number) => Math.pow(1 + r, -t);
    const vE = (r: number, t: number) => `(1+${L(r)})**(-${t})`;
    const distractors: DistractorCandidate[] = [];
    let answer: number;
    let calc: string;
    let model: { expr: string; bracket?: [number, number]; description: string };
    let stem: string;
    let steps;

    if (level === 1) {
      const draw = drawUntil(
        () => {
          const C0 = gridAmount(rng, 10000, 50000, 1000);
          const A = Math.round((C0 * rng.float(0.15, 0.35, 2)) / 100) * 100;
          const B = Math.round((C0 * rng.float(0.15, 0.35, 2)) / 100) * 100;
          return { C0, A, B, X: (C0 - A * v(j, 1) - B * v(j, 3)) * Math.pow(1 + j, 2) };
        },
        (d) => d.X > 0.15 * d.C0
      );
      const { C0, A, B } = draw;
      const core = C0 - A * v(j, 1) - B * v(j, 3);
      const coreE = `(${L(C0)} - ${L(A)}*${vE(j, 1)} - ${L(B)}*${vE(j, 3)})`;
      answer = core * Math.pow(1 + j, 2);
      calc = `${coreE}*(1+${L(j)})**2`;
      model = { expr: `-${L(C0)} + ${L(A)}*${vE(j, 1)} + x*${vE(j, 2)} + ${L(B)}*${vE(j, 3)}`, description: "NPV at the IRR is zero." };
      stem = `A project requires an investment of ${amt(C0)} now. It returns ${amt(A)} at the end of year 1, $X$ at the end of year 2 and ${amt(B)} at the end of year 3. The project's internal rate of return is ${pc(j)}.\n\nCalculate $X$.`;
      distractors.push(
        distractor("TIMING_MISSING_PERIOD", core * (1 + j), `${coreE}*(1+${L(j)})`, {
          derivation: `$${mnum(core, 2)}(1+j) = ${shown(core * (1 + j), fmt)}$`,
          method: "Moved the balance to year 1 instead of year 2.",
          feedback: "X is paid at the end of year 2: accumulate two years.",
        }),
        distractor("TIMING_EXTRA_PERIOD", core * Math.pow(1 + j, 3), `${coreE}*(1+${L(j)})**3`, {
          derivation: `$${mnum(core, 2)}(1+j)^3 = ${shown(core * Math.pow(1 + j, 3), fmt)}$`,
          method: "Accumulated three years.",
          feedback: "X is paid at the end of year 2.",
        }),
        distractor("ALG_SIGN_ERROR", (C0 + A * v(j, 1) + B * v(j, 3)) * Math.pow(1 + j, 2), `(${L(C0)} + ${L(A)}*${vE(j, 1)} + ${L(B)}*${vE(j, 3)})*(1+${L(j)})**2`, {
          derivation: `$(C_0 + Av + Bv^3)(1+j)^2 = ${shown((C0 + A * v(j, 1) + B * v(j, 3)) * Math.pow(1 + j, 2), fmt)}$`,
          method: "Added the other inflows instead of subtracting them.",
          feedback: "X makes up what the other inflows leave of the investment.",
        }),
        distractor("TRANS_INVERTED_RELATION", core / Math.pow(1 + j, 2), `${coreE}/(1+${L(j)})**2`, {
          derivation: `$${mnum(core, 2)}v^2 = ${shown(core / Math.pow(1 + j, 2), fmt)}$`,
          method: "Discounted instead of accumulating when isolating X.",
          feedback: "$Xv^2 = $ remainder, so $X = $ remainder $\\times (1+j)^2$.",
        }),
        distractor("SEQ_UNDISCOUNTED_SUM", C0 * Math.pow(1 + j, 2) - A * (1 + j) - B, `${L(C0)}*(1+${L(j)})**2 - ${L(A)}*(1+${L(j)}) - ${L(B)}`, {
          derivation: `$C_0(1+j)^2 - A(1+j) - B = ${shown(C0 * Math.pow(1 + j, 2) - A * (1 + j) - B, fmt)}$`,
          method: "Took the year-3 inflow at face value at year 2.",
          feedback: "At year 2 the year-3 inflow is worth $Bv$.",
        })
      );
      steps = [
        step("C.irr", "At the IRR the NPV is zero.", ["eq", 0, "NPV at the IRR"], ["cash flows", "j"]),
        step("A.compound", "Isolate X's present value and move it to year 2.", ["X", answer, "year-2 cash flow"], ["C_0", "A", "B", "j"], { rearranged: true }),
      ];
    } else {
      const draw = drawUntil(
        () => {
          const A = gridAmount(rng, 2000, 15000, 500);
          const X = gridAmount(rng, 10000, 30000, 500);
          const Y = gridAmount(rng, 10000, 30000, 500);
          return { A, X, Y };
        },
        (d) => Math.abs(d.X - d.Y) >= 3000
      );
      const r = Math.max(0.01, j - rng.choice([0.03, 0.04, 0.05]));
      const C0 = Math.round(draw.A * v(j, 1) + draw.X * v(j, 2) + draw.Y * v(j, 3));
      const A = draw.A;
      const N = round2(-C0 + A * v(r, 1) + draw.X * v(r, 2) + draw.Y * v(r, 3));
      const a1 = v(j, 2), b1 = v(j, 3), a2 = v(r, 2), b2 = v(r, 3);
      const c1 = C0 - A * v(j, 1);
      const c2 = N + C0 - A * v(r, 1);
      const solve = (cc1: number, cc2: number, swap = false) => {
        const [p1, q1, p2, q2] = swap ? [b1, a1, b2, a2] : [a1, b1, a2, b2];
        const det = p1 * q2 - p2 * q1;
        return { X: (cc1 * q2 - cc2 * q1) / det, Y: (p1 * cc2 - p2 * cc1) / det };
      };
      const a1E = vE(j, 2), b1E = vE(j, 3), a2E = vE(r, 2), b2E = vE(r, 3);
      const c1E = `(${L(C0)} - ${L(A)}*${vE(j, 1)})`;
      const c2E = (sign: string) => `(${sign}${L(N)} + ${L(C0)} - ${L(A)}*${vE(r, 1)})`;
      const solveE = (cc1: string, cc2: string, swap = false) => {
        const [p1, q1, p2, q2] = swap ? [b1E, a1E, b2E, a2E] : [a1E, b1E, a2E, b2E];
        const det = `(${p1}*${q2} - ${p2}*${q1})`;
        return { X: `((${cc1}*${q2} - ${cc2}*${q1})/${det})`, Y: `((${p1}*${cc2} - ${p2}*${cc1})/${det})` };
      };
      const ok = solve(c1, c2);
      const okE = solveE(c1E, c2E(""));
      const sign = solve(c1, -N + C0 - A * v(r, 1));
      const signE = solveE(c1E, c2E("-"));
      const swp = solve(c1, c2, true);
      const swpE = solveE(c1E, c2E(""), true);
      const eq = c1 / (a1 + b1);
      const eqE = `(${c1E}/(${a1E} + ${b1E}))`;
      const pieces = `${L(A)} at the end of year 1, $X$ at the end of year 2 and $Y$ at the end of year 3`;

      if (level === 2) {
        answer = ok.X;
        calc = okE.X;
        model = { expr: `${a2E}*x + ${b2E}*(${c1E} - ${a1E}*x)/${b1E} - ${c2E("")}`, description: "Y written from the IRR condition and substituted into the NPV condition." };
        stem = `A project requires an investment of ${amt(C0)} now and returns ${pieces}. Its internal rate of return is ${pc(j)}, and its net present value at an annual effective rate of ${pc(r)} is ${amt(N)}.\n\nCalculate $X$.`;
        distractors.push(
          distractor("VAR_OTHER_UNKNOWN", ok.Y, okE.Y, {
            derivation: `$Y = ${shown(ok.Y, fmt)}$`,
            method: "Reported Y.",
            feedback: "X is the year-2 cash flow.",
          }),
          distractor("ALG_SIGN_ERROR", sign.X, signE.X, {
            derivation: `NPV taken as $-${mnum(N, 2)}$; $X = ${shown(sign.X, fmt)}$`,
            method: "Entered the NPV with the wrong sign.",
            feedback: `At ${pc(r)} the inflows exceed the investment by ${amt(N)}: $-C_0 + Av + Xv^2 + Yv^3 = +${mnum(N, 2)}$.`,
          }),
          distractor("ALLOC_SWAPPED", swp.X, swpE.X, {
            derivation: `X at year 3, Y at year 2; $X = ${shown(swp.X, fmt)}$`,
            method: "Placed X at year 3 and Y at year 2.",
            feedback: "Keep each cash flow at its own date.",
          }),
          distractor("TRANS_IGNORED_CONDITION", eq, eqE, {
            derivation: `$X = Y = \\dfrac{C_0 - Av}{v^2 + v^3} = ${shown(eq, fmt)}$`,
            method: "Ignored the NPV condition and assumed X = Y.",
            feedback: "Two unknowns need both conditions.",
          }),
          distractor("ALG_DIVIDE_ERROR", c1 / a1, `${c1E}/${a1E}`, {
            derivation: `$X = (C_0 - Av)/v^2 = ${shown(c1 / a1, fmt)}$`,
            method: "Dropped Y from the IRR equation.",
            feedback: "Y is also part of the equation of value at the IRR.",
          })
        );
        steps = [
          step("C.irr", "IRR condition: $-C_0 + Av_j + Xv_j^2 + Yv_j^3 = 0$.", ["eq1", 0, "equation at the IRR"], ["C_0", "A", "j"]),
          step("C.npv", `NPV condition at ${pc(r)}.`, ["eq2", N, "equation at the second rate"], ["C_0", "A", "r", "N"]),
          step("M.linear-system", "Solve the two linear equations for X.", ["X", answer, "year-2 cash flow"], ["eq1", "eq2"], { rearranged: true }),
        ];
      } else {
        const r2 = j - 0.02;
        const npv = (p: { X: number; Y: number }) => -C0 + A * v(r2, 1) + p.X * v(r2, 2) + p.Y * v(r2, 3);
        const npvE = (p: { X: string; Y: string }) => `(-${L(C0)} + ${L(A)}*${vE(r2, 1)} + ${p.X}*${vE(r2, 2)} + ${p.Y}*${vE(r2, 3)})`;
        answer = npv(ok);
        calc = npvE(okE);
        const xOnly = `((${c2E("")} - ${b2E}*${c1E}/${b1E})/(${a2E} - ${b2E}*${a1E}/${b1E}))`;
        model = { expr: npvE({ X: xOnly, Y: `((${c1E} - ${a1E}*${xOnly})/${b1E})` }), description: "X by substitution, Y from the IRR condition, then the NPV at the third rate." };
        stem = `A project requires an investment of ${amt(C0)} now and returns ${pieces}. Its internal rate of return is ${pc(j)}, and its net present value at an annual effective rate of ${pc(r)} is ${amt(N)}.\n\nCalculate its net present value at an annual effective rate of ${pc(r2)}.`;
        const lin = N * ((j - r2) / (j - r));
        distractors.push(
          distractor("MODEL_STRAIGHT_LINE", lin, `${L(N)}*(${L(j)}-${L(r2)})/(${L(j)}-${L(r)})`, {
            derivation: `$${mnum(N, 2)} \\times \\tfrac{${dec(j - r2, 3)}}{${dec(j - r, 3)}} = ${shown(lin, fmt)}$`,
            method: "Interpolated the NPV linearly between the two known rates.",
            feedback: "NPV is a curved (convex) function of the rate; recover the cash flows and discount them.",
          }),
          distractor("SEQ_UNDISCOUNTED_SUM", -C0 + A + ok.X + ok.Y, `-${L(C0)} + ${L(A)} + ${okE.X} + ${okE.Y}`, {
            derivation: `$-C_0 + A + X + Y = ${shown(-C0 + A + ok.X + ok.Y, fmt)}$`,
            method: "Recovered X and Y correctly but then added the cash flows without discounting.",
            feedback: `Discount each cash flow at ${pc(r2)}.`,
          }),
          distractor("ALLOC_SWAPPED", npv(swp), npvE(swpE), {
            derivation: `$= ${shown(npv(swp), fmt)}$`,
            method: "Placed X at year 3 and Y at year 2.",
            feedback: "Keep each cash flow at its own date.",
          }),
          distractor("TRANS_IGNORED_CONDITION", npv({ X: eq, Y: eq }), npvE({ X: eqE, Y: eqE }), {
            derivation: `$X = Y = ${mnum(eq, 2)}$; $= ${shown(npv({ X: eq, Y: eq }), fmt)}$`,
            method: "Ignored the NPV condition and assumed X = Y.",
            feedback: "Two unknowns need both conditions.",
          }),
          distractor("VAR_OTHER_UNKNOWN", N, L(N), {
            derivation: `$${shown(N, fmt)}$`,
            method: "Gave the NPV at the rate already stated.",
            feedback: `The question asks for the NPV at ${pc(r2)}.`,
          })
        );
        steps = [
          step("C.irr", "IRR condition: $-C_0 + Av_j + Xv_j^2 + Yv_j^3 = 0$.", ["eq1", 0, "equation at the IRR"], ["C_0", "A", "j"]),
          step("C.npv", `NPV condition at ${pc(r)}.`, ["eq2", N, "equation at the second rate"], ["C_0", "A", "r", "N"]),
          step("M.linear-system", "Solve for X and Y.", ["X", ok.X, "year-2 cash flow"], ["eq1", "eq2"], { rearranged: true }),
          step("C.npv", `Discount all cash flows at ${pc(r2)}.`, ["NPV", answer, `NPV at ${pc(r2)}`], ["X", "Y", "r_2"]),
        ];
      }
    }

    const chainSpec = chain(steps, {
      methods: level === 1 ? ["rearrangement", "equation_construction"] : ["simultaneous", "equation_construction"],
      reasoning: "An IRR is a statement that the NPV is zero at that rate — an equation, usable to recover an unknown cash flow.",
      stages: Object.fromEntries(distractors.map((d) => [d.misconception, Math.min(steps.length - 1, ["MODEL_STRAIGHT_LINE", "VAR_OTHER_UNKNOWN"].includes(d.misconception) ? steps.length - 1 : 1)])),
    });

    return {
      stem,
      answer: { value: answer, calc, format: fmt, derivation: `$= ${shown(answer, fmt)}$` },
      model,
      distractors,
      explanation: explain({
        intuition: "An internal rate of return is not just an output: saying the IRR is j says the NPV at j is zero. That is an equation, and an equation can be solved for an unknown cash flow. A second fact (an NPV at another rate) gives a second equation.",
        unknowns: level === 1 ? [{ symbol: "$X$", meaning: "year-2 cash flow" }] : [{ symbol: "$X, Y$", meaning: "year-2 and year-3 cash flows" }],
        relationships: ["$\\text{NPV}(j) = 0$", ...(level === 1 ? [] : ["$\\text{NPV}(r) = N$"])],
        conditions: ["Cash flows at the ends of years."],
        valuationDate: "Time 0",
        modelChoice: level === 1 ? "One equation of value at the IRR." : "Two linear equations in the unknown cash flows.",
        assumptions: ["Annual effective rates."],
        solution:
          level === 1
            ? [
                { title: "Equation at the IRR", body: "$-C_0 + Av + Xv^2 + Bv^3 = 0$ at $j$" },
                { title: "Solve", body: `$X = (C_0 - Av - Bv^3)(1+j)^2 = ${shown(answer, fmt)}$` },
              ]
            : [
                { title: "Two equations", body: "$Xv_j^2 + Yv_j^3 = C_0 - Av_j$ and $Xv_r^2 + Yv_r^3 = N + C_0 - Av_r$" },
                { title: "Solve", body: level === 2 ? `$X = ${shown(answer, fmt)}$` : "Eliminate one unknown, then back-substitute for the other." },
                ...(level === 3 ? [{ title: "Third rate", body: `NPV at the new rate $= ${shown(answer, fmt)}$` }] : []),
              ],
        alternative: {
          name: "Work at year 2",
          body: "Accumulate everything to year 2 so that X appears with coefficient 1.",
          whenUseful: "Reduces arithmetic when only one unknown sits at a single date.",
        },
        principle: "Rates of return are conditions on cash flows; turn each stated rate into an equation of value.",
        unusual: "The IRR is given and a cash flow is asked for.",
        misread: "NPV is not linear in the rate: two known NPVs do not interpolate to a third.",
      }),
      visuals: [routeVisual(chainSpec, "Route: rates as equations", "Each stated rate is one equation of value.")],
      markers: [answer],
      presentation: level === 1 ? ["inverse", "work-backwards"] : ["inverse", "multi-equation", "hidden-structure"],
      features: features({ steps: steps.length, unfamiliar: level > 1, multiConcept: level > 1 }),
      params: { j, level },
      chain: chainSpec,
    };
  },
};

export const APPROACH_ALM_TEMPLATES: QuestionTemplate[] = [perpDuration, durationMerge, irrInverse];
