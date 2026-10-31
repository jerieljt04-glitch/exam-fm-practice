import { sn, solveRoot } from "../finance";
import type { AnswerFormat, QuestionDraft, QuestionTemplate } from "../types";
import {
  MONEY0,
  MONEY2,
  PCT3,
  amt,
  dec,
  distractor,
  drawUntil,
  explanation,
  features,
  frequency,
  gridAmount,
  gridRate,
  lit,
  mamt,
  mnum,
  mpc,
  pc,
  range,
  sExpr,
  sSym,
  shown,
  step,
  chain,
  sumOf,
  word,
} from "./kit";

const YEARS: AnswerFormat = { kind: "number", decimals: 2, unit: "years" };

// ===================================================================== two funds, one total

const twoFunds: QuestionTemplate = {
  id: "tvm-two-funds",
  family: "tvm-allocation",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.simple_compound",
  secondary: ["TVM.effective_nominal", "TVM.equation_of_value"],
  reasoning: ["translation", "simultaneous_equations", "concept_recognition", "algebra", "financial_intuition"],
  soaConcept: "A deposit split between a simple-interest fund and a compound-interest fund, linked by a combined total.",
  generate(rng, lvl): QuestionDraft {
    const D = gridAmount(rng, 10000, 50000, 1000);
    const fmt = MONEY0;

    if (lvl === 1) {
      const p = drawUntil(
        () => {
          const s = gridRate(rng, 0.05, 0.09, 0.005);
          const j = gridRate(rng, 0.025, 0.06, 0.005);
          const t = rng.choice([2, 3]);
          const cj = Math.pow(1 + j, t) - 1;
          const x0 = gridAmount(rng, Math.round(D * 0.2 / 500) * 500, Math.round(D * 0.8 / 500) * 500, 500);
          const I = Math.round(x0 * s * t + (D - x0) * cj);
          const x = (I - D * cj) / (s * t - cj);
          return { s, j, t, cj, I, x };
        },
        (q) => q.s >= q.j + 0.015 && Math.abs(q.s * q.t - q.cj) > 0.02 && q.x > 0.15 * D && q.x < 0.85 * D
      );
      const { s, j, t, cj, I, x } = p;
      const cjE = `((1+${lit(j)})**${t}-1)`;
      const aggregate = I / (s * t);
      const bothCompound = (I - D * cj) / (Math.pow(1 + s, t) - 1 - cj);
      const even = I / (2 * s * t);
      const sign = (I - D * cj) / (s * t + cj);
      const oneYear = (I - D * j) / (s - j);
      const interestX = x * s * t;
      return {
        stem: `An investor deposits a total of ${amt(D)} into two funds. Fund X credits simple interest at an annual rate of ${pc(s)}. Fund Y credits interest at an annual effective rate of ${pc(j)}. Over the first ${word(t)} years, the two funds together earn ${amt(I)} of interest.\n\nCalculate the amount deposited into Fund X.`,
        answer: {
          value: x,
          calc: `(${lit(I)} - ${lit(D)}*${cjE})/(${lit(s)}*${t} - ${cjE})`,
          format: fmt,
          derivation: `$x = \\dfrac{${I} - ${mamt(D)}(${dec(cj, 6)})}{${dec(s * t, 4)} - ${dec(cj, 6)}} = ${shown(x, fmt)}$`,
        },
        model: {
          expr: `x*(1+${lit(s)}*${t}) + (${lit(D)}-x)*(1+${lit(j)})**${t} - ${lit(D)} - ${lit(I)}`,
          bracket: [0, D],
          description: "Accumulated value of both funds at the end of the period, less the deposits, equals the combined interest.",
        },
        distractors: [
          distractor("ALLOC_AGGREGATE_AS_EACH", aggregate, `${lit(I)}/(${lit(s)}*${t})`, {
            derivation: `$x(${dec(s, 3)})(${t}) = ${I} \\Rightarrow x = ${shown(aggregate, fmt)}$`,
            method: "Treated the combined interest as the interest earned by Fund X alone.",
            feedback: `The ${amt(I)} is earned by both funds together: $I_X + I_Y = ${I}$. Fund Y's interest has to be in the equation too.`,
            markers: [s * t],
          }),
          distractor("MODEL_SIMPLE_AS_COMPOUND", bothCompound, `(${lit(I)} - ${lit(D)}*${cjE})/((1+${lit(s)})**${t}-1 - ${cjE})`, {
            derivation: `$x[(1.${String(s).slice(2)})^{${t}} - 1] + (${mamt(D)} - x)(${dec(cj, 6)}) = ${I} \\Rightarrow x = ${shown(bothCompound, fmt)}$`,
            method: "Compounded Fund X's interest as well.",
            feedback: `Fund X credits simple interest: x earns ${pc(s)} of x every year, ${dec(s * t, 3)}x in total. Compounding it overstates X's interest.`,
          }),
          distractor("VAR_OTHER_UNKNOWN", D - x, `${lit(D)} - (${lit(I)} - ${lit(D)}*${cjE})/(${lit(s)}*${t} - ${cjE})`, {
            derivation: `$${mamt(D)} - x = ${shown(D - x, fmt)}$`,
            method: "Solved the equation correctly but reported the amount in Fund Y.",
            feedback: "Re-read the last line of the question: it asks for Fund X.",
          }),
          distractor("ALLOC_EVEN_SPLIT", even, `${lit(I)}/(2*${lit(s)}*${t})`, {
            derivation: `$x(${dec(s * t, 3)}) = ${I}/2 \\Rightarrow x = ${shown(even, fmt)}$`,
            method: "Assumed each fund earned half of the combined interest.",
            feedback: "Nothing says the interest is shared equally. The split depends on the deposits and the rates, which is what the equation determines.",
          }),
          distractor("ALG_SIGN_ERROR", sign, `(${lit(I)} - ${lit(D)}*${cjE})/(${lit(s)}*${t} + ${cjE})`, {
            derivation: `$x(${dec(s * t, 4)} + ${dec(cj, 6)}) = ${I} - ${mamt(D)}(${dec(cj, 6)}) \\Rightarrow x = ${shown(sign, fmt)}$`,
            method: "Collected the x terms with the wrong sign.",
            feedback: `Expanding $(${mamt(D)} - x)c$ gives $-xc$, so the coefficient of x is $st - c$, not $st + c$.`,
          }),
          distractor("TRANS_IGNORED_CONDITION", oneYear, `(${lit(I)} - ${lit(D)}*${lit(j)})/(${lit(s)} - ${lit(j)})`, {
            derivation: `$${dec(s, 3)}x + ${dec(j, 3)}(${mamt(D)} - x) = ${I} \\Rightarrow x = ${shown(oneYear, fmt)}$`,
            method: `Treated the ${t}-year interest as one year's interest.`,
            feedback: `The interest is earned over ${t} years, so each fund's interest covers the whole period.`,
          }),
        ],
        explanation: explanation({
          intuition: `Two pots of money grow side by side under different rules. Fund X adds the same amount of interest every year; Fund Y adds interest on interest. Only their combined interest is known, so it constrains the sum of the two growth amounts — not either one alone.`,
          translation: {
            unknowns: [{ symbol: "$x$", meaning: "the amount deposited into Fund X; Fund Y receives $D - x$" }],
            relationships: [`$I_X = x(${dec(s, 3)})(${t})$`, `$I_Y = (${mamt(D)} - x)[(1.${String(j).slice(2)})^{${t}} - 1]$`, `$I_X + I_Y = ${I}$`],
            conditions: ["Deposits add to D.", "Interest earned over the same period in both funds."],
            valuationDate: `Time ${t}, where the interest totals are measured.`,
            modelChoice: "Two unknown deposits, two conditions (total deposit, total interest): substitute $D - x$ for Fund Y and solve one linear equation.",
            assumptions: ["No withdrawals.", "Both deposits made at time 0."],
          },
          solution: [
            { title: "Each fund's interest", body: `$I_X = ${dec(s * t, 4)}x$; $I_Y = (${mamt(D)} - x)(${dec(cj, 6)})$` },
            { title: "Combine", body: `$${dec(s * t, 4)}x + ${mnum(D * cj, 2)} - ${dec(cj, 6)}x = ${I}$` },
            { title: "Solve", body: `$x = \\dfrac{${I} - ${mnum(D * cj, 2)}}{${dec(s * t - cj, 6)}} = ${shown(x, fmt)}$` },
          ],
          alternatives: [
            {
              name: "Two unknowns, elimination",
              body: `$x + y = ${mamt(D)}$ and $${dec(s * t, 4)}x + ${dec(cj, 6)}y = ${I}$; multiply the first by ${dec(cj, 6)} and subtract.`,
              whenUseful: "Clearer when you prefer to name both deposits; it is the same algebra.",
            },
            {
              name: "Deviation from a benchmark",
              body: `If everything were in Fund Y, interest would be $${mnum(D * cj, 2)}$. Each unit moved to X changes interest by $${dec(s * t - cj, 6)}$, so $x = (${I} - ${mnum(D * cj, 2)}) / ${dec(s * t - cj, 6)}$.`,
              whenUseful: "A fast mental check that the answer sits between 0 and D.",
            },
          ],
          transfer: {
            principle: "An aggregate constrains a sum of parts. Write one unknown per part, one equation per condition, and let each part carry its own rate.",
            unusual: "Two different interest conventions run in parallel, joined only by a total.",
            misread: "A “combined” figure is easily applied to one account, or split evenly.",
          },
        }),
        visuals: [
          {
            kind: "allocation",
            title: "How the combined interest splits",
            parts: [
              { label: "Fund X (simple)", principal: x, interest: interestX, detail: `${pc(s)} simple for ${t} years` },
              { label: "Fund Y (compound)", principal: D - x, interest: (D - x) * cj, detail: `${pc(j)} effective for ${t} years` },
            ],
            total: { principal: D, interest: I },
            caption: "The total interest is fixed; the deposit split decides how it divides between the funds.",
          },
        ],
        markers: [s * t, cj, D * cj, s * t - cj],
        presentation: ["multi-equation", "indirect-wording"],
        features: features({ steps: 3, multiConcept: true }),
        chain: chain(
          [
            step("A.simple", "Fund X earns simple interest on its deposit only.", ["I_X", x * s * t, "interest earned by Fund X"], ["x", "s", "t"]),
            step("A.compound", "Fund Y compounds, so its interest is the growth factor minus one.", ["I_Y", (D - x) * cj, "interest earned by Fund Y"], ["D - x", "j", "t"]),
            step("M.linear-system", "The combined interest constrains the sum; substitute D − x and solve.", ["x", x, "deposit into Fund X"], ["I_X", "I_Y", "I"], { rearranged: true }),
          ],
          {
            methods: ["substitution", "equation_construction"],
            stages: {
              ALLOC_AGGREGATE_AS_EACH: [2, "connection"],
              MODEL_SIMPLE_AS_COMPOUND: [0, "selection", "A.compound"],
              VAR_OTHER_UNKNOWN: [2, "interpretation"],
              ALLOC_EVEN_SPLIT: [2, "connection"],
              ALG_SIGN_ERROR: [2, "application"],
              TRANS_IGNORED_CONDITION: [0, "application"],
            },
            reasoning: "Name one unknown (x in Fund X), write each fund's interest as an expression in x, and set their sum equal to the total — one linear equation, no annuity formula needed.",
          }
        ),
        params: { D, s, j, t, I },
      };
    }

    const p = drawUntil(
      () => {
        const s = gridRate(rng, 0.03, 0.06, 0.005);
        const j = Number((s + gridRate(rng, 0.02, 0.04, 0.005)).toFixed(4));
        const m = rng.choice([2, 4, 12]);
        const t = rng.int(3, 6);
        const fy = Math.pow(1 + j / m, m * t);
        const fx = 1 + s * t;
        const y0 = gridAmount(rng, Math.round(D * 0.2 / 500) * 500, Math.round(D * 0.8 / 500) * 500, 500);
        const A = Math.round((D - y0) * fx + y0 * fy);
        const y = (A - D * fx) / (fy - fx);
        return { s, j, m, t, fx, fy, A, y };
      },
      (q) => q.fy - q.fx > 0.03 && q.y > 0.15 * D && q.y < 0.85 * D
    );
    const { s, j, m, t, fx, fy, A, y } = p;
    const fyE = `(1+${lit(j)}/${m})**${m * t}`;
    const fxE = `(1+${lit(s)}*${t})`;
    const asEff = (A - D * fx) / (Math.pow(1 + j, t) - fx);
    const aggregate = A / fy;
    const bothCompound = (A - D * Math.pow(1 + s, t)) / (fy - Math.pow(1 + s, t));
    const ySimple = (A - D * fx) / (j * t - s * t);
    return {
      stem: `A total of ${amt(D)} is deposited at time 0 into two funds. Fund X credits simple interest at ${pc(s)} per year. Fund Y credits interest at an annual nominal rate of ${pc(j)} convertible ${frequency(m)}. At the end of ${word(t)} years the combined value of the two funds is ${amt(A)}.\n\nCalculate the amount deposited into Fund Y.`,
      answer: {
        value: y,
        calc: `(${lit(A)} - ${lit(D)}*${fxE})/(${fyE} - ${fxE})`,
        format: fmt,
        derivation: `$y = \\dfrac{${mamt(A)} - ${mamt(D)}(${dec(fx, 4)})}{${dec(fy, 6)} - ${dec(fx, 4)}} = ${shown(y, fmt)}$`,
      },
      model: {
        expr: `(${lit(D)}-x)*(1+${lit(s)}*${t}) + x*${fyE} - ${lit(A)}`,
        bracket: [0, D],
        description: "Value of Fund X at simple interest plus Fund Y at the periodic compound rate equals the combined value.",
      },
      distractors: [
        distractor("RATE_NOMINAL_AS_EFFECTIVE", asEff, `(${lit(A)} - ${lit(D)}*${fxE})/((1+${lit(j)})**${t} - ${fxE})`, {
          derivation: `$y[(1.${String(j).slice(2)})^{${t}} - ${dec(fx, 4)}] = ${mamt(A)} - ${mamt(D)}(${dec(fx, 4)}) \\Rightarrow y = ${shown(asEff, fmt)}$`,
          method: `Used ${pc(j)} as an annual effective rate.`,
          feedback: `Convertible ${frequency(m)} means ${pc(j)}/${m} per ${m === 12 ? "month" : m === 4 ? "quarter" : "half-year"}, compounded ${m * t} times: $(1 + ${dec(j / m, 5)})^{${m * t}}$.`,
        }),
        distractor("ALLOC_AGGREGATE_AS_EACH", aggregate, `${lit(A)}/${fyE}`, {
          derivation: `$y(${dec(fy, 6)}) = ${mamt(A)} \\Rightarrow y = ${shown(aggregate, fmt)}$`,
          method: "Treated the combined value as Fund Y's value alone.",
          feedback: `${amt(A)} is the value of both funds together, so Fund X's value must be subtracted first.`,
        }),
        distractor("VAR_OTHER_UNKNOWN", D - y, `${lit(D)} - (${lit(A)} - ${lit(D)}*${fxE})/(${fyE} - ${fxE})`, {
          derivation: `$${mamt(D)} - y = ${shown(D - y, fmt)}$`,
          method: "Reported the deposit into Fund X.",
          feedback: "The question asks for Fund Y.",
        }),
        distractor("MODEL_SIMPLE_AS_COMPOUND", bothCompound, `(${lit(A)} - ${lit(D)}*(1+${lit(s)})**${t})/(${fyE} - (1+${lit(s)})**${t})`, {
          derivation: `$y = \\dfrac{${mamt(A)} - ${mamt(D)}(1.${String(s).slice(2)})^{${t}}}{${dec(fy, 6)} - (1.${String(s).slice(2)})^{${t}}} = ${shown(bothCompound, fmt)}$`,
          method: "Compounded Fund X's simple interest.",
          feedback: `Simple interest: Fund X grows to $x(1 + ${dec(s, 3)} \\times ${t})$.`,
        }),
        distractor("MODEL_COMPOUND_AS_SIMPLE", ySimple, `(${lit(A)} - ${lit(D)}*${fxE})/(${lit(j)}*${t} - ${lit(s)}*${t})`, {
          derivation: `$y(${dec(j * t, 4)} - ${dec(s * t, 4)}) = ${mamt(A)} - ${mamt(D)}(${dec(fx, 4)}) \\Rightarrow y = ${shown(ySimple, fmt)}$`,
          method: "Gave Fund Y simple interest at its nominal rate.",
          feedback: "Fund Y compounds: interest is credited and then itself earns interest each period.",
        }),
      ],
      explanation: explanation({
        intuition: "Both funds start from one pot and end as one total. Every unit moved from X to Y changes the ending total by the difference in their growth factors — so the ending total pins down the split.",
        translation: {
          unknowns: [{ symbol: "$y$", meaning: "the deposit into Fund Y; Fund X receives $D - y$" }],
          relationships: [`$(D - y)(1 + ${dec(s, 3)}\\cdot ${t}) + y(1 + ${dec(j / m, 5)})^{${m * t}} = ${mamt(A)}$`],
          conditions: [`Fund Y compounds ${m} times a year at ${mpc(j)}/${m}.`],
          valuationDate: `Time ${t}.`,
          modelChoice: "One equation in y after substituting the deposit constraint.",
          assumptions: ["Both deposits at time 0.", "No withdrawals."],
        },
        solution: [
          { title: "Growth factors", body: `Fund X: $${dec(fx, 4)}$. Fund Y: $(1 + ${dec(j / m, 5)})^{${m * t}} = ${dec(fy, 6)}$.` },
          { title: "Equation", body: `$${mamt(D)}(${dec(fx, 4)}) + y(${dec(fy, 6)} - ${dec(fx, 4)}) = ${mamt(A)}$` },
          { title: "Solve", body: `$y = ${shown(y, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Effective annual rate first",
            body: `$1 + i_Y = (1 + ${dec(j / m, 5)})^{${m}} = ${dec(Math.pow(1 + j / m, m), 6)}$, then grow for ${t} years.`,
            whenUseful: "Same factor; helpful if you think in annual terms.",
          },
        ],
        transfer: {
          principle: "Translate each fund's rule into its own accumulation function before combining: simple $1 + st$, compound $(1 + j/m)^{mt}$.",
          unusual: "Three conventions (simple, nominal, combined total) appear in one short paragraph.",
          misread: "Nominal rates are easily used as effective, and the combined value is easily assigned to one fund.",
        },
      }),
      visuals: [
        {
          kind: "allocation",
          title: "Where the combined value comes from",
          parts: [
            { label: "Fund X (simple)", principal: D - y, interest: (D - y) * s * t, detail: `${pc(s)} simple` },
            { label: "Fund Y (compound)", principal: y, interest: y * (fy - 1), detail: `${pc(j)} convertible ${frequency(m)}` },
          ],
          total: { principal: D, interest: A - D },
        },
      ],
      markers: [fx, fy, fy - fx],
      presentation: ["multi-equation", "frequency", "indirect-wording"],
      features: features({ steps: 3, multiConcept: true, formulaRetrieval: true, unfamiliar: true }),
      chain: chain(
        [
          step("A.simple", "Fund X grows by simple interest.", ["1 + st", fx, "Fund X growth factor"], ["s", "t"]),
          step("A.nominal-equivalence", "Fund Y compounds at j/m per period for mt periods.", ["(1+j/m)^{mt}", fy, "Fund Y growth factor"], ["j", "m", "t"]),
          step("M.linear-system", "Total value = (D − y)·(X factor) + y·(Y factor); solve for y.", ["y", y, "deposit into Fund Y"], ["D", "A"], { rearranged: true }),
        ],
        {
          methods: ["substitution", "equation_construction"],
          stages: {
            RATE_NOMINAL_AS_EFFECTIVE: [1, "application"],
            ALLOC_AGGREGATE_AS_EACH: [2, "connection"],
            VAR_OTHER_UNKNOWN: [2, "interpretation"],
            MODEL_SIMPLE_AS_COMPOUND: [0, "selection", "A.compound"],
            MODEL_COMPOUND_AS_SIMPLE: [1, "selection", "A.simple"],
          },
          reasoning: "Each unit moved from X to Y changes the final total by the difference in growth factors; the given total fixes how many units moved.",
        }
      ),
      params: { D, s, j, m, t, A },
    };
  },
};

// ===================================================================== equivalent rates

const equivalentRates: QuestionTemplate = {
  id: "tvm-equivalent-rates",
  family: "tvm-rates",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.discount_rates",
  secondary: ["TVM.effective_nominal", "TVM.force_of_interest"],
  reasoning: ["formula_retrieval", "formula_reconstruction", "concept_recognition"],
  soaConcept: "Equivalent nominal and effective rates of interest and discount.",
  generate(rng, lvl): QuestionDraft {
    const fmt = PCT3;
    if (lvl === 1) {
      const m = rng.choice([2, 4, 12]);
      const d = gridRate(rng, 0.06, 0.12, 0.0025);
      const i = Math.pow(1 - d / m, -m) - 1;
      const asInterest = Math.pow(1 + d / m, m) - 1;
      const asEffDisc = d / (1 - d);
      const effDisc = 1 - Math.pow(1 - d / m, m);
      const nominalInt = (m * (d / m)) / (1 - d / m);
      const force = Math.exp(d) - 1;
      const per = m === 12 ? "month" : m === 4 ? "quarter" : "half-year";
      return {
        stem: `An investment fund credits interest at an annual nominal rate of discount of ${pc(d)} convertible ${frequency(m)}.\n\nCalculate the equivalent annual effective rate of interest.`,
        answer: {
          value: i,
          calc: `(1-${lit(d)}/${m})**(-${m})-1`,
          format: fmt,
          derivation: `$i = (1 - ${dec(d / m, 6)})^{-${m}} - 1 = ${shown(i, fmt)}$`,
        },
        model: {
          expr: `(1+x) - 1/(1-${lit(d)}/${m})**${m}`,
          bracket: [0, 0.5],
          description: `A unit at time 1 is worth $(1 - d^{(${m})}/${m})^{${m}}$ at time 0 under the discount rate and $(1+i)^{-1}$ under the effective rate.`,
        },
        distractors: [
          distractor("RATE_DISCOUNT_AS_INTEREST", asInterest, `(1+${lit(d)}/${m})**${m}-1`, {
            derivation: `$(1 + ${dec(d / m, 6)})^{${m}} - 1 = ${shown(asInterest, fmt)}$`,
            method: "Treated the nominal discount rate as a nominal interest rate.",
            feedback: `A discount rate shrinks the end-of-${per} value: $v = 1 - d^{(${m})}/${m}$ per ${per}, so accumulation is $(1 - d^{(${m})}/${m})^{-1}$ per ${per}.`,
          }),
          distractor("RATE_NOMINAL_AS_EFFECTIVE", asEffDisc, `${lit(d)}/(1-${lit(d)})`, {
            derivation: `$\\dfrac{${dec(d, 4)}}{1 - ${dec(d, 4)}} = ${shown(asEffDisc, fmt)}$`,
            method: "Treated the nominal discount rate as an annual effective discount rate.",
            feedback: `“Convertible ${frequency(m)}” means the rate is applied ${m} times a year at ${pc(d)}/${m}; it is not an effective annual rate.`,
          }),
          distractor("ALG_INVERTED_RATIO", effDisc, `1-(1-${lit(d)}/${m})**${m}`, {
            derivation: `$1 - (1 - ${dec(d / m, 6)})^{${m}} = ${shown(effDisc, fmt)}$`,
            method: "Computed the effective rate of discount, 1 − v, instead of 1/v − 1.",
            feedback: "Effective interest is $i = v^{-1} - 1$; $1 - v$ is the effective discount rate d, which is always smaller than i.",
          }),
          distractor("VAR_OTHER_UNKNOWN", nominalInt, `${m}*(${lit(d)}/${m})/(1-${lit(d)}/${m})`, {
            derivation: `$i^{(${m})} = ${m}\\cdot\\dfrac{${dec(d / m, 6)}}{1 - ${dec(d / m, 6)}} = ${shown(nominalInt, fmt)}$`,
            method: `Stopped at the equivalent nominal interest rate convertible ${frequency(m)}.`,
            feedback: "The question asks for the annual effective rate; the nominal rate still has to be compounded over the year.",
          }),
          distractor("RATE_FORCE_AS_EFFECTIVE", force, `exp(${lit(d)})-1`, {
            derivation: `$e^{${dec(d, 4)}} - 1 = ${shown(force, fmt)}$`,
            method: "Treated the discount rate as a force of interest.",
            feedback: "A force of interest is the limit as conversions become continuous. A rate convertible a finite number of times uses $(1 - d^{(m)}/m)^{-m}$.",
          }),
        ],
        explanation: explanation({
          intuition: `A discount rate quotes interest as a fraction of the end-of-${per} amount, collected up front. Each ${per}, a unit due at the end is worth $1 - d^{(${m})}/${m}$ now; compounding ${m} such ${per}s gives the year's discount factor, and its reciprocal is the year's growth.`,
          translation: {
            unknowns: [{ symbol: "$i$", meaning: "the equivalent annual effective interest rate" }],
            relationships: [`$(1 + i)^{-1} = (1 - d^{(${m})}/${m})^{${m}}$`],
            conditions: [`$d^{(${m})} = ${mpc(d)}$`],
            valuationDate: "One year: equivalence means equal accumulation over any period, so one year suffices.",
            modelChoice: "Equate one-year discount factors.",
            assumptions: ["Equivalent means producing the same accumulation over any period."],
          },
          solution: [
            { title: `Discount factor per ${per}`, body: `$1 - ${dec(d, 4)}/${m} = ${dec(1 - d / m, 6)}$` },
            { title: "Annual discount factor", body: `$v = ${dec(1 - d / m, 6)}^{${m}} = ${dec(Math.pow(1 - d / m, m), 6)}$` },
            { title: "Effective interest", body: `$i = 1/v - 1 = ${shown(i, fmt)}$` },
          ],
          alternatives: [
            {
              name: "Through the effective discount rate",
              body: `$d = 1 - v = ${dec(effDisc, 6)}$, then $i = d/(1 - d) = ${dec(i, 6)}$.`,
              whenUseful: "Useful if you want d as a stepping stone; one extra step.",
            },
          ],
          transfer: {
            principle: "Every rate convention is a statement about how a unit grows over a year. Convert each to a one-year accumulation factor and equate.",
            unusual: "Discount rates are quoted less often than interest rates, so the direction of the factor is easy to flip.",
            misread: "Discount and interest look interchangeable; they are not.",
          },
        }),
        visuals: [
          {
            kind: "growth",
            title: `One unit over a year: ${m} discount periods`,
            start: 0,
            end: 1,
            samples: range(0, m).map((k) => ({ t: k / m, value: Math.pow(1 - d / m, -k) })),
            markers: [{ t: 1, label: `1 + i = ${dec(1 + i, 5)}` }],
            caption: `Each ${per} multiplies the balance by 1/(1 − d/${m}).`,
          },
        ],
        markers: [1 - d / m, Math.pow(1 - d / m, m)],
        presentation: ["direct"],
        features: features({ steps: 2, formulaRetrieval: true }),
        chain: chain(
          [
            step("A.nominal-equivalence", "Compound the per-period discount factor over the year.", ["v", Math.pow(1 - d / m, m), "one-year discount factor"], ["d^{(m)}", "m"]),
            step("A.interest-discount", "Convert the discount factor to an effective interest rate.", ["i", i, "annual effective interest rate"], ["v"]),
          ],
          {
            stages: {
              RATE_DISCOUNT_AS_INTEREST: [0, "selection"],
              RATE_NOMINAL_AS_EFFECTIVE: [0, "application"],
              ALG_INVERTED_RATIO: [1, "application"],
              VAR_OTHER_UNKNOWN: [1, "interpretation"],
              RATE_FORCE_AS_EFFECTIVE: [0, "selection", "A.constant-force"],
            },
            reasoning: "Ask what 1 due at the end of the year is worth now: discount it one m-th of a year at a time, then invert.",
          }
        ),
        params: { d, m },
      };
    }

    const i4 = gridRate(rng, 0.04, 0.1, 0.0025);
    const d2 = 2 * (1 - Math.pow(1 + i4 / 4, -2));
    const asInterest = 2 * (Math.pow(1 + i4 / 4, 2) - 1);
    const asEff = 2 * (1 - Math.pow(1 + i4, -0.5));
    const rootErr = 2 * (1 - Math.pow(1 + i4 / 4, -0.5));
    const effective = 1 - Math.pow(1 + i4 / 4, -4);
    return {
      stem: `Fund A credits interest at an annual nominal rate of ${pc(i4)} convertible quarterly. Fund B credits interest at an annual nominal rate of discount $d$ convertible semiannually. Equal deposits made in the two funds at the same time have equal values at all later times.\n\nCalculate $d$.`,
      answer: {
        value: d2,
        calc: `2*(1-(1+${lit(i4)}/4)**(-2))`,
        format: fmt,
        derivation: `$d = 2\\big[1 - (1 + ${dec(i4 / 4, 6)})^{-2}\\big] = ${shown(d2, fmt)}$`,
      },
      model: {
        expr: `(1-x/2)**(-2) - (1+${lit(i4)}/4)**4`,
        bracket: [0.001, 0.3],
        description: "One year of growth must be the same in both funds: (1 − d/2)⁻² = (1 + i⁽⁴⁾/4)⁴.",
      },
      distractors: [
        distractor("RATE_DISCOUNT_AS_INTEREST", asInterest, `2*((1+${lit(i4)}/4)**2-1)`, {
          derivation: `$2[(1 + ${dec(i4 / 4, 6)})^{2} - 1] = ${shown(asInterest, fmt)}$`,
          method: "Found the equivalent nominal interest rate convertible semiannually.",
          feedback: "Fund B quotes a discount rate. Its half-year factor is $(1 - d/2)^{-1}$, not $1 + d/2$.",
        }),
        distractor("RATE_NOMINAL_AS_EFFECTIVE", asEff, `2*(1-(1+${lit(i4)})**(-0.5))`, {
          derivation: `$2[1 - (1.${String(i4).slice(2)})^{-1/2}] = ${shown(asEff, fmt)}$`,
          method: `Treated ${pc(i4)} as an annual effective rate.`,
          feedback: `Fund A's rate is nominal: it grows by ${pc(i4)}/4 each quarter, so one year is $(1 + ${dec(i4 / 4, 6)})^4$.`,
        }),
        distractor("ALG_ROOT_ERROR", rootErr, `2*(1-(1+${lit(i4)}/4)**(-0.5))`, {
          derivation: `$2[1 - (1 + ${dec(i4 / 4, 6)})^{-1/2}] = ${shown(rootErr, fmt)}$`,
          method: "Used the wrong power when converting quarters to half-years.",
          feedback: "A half-year contains two quarters, so the half-year factor is the quarterly factor squared.",
        }),
        distractor("RATE_ANNUAL_FOR_PERIODIC", i4 / (1 + i4), `${lit(i4)}/(1+${lit(i4)})`, {
          derivation: `$d = \\dfrac{${dec(i4, 4)}}{1 + ${dec(i4, 4)}} = ${shown(i4 / (1 + i4), fmt)}$`,
          method: "Applied d = i/(1 + i) directly to the nominal rates.",
          feedback: "That identity links effective rates over the same period. Nominal rates must first be turned into per-period rates for a common period.",
        }),
        distractor("VAR_OTHER_UNKNOWN", effective, `1-(1+${lit(i4)}/4)**(-4)`, {
          derivation: `$1 - (1 + ${dec(i4 / 4, 6)})^{-4} = ${shown(effective, fmt)}$`,
          method: "Computed the annual effective discount rate.",
          feedback: "The question asks for a nominal rate convertible semiannually: twice the half-year discount rate.",
        }),
      ],
      explanation: explanation({
        intuition: "Equivalent rates are different descriptions of the same growth. Put both funds on a common clock — one year — and match their growth factors.",
        translation: {
          unknowns: [{ symbol: "$d$", meaning: "Fund B's nominal discount rate convertible semiannually" }],
          relationships: [`$(1 - d/2)^{-2} = (1 + ${dec(i4, 4)}/4)^{4}$`],
          conditions: ["Equal values at all later times means equal accumulation factors."],
          valuationDate: "Any; one year is simplest.",
          modelChoice: "Match one-year accumulation factors.",
          assumptions: ["Both funds compound at their stated frequencies."],
        },
        solution: [
          { title: "Fund A per year", body: `$(1 + ${dec(i4 / 4, 6)})^4 = ${dec(Math.pow(1 + i4 / 4, 4), 6)}$` },
          { title: "Half-year discount factor", body: `$1 - d/2 = (1 + ${dec(i4 / 4, 6)})^{-2} = ${dec(Math.pow(1 + i4 / 4, -2), 6)}$` },
          { title: "Solve", body: `$d = 2(1 - ${dec(Math.pow(1 + i4 / 4, -2), 6)}) = ${shown(d2, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Half-year clock",
            body: `Over half a year Fund A grows by $(1 + i^{(4)}/4)^2$, which must equal $(1 - d/2)^{-1}$.`,
            whenUseful: "Shorter: match over the longer of the two conversion periods.",
          },
        ],
        transfer: {
          principle: "Equivalent rates have equal accumulation factors over any common period; pick the period that keeps exponents simple.",
          unusual: "The quantity asked for is a discount rate, built from an interest rate.",
          misread: "Discount rates accumulate through $(1 - d/m)^{-1}$, not $1 + d/m$.",
        },
      }),
      visuals: [
        {
          kind: "growth",
          title: "Same growth, two descriptions",
          start: 0,
          end: 1,
          samples: range(0, 4).map((k) => ({ t: k / 4, value: Math.pow(1 + i4 / 4, k) })),
          markers: [
            { t: 0.5, label: "half-year: (1 − d/2)⁻¹" },
            { t: 1, label: "year" },
          ],
        },
      ],
      markers: [Math.pow(1 + i4 / 4, 4), Math.pow(1 + i4 / 4, -2)],
      presentation: ["indirect-wording", "frequency"],
      features: features({ steps: 3, formulaRetrieval: true, unfamiliar: true }),
      chain: chain(
        [
          step("A.nominal-equivalence", "One year of Fund A's growth.", ["1+i", Math.pow(1 + i4 / 4, 4), "annual accumulation factor"], ["i^{(4)}"]),
          step("A.interest-discount", "The equivalent annual effective discount rate.", ["d", 1 - Math.pow(1 + i4 / 4, -4), "effective discount rate"], ["1+i"]),
          step("A.nominal-conversion", "Convert the effective discount rate to a nominal rate convertible semiannually.", ["d^{(2)}", d2, "nominal discount convertible semiannually"], ["d"], { rearranged: true }),
        ],
        {
          stages: {
            RATE_DISCOUNT_AS_INTEREST: [2, "selection", "A.nominal-equivalence"],
            RATE_NOMINAL_AS_EFFECTIVE: [0, "application"],
            ALG_ROOT_ERROR: [2, "application"],
            VAR_OTHER_UNKNOWN: [2, "interpretation"],
            RATE_ANNUAL_FOR_PERIODIC: [1, "selection", "A.interest-discount"],
          },
          reasoning: "Match growth over half a year directly: (1 + i⁽⁴⁾/4)² = (1 − d/2)⁻¹, and solve for d.",
        }
      ),
      params: { i4 },
    };
  },
};

// ===================================================================== variable force of interest

const variableForce: QuestionTemplate = {
  id: "tvm-variable-force",
  family: "tvm-force",
  topic: "TVM",
  levels: [2, 3],
  objective: "TVM.variable_force",
  secondary: ["TVM.force_of_interest", "TVM.accumulation_discount"],
  reasoning: ["formula_retrieval", "formula_reconstruction", "valuation_dates", "concept_recognition"],
  soaConcept: "Accumulation and present value under a time-varying force of interest.",
  generate(rng, lvl): QuestionDraft {
    const fmt = MONEY2;
    if (lvl === 2) {
      const p = rng.choice([1, 2]);
      const q = rng.choice([5, 8, 10, 15, 20]);
      const t1 = rng.int(1, 4);
      const t2 = t1 + rng.int(3, 7);
      const D = gridAmount(rng, 1000, 10000, 500);
      const factor = Math.pow((q + t2) / (q + t1), p);
      const AV = D * factor;
      const d1 = p / (q + t1);
      const constant = D * Math.exp(d1 * (t2 - t1));
      const fromZero = D * Math.pow((q + t2) / q, p);
      const asEffective = D * Math.pow(1 + d1, t2 - t1);
      const inverted = D / factor;
      const deltaText = p === 1 ? `\\dfrac{1}{${q} + t}` : `\\dfrac{${p}}{${q} + t}`;
      return {
        stem: `The force of interest at time t is $\\delta_t = ${deltaText}$ for $t \\ge 0$. A deposit of ${amt(D)} is made at time ${t1}.\n\nCalculate the value of this deposit at time ${t2}.`,
        answer: {
          value: AV,
          calc: `${lit(D)}*((${q}+${t2})/(${q}+${t1}))**${p}`,
          format: fmt,
          derivation: `$${mamt(D)}\\left(\\dfrac{${q + t2}}{${q + t1}}\\right)^{${p}} = ${shown(AV, fmt)}$`,
        },
        model: {
          expr: `${lit(D)}*exp(${p}*(log(${q}+${t2}) - log(${q}+${t1})))`,
          description: `Accumulate with $\\exp\\big(\\int_{${t1}}^{${t2}} \\delta_s\\,ds\\big)$, integrating ${p}/(${q} + s) to ${p}·ln(${q} + s).`,
        },
        distractors: [
          distractor("MODEL_CONSTANT_FORCE", constant, `${lit(D)}*exp(${p}/(${q}+${t1})*${t2 - t1})`, {
            derivation: `$${mamt(D)}\\,e^{${dec(d1, 5)} \\times ${t2 - t1}} = ${shown(constant, fmt)}$`,
            method: `Held the force fixed at its value at time ${t1}.`,
            feedback: "The force changes with t, so it must be integrated over the interval rather than frozen at one instant.",
          }),
          distractor("TIMING_VALUATION_DATE", fromZero, `${lit(D)}*((${q}+${t2})/${q})**${p}`, {
            derivation: `$${mamt(D)}\\left(\\dfrac{${q + t2}}{${q}}\\right)^{${p}} = ${shown(fromZero, fmt)}$`,
            method: "Integrated the force from time 0 instead of from the deposit date.",
            feedback: `The deposit only exists from time ${t1}; it earns interest over [${t1}, ${t2}].`,
          }),
          distractor("RATE_FORCE_AS_EFFECTIVE", asEffective, `${lit(D)}*(1+${p}/(${q}+${t1}))**${t2 - t1}`, {
            derivation: `$${mamt(D)}(1 + ${dec(d1, 5)})^{${t2 - t1}} = ${shown(asEffective, fmt)}$`,
            method: "Used the force of interest as an annual effective rate.",
            feedback: "A force of interest accumulates exponentially, $e^{\\int\\delta}$; it is not an effective rate.",
          }),
          distractor("ALG_INVERTED_RATIO", inverted, `${lit(D)}*((${q}+${t1})/(${q}+${t2}))**${p}`, {
            derivation: `$${mamt(D)}\\left(\\dfrac{${q + t1}}{${q + t2}}\\right)^{${p}} = ${shown(inverted, fmt)}$`,
            method: "Inverted the accumulation factor.",
            feedback: "Moving money forward in time increases it. If your factor is below 1, it is a discount factor.",
          }),
        ],
        explanation: explanation({
          intuition: "When the force of interest changes over time, growth is the product of many tiny instantaneous growths. Adding up the force over the interval — integrating it — gives the log of the growth factor.",
          translation: {
            unknowns: [{ symbol: `$A(${t1}, ${t2})$`, meaning: `the accumulation factor from ${t1} to ${t2}` }],
            relationships: [`$A(${t1},${t2}) = \\exp\\left(\\int_{${t1}}^{${t2}} \\delta_s\\,ds\\right)$`],
            conditions: [`$\\delta_s = ${deltaText.replace(/t/g, "s")}$`],
            valuationDate: `Time ${t2}; the deposit enters at time ${t1}.`,
            modelChoice: "Integrate the force over the period the money is invested.",
            assumptions: ["The force applies to all money invested over the interval."],
          },
          solution: [
            { title: "Integrate", body: `$\\int_{${t1}}^{${t2}} \\dfrac{${p}}{${q} + s}\\,ds = ${p}\\ln\\dfrac{${q + t2}}{${q + t1}}$` },
            { title: "Exponentiate", body: `$A = \\left(\\dfrac{${q + t2}}{${q + t1}}\\right)^{${p}} = ${dec(factor, 6)}$` },
            { title: "Accumulate", body: `$${mamt(D)} \\times ${dec(factor, 6)} = ${shown(AV, fmt)}$` },
          ],
          alternatives: [
            {
              name: "Ratio of accumulation functions",
              body: `$a(t) = \\left(\\dfrac{${q} + t}{${q}}\\right)^{${p}}$, so $A(${t1},${t2}) = a(${t2})/a(${t1})$.`,
              whenUseful: "Useful when several deposits at different dates need moving: compute a(t) once.",
            },
          ],
          transfer: {
            principle: "Under any force of interest, money moves from $t_1$ to $t_2$ by $\\exp\\int_{t_1}^{t_2}\\delta_s ds = a(t_2)/a(t_1)$.",
            unusual: "The deposit is made part-way through, so the integral does not start at 0.",
            misread: "Freezing δ at one value, or integrating from 0, are the usual slips.",
          },
        }),
        visuals: [
          {
            kind: "growth",
            title: "Accumulation under a varying force",
            start: t1,
            end: t2,
            samples: range(0, 20).map((k) => {
              const t = t1 + ((t2 - t1) * k) / 20;
              return { t, value: D * Math.pow((q + t) / (q + t1), p) };
            }),
            markers: [
              { t: t1, label: "deposit" },
              { t: t2, label: "value" },
            ],
            caption: "The slope of log-value is δ_t, which falls over time.",
          },
        ],
        markers: [factor],
        presentation: ["valuation-date"],
        features: features({ steps: 3, formulaRetrieval: true, multipleValuationDates: true }),
        chain: chain(
          [
            step("A.force-accumulation", "Integrate the force over the period the deposit is invested.", ["a(t_1,t_2)", factor, "accumulation factor"], ["δ_t", "t_1", "t_2"]),
            step("A.accumulation", "Scale the factor by the deposit.", ["AV", AV, "value at t_2"], ["D", "a(t_1,t_2)"]),
          ],
          {
            stages: {
              MODEL_CONSTANT_FORCE: [0, "selection", "A.constant-force"],
              TIMING_VALUATION_DATE: [0, "application"],
              RATE_FORCE_AS_EFFECTIVE: [0, "selection", "A.compound"],
              ALG_INVERTED_RATIO: [1, "application"],
            },
            reasoning: "The log of the growth factor is the area under δ. With δ = p/(q + t) that area is p·ln((q + t₂)/(q + t₁)).",
          }
        ),
        params: { p, q, t1, t2, D },
      };
    }

    const c = rng.choice([0.01, 0.012, 0.015, 0.02]);
    const t1 = rng.int(1, 3);
    const t2 = t1 + rng.int(2, 4);
    const Y = gridAmount(rng, 5000, 20000, 500);
    const vt = (t: number) => Math.exp((-c * t * t) / 2);
    const X = Y / (vt(t1) + 2 * vt(t2));
    const forgotHalf = Y / (Math.exp(-c * t1 * t1) + 2 * Math.exp(-c * t2 * t2));
    const asEff = Y / (Math.pow(1 + c * t1, -t1) + 2 * Math.pow(1 + c * t2, -t2));
    const inverted = Y / (vt(t1) + 0.5 * vt(t2));
    const grown = Y / (Math.exp((c * t1 * t1) / 2) + 2 * Math.exp((c * t2 * t2) / 2));
    return {
      stem: `The force of interest at time t is $\\delta_t = ${c}t$. A payment of $X$ at time ${t1} and a payment of $2X$ at time ${t2} have a total present value at time 0 of ${amt(Y)}.\n\nCalculate $X$.`,
      answer: {
        value: X,
        calc: `${lit(Y)}/(exp(-${c}*${t1 * t1}/2) + 2*exp(-${c}*${t2 * t2}/2))`,
        format: fmt,
        derivation: `$X = \\dfrac{${mamt(Y)}}{e^{-${c}(${t1 * t1})/2} + 2e^{-${c}(${t2 * t2})/2}} = ${shown(X, fmt)}$`,
      },
      model: {
        expr: `x*exp(-(${c}/2)*(${t1}**2 - 0)) + 2*x*exp(-(${c}/2)*(${t2}**2 - 0)) - ${lit(Y)}`,
        bracket: [0, Y],
        description: "Discount each payment by exp(−∫₀ᵗ δ_s ds) = exp(−c t²/2) and set the total equal to the given present value.",
      },
      distractors: [
        distractor("MODEL_CONSTANT_FORCE", forgotHalf, `${lit(Y)}/(exp(-${c}*${t1 * t1}) + 2*exp(-${c}*${t2 * t2}))`, {
          derivation: `$v(t) = e^{-${c}t\\cdot t}$, so $X = ${shown(forgotHalf, fmt)}$`,
          method: "Used δ at the payment date, multiplied by t, instead of integrating.",
          feedback: "δ grows over time, so its average over [0, t] is half its final value: $\\int_0^t cs\\,ds = ct^2/2$.",
        }),
        distractor("RATE_FORCE_AS_EFFECTIVE", asEff, `${lit(Y)}/((1+${c}*${t1})**(-${t1}) + 2*(1+${c}*${t2})**(-${t2}))`, {
          derivation: `$v(t) = (1 + ${c}t)^{-t}$, so $X = ${shown(asEff, fmt)}$`,
          method: "Treated δ at the payment date as an effective annual rate.",
          feedback: "A force of interest is a continuous rate; it discounts through an exponential of its integral.",
        }),
        distractor("TRANS_INVERTED_RELATION", inverted, `${lit(Y)}/(exp(-${c}*${t1 * t1}/2) + 0.5*exp(-${c}*${t2 * t2}/2))`, {
          derivation: `$X(e^{-${dec((c * t1 * t1) / 2, 4)}} + \\tfrac12 e^{-${dec((c * t2 * t2) / 2, 4)}}) = ${mamt(Y)} \\Rightarrow X = ${shown(inverted, fmt)}$`,
          method: "Made the later payment half of X.",
          feedback: "The later payment is 2X.",
        }),
        distractor("TIMING_VALUATION_DATE", Y / (vt(t1) + 2 * Math.exp((-c * (t2 * t2 - t1 * t1)) / 2)), `${lit(Y)}/(exp(-${c}*${t1 * t1}/2) + 2*exp(-${c}*(${t2 * t2}-${t1 * t1})/2))`, {
          derivation: `$X\\big(e^{-${dec((c * t1 * t1) / 2, 4)}} + 2e^{-${dec((c * (t2 * t2 - t1 * t1)) / 2, 4)}}\\big) = ${mamt(Y)} \\Rightarrow X = ${shown(Y / (vt(t1) + 2 * Math.exp((-c * (t2 * t2 - t1 * t1)) / 2)), fmt)}$`,
          method: `Discounted the time-${t2} payment only back to time ${t1}.`,
          feedback: `A present value at time 0 discounts each payment over [0, t]: the 2X payment needs the integral from 0 to ${t2}.`,
        }),
        distractor("ALG_INVERTED_RATIO", grown, `${lit(Y)}/(exp(${c}*${t1 * t1}/2) + 2*exp(${c}*${t2 * t2}/2))`, {
          derivation: `$X(e^{${dec((c * t1 * t1) / 2, 4)}} + 2e^{${dec((c * t2 * t2) / 2, 4)}}) = ${mamt(Y)} \\Rightarrow X = ${shown(grown, fmt)}$`,
          method: "Accumulated the payments instead of discounting them.",
          feedback: "A present value at time 0 discounts future payments: the exponent is negative.",
        }),
      ],
      explanation: explanation({
        intuition: "With a force that rises over time, money is discounted faster the further out it lies. Each payment's discount factor is the exponential of minus the area under δ from 0 to its date.",
        translation: {
          unknowns: [{ symbol: "$X$", meaning: `the payment at time ${t1}` }],
          relationships: [`$v(t) = \\exp\\left(-\\int_0^t ${c}s\\,ds\\right) = e^{-${c}t^2/2}$`, `$X v(${t1}) + 2X v(${t2}) = ${mamt(Y)}$`],
          conditions: ["Two payments with a fixed ratio."],
          valuationDate: "Time 0.",
          modelChoice: "Integrate the force to get each discount factor, then a linear equation in X.",
          assumptions: ["The force applies to all amounts."],
        },
        solution: [
          { title: "Discount factors", body: `$v(${t1}) = e^{-${dec((c * t1 * t1) / 2, 4)}} = ${dec(vt(t1), 6)}$, $v(${t2}) = e^{-${dec((c * t2 * t2) / 2, 4)}} = ${dec(vt(t2), 6)}$` },
          { title: "Equation", body: `$X(${dec(vt(t1), 6)} + 2 \\times ${dec(vt(t2), 6)}) = ${mamt(Y)}$` },
          { title: "Solve", body: `$X = ${shown(X, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Value at time " + t2,
            body: `Accumulate X from ${t1} to ${t2} with $e^{${c}(${t2}^2 - ${t1}^2)/2}$ and equate to $${mamt(Y)}e^{${c}\\cdot${t2 * t2}/2}$.`,
            whenUseful: "Shows the answer is independent of the valuation date chosen.",
          },
        ],
        transfer: {
          principle: "For any force of interest, $v(t) = \\exp(-\\int_0^t \\delta_s ds)$. The shape of δ only changes the integral.",
          unusual: "Two payments, a linear force, and a ratio between payments.",
          misread: "Using δ_t·t instead of the integral drops the factor 1/2.",
        },
      }),
      visuals: [
        {
          kind: "growth",
          title: "Discount factor under δ_t = ct",
          start: 0,
          end: t2,
          samples: range(0, 20).map((k) => {
            const t = (t2 * k) / 20;
            return { t, value: vt(t) };
          }),
          markers: [
            { t: t1, label: "X" },
            { t: t2, label: "2X" },
          ],
        },
      ],
      markers: [vt(t1), vt(t2)],
      presentation: ["multi-equation", "indirect-wording"],
      features: features({ steps: 3, formulaRetrieval: true, multipleValuationDates: true, unfamiliar: true }),
      chain: chain(
        [
          step("A.force-accumulation", "Discount factor to the first payment date.", ["v(t_1)", vt(t1), "discount factor to time 0"], ["δ_t", "t_1"]),
          step("A.force-accumulation", "Discount factor to the second payment date.", ["v(t_2)", vt(t2), "discount factor to time 0"], ["δ_t", "t_2"]),
          step("A.equation-of-value", "Present values add to the given total; solve for X.", ["X", X, "first payment"], ["v(t_1)", "v(t_2)", "Y"], { rearranged: true }),
        ],
        {
          methods: ["equation_construction"],
          stages: {
            MODEL_CONSTANT_FORCE: [0, "selection", "A.constant-force"],
            RATE_FORCE_AS_EFFECTIVE: [0, "selection", "A.compound"],
            TRANS_INVERTED_RELATION: [2, "connection"],
            ALG_INVERTED_RATIO: [0, "application"],
            TIMING_VALUATION_DATE: [1, "application"],
          },
          reasoning: "Each payment's discount factor is exp(−area under δ from 0 to its date); then the equation is linear in X.",
        }
      ),
      params: { c, t1, t2, Y },
    };
  },
};

// ===================================================================== unknown time or rate

const unknownTime: QuestionTemplate = {
  id: "tvm-unknown-time",
  family: "tvm-equation",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.equation_of_value",
  secondary: ["TVM.present_future_value", "TVM.simple_compound"],
  reasoning: ["cashflow_modelling", "valuation_dates", "algebra", "translation"],
  soaConcept: "Equation of value with an unknown time or unknown rate.",
  generate(rng, lvl): QuestionDraft {
    const A = gridAmount(rng, 1000, 8000, 250);
    const B = gridAmount(rng, 1000, 8000, 250);
    const k = rng.int(2, 5);

    if (lvl === 1) {
      const i = gridRate(rng, 0.04, 0.09, 0.005);
      const nTarget = rng.int(k + 5, k + 15) + rng.float(0.1, 0.9, 2);
      const T = Math.round((A + B * Math.pow(1 + i, -k)) * Math.pow(1 + i, nTarget));
      const base = A + B * Math.pow(1 + i, -k);
      const n = Math.log(T / base) / Math.log(1 + i);
      const atZero = Math.log(T / (A + B)) / Math.log(1 + i);
      const simple = (T - A - B + i * k * B) / (i * (A + B));
      const wrongDir = Math.log(T / (A + B * Math.pow(1 + i, k))) / Math.log(1 + i);
      const forceDiv = Math.log(T / base) / i;
      const fmt = YEARS;
      const lnG = `log(1+${lit(i)})`;
      return {
        stem: `A deposit of ${amt(A)} is made into a fund at time 0, and a further deposit of ${amt(B)} is made at time ${k}. The fund earns an annual effective interest rate of ${pc(i)}. The fund first reaches ${amt(T)} at time $n$.\n\nCalculate $n$.`,
        answer: {
          value: n,
          calc: `log(${lit(T)}/(${lit(A)} + ${lit(B)}*(1+${lit(i)})**(-${k})))/${lnG}`,
          format: fmt,
          derivation: `$n = \\dfrac{\\ln(${mamt(T)} / ${mnum(base, 2)})}{\\ln ${dec(1 + i, 4)}} = ${shown(n, fmt)}$`,
        },
        model: {
          expr: `${lit(A)}*(1+${lit(i)})**x + ${lit(B)}*(1+${lit(i)})**(x-${k}) - ${lit(T)}`,
          bracket: [k, 80],
          description: `At time n the two deposits, each accumulated from its own date, add to ${amt(T)}.`,
        },
        distractors: [
          distractor("TIMING_MISSING_PERIOD", atZero, `log(${lit(T)}/(${lit(A)} + ${lit(B)}))/${lnG}`, {
            derivation: `$\\dfrac{\\ln(${mamt(T)}/${A + B})}{\\ln ${dec(1 + i, 4)}} = ${shown(atZero, fmt)}$`,
            method: `Treated the second deposit as if it were made at time 0.`,
            feedback: `The second deposit earns interest only from time ${k}; it has ${k} fewer years of growth.`,
          }),
          distractor("MODEL_COMPOUND_AS_SIMPLE", simple, `(${lit(T)} - ${lit(A)} - ${lit(B)} + ${lit(i)}*${k}*${lit(B)})/(${lit(i)}*(${lit(A)}+${lit(B)}))`, {
            derivation: `$${A}(1 + ${dec(i, 3)}n) + ${B}(1 + ${dec(i, 3)}(n - ${k})) = ${mamt(T)} \\Rightarrow n = ${shown(simple, fmt)}$`,
            method: "Accumulated with simple interest.",
            feedback: "An effective rate compounds: growth over n years is $(1+i)^n$.",
          }),
          distractor("TIMING_VALUATION_DATE", wrongDir, `log(${lit(T)}/(${lit(A)} + ${lit(B)}*(1+${lit(i)})**${k}))/${lnG}`, {
            derivation: `$\\dfrac{\\ln(${mamt(T)} / (${A} + ${B}(${dec(1 + i, 4)})^{${k}}))}{\\ln ${dec(1 + i, 4)}} = ${shown(wrongDir, fmt)}$`,
            method: `Moved the time-${k} deposit to time 0 by accumulating it instead of discounting it.`,
            feedback: `Bringing a time-${k} amount back to time 0 divides by $(1+i)^{${k}}$.`,
          }),
          distractor("RATE_FORCE_AS_EFFECTIVE", forceDiv, `log(${lit(T)}/(${lit(A)} + ${lit(B)}*(1+${lit(i)})**(-${k})))/${lit(i)}`, {
            derivation: `$\\dfrac{\\ln(${mamt(T)} / ${mnum(base, 2)})}{${dec(i, 3)}} = ${shown(forceDiv, fmt)}$`,
            method: "Divided by i instead of ln(1 + i).",
            feedback: "Solving $(1+i)^n = R$ gives $n = \\ln R / \\ln(1+i)$. Dividing by i treats i as a force of interest.",
          }),
        ],
        explanation: explanation({
          intuition: `The fund holds two deposits that started growing at different times. Bring them to a common date — time 0 is easiest — and the whole fund behaves like one deposit of ${amt(A)} + ${amt(B)}v^${k} growing from time 0.`,
          translation: {
            unknowns: [{ symbol: "$n$", meaning: `the time at which the fund reaches ${amt(T)}` }],
            relationships: [`$${A}(1+i)^n + ${B}(1+i)^{n-${k}} = ${mamt(T)}$`],
            conditions: [`$n > ${k}$`],
            valuationDate: "Time n, then factor out $(1+i)^n$.",
            modelChoice: "Equation of value with an unknown exponent: factor and take logarithms.",
            assumptions: ["No withdrawals.", "Compound interest throughout."],
          },
          solution: [
            { title: "Common factor", body: `$(1+i)^n(${A} + ${B}v^{${k}}) = ${mamt(T)}$, with $${A} + ${B}v^{${k}} = ${mnum(base, 2)}$` },
            { title: "Logarithms", body: `$n\\ln(${dec(1 + i, 4)}) = \\ln(${mamt(T)} / ${mnum(base, 2)})$` },
            { title: "Solve", body: `$n = ${shown(n, fmt)}$` },
          ],
          alternatives: [
            {
              name: "Equivalent single deposit",
              body: `The time-0 value of the deposits is ${mnum(base, 2)}; solve $${mnum(base, 2)}(1+i)^n = ${mamt(T)}$.`,
              whenUseful: "The same calculation, phrased as a single cash flow — useful for building intuition.",
            },
          ],
          transfer: {
            principle: "Any set of deposits can be replaced by its value at a single date; the equation of value then has one term and a log solves for time.",
            unusual: "The unknown is a time, which appears as an exponent.",
            misread: "The later deposit is easily treated as made at time 0.",
          },
        }),
        visuals: [
          {
            kind: "timeline",
            title: "Two deposits, one target",
            unit: "year",
            rate: i,
            flows: [
              { t: 0, amount: A, dir: "out", label: "deposit" },
              { t: k, amount: B, dir: "out", label: "deposit" },
              { t: Math.round(n * 100) / 100, amount: T, dir: "in", label: "target" },
            ],
            valuationTimes: [0, k],
          },
        ],
        markers: [base],
        presentation: ["unknown-time"],
        features: features({ steps: 3, multipleValuationDates: true }),
        chain: chain(
          [
            step("A.discount-factor", "Replace the two deposits by their single value at time 0.", ["A + Bv^k", base, "time-0 value of the deposits"], ["A", "B", "k"], { valuationDate: "0" }),
            step("A.equation-of-value", "That single amount grows to the target at time n.", ["(1+i)^n", T / base, "required growth"], ["T"]),
            step("M.logarithm", "Take logarithms to free the exponent.", ["n", n, "time to reach the target"], ["(1+i)^n"], { rearranged: true }),
          ],
          {
            methods: ["logarithms", "valuation_dates"],
            stages: {
              TIMING_MISSING_PERIOD: [0, "application"],
              MODEL_COMPOUND_AS_SIMPLE: [1, "selection", "A.simple"],
              TIMING_VALUATION_DATE: [0, "application"],
              RATE_FORCE_AS_EFFECTIVE: [2, "application"],
            },
            reasoning: "Factor (1 + i)ⁿ out of the time-n equation of value; what is left is a single deposit growing to the target.",
          }
        ),
        params: { A, B, k, i, T },
      };
    }

    const n = rng.int(k + 6, k + 14);
    const i0 = gridRate(rng, 0.04, 0.09, 0.0025);
    const T = Math.round(A * Math.pow(1 + i0, n) + B * Math.pow(1 + i0, n - k));
    const f = (r: number) => A * Math.pow(1 + r, n) + B * Math.pow(1 + r, n - k) - T;
    const i = solveRoot(f, 0.0001, 0.5);
    const simple = (T - A - B) / (A * n + B * (n - k));
    const sameStart = Math.pow(T / (A + B), 1 / n) - 1;
    const extra = solveRoot((r) => A * Math.pow(1 + r, n) + B * Math.pow(1 + r, n - k + 1) - T, 0.0001, 0.5);
    const faceB = Math.pow((T - B) / A, 1 / n) - 1;
    const fmt = PCT3;
    return {
      stem: `A deposit of ${amt(A)} is made into a fund at time 0, and a further deposit of ${amt(B)} is made at time ${k}. At time ${n} the fund is worth ${amt(T)}.\n\nCalculate the annual effective interest rate earned by the fund.`,
      answer: {
        value: i,
        calc: `${lit(A)}*(1+x)**${n} + ${lit(B)}*(1+x)**${n - k} - ${lit(T)}`,
        format: fmt,
        derivation: `$${A}(1+i)^{${n}} + ${B}(1+i)^{${n - k}} = ${mamt(T)} \\Rightarrow i = ${shown(i, fmt)}$`,
      },
      model: {
        expr: `${lit(A)} + ${lit(B)}*(1+x)**(-${k}) - ${lit(T)}*(1+x)**(-${n})`,
        bracket: [0.0001, 0.4],
        description: "Equation of value at time 0: deposits equal the discounted final value.",
      },
      distractors: [
        distractor("MODEL_COMPOUND_AS_SIMPLE", simple, `(${lit(T)} - ${lit(A)} - ${lit(B)})/(${lit(A)}*${n} + ${lit(B)}*${n - k})`, {
          derivation: `$${A}(1 + ${n}i) + ${B}(1 + ${n - k}i) = ${mamt(T)} \\Rightarrow i = ${shown(simple, fmt)}$`,
          method: "Solved with simple interest.",
          feedback: "With compound interest, interest earns interest; the simple-interest rate that fits is higher.",
        }),
        distractor("TIMING_MISSING_PERIOD", sameStart, `(${lit(T)}/(${lit(A)}+${lit(B)}))**(1/${n})-1`, {
          derivation: `$(${A + B})(1+i)^{${n}} = ${mamt(T)} \\Rightarrow i = ${shown(sameStart, fmt)}$`,
          method: "Treated both deposits as made at time 0.",
          feedback: `The second deposit is invested for only ${n - k} years.`,
        }),
        distractor("TIMING_EXTRA_PERIOD", extra, `${lit(A)}*(1+x)**${n} + ${lit(B)}*(1+x)**${n - k + 1} - ${lit(T)}`, {
          derivation: `$${A}(1+i)^{${n}} + ${B}(1+i)^{${n - k + 1}} = ${mamt(T)} \\Rightarrow i = ${shown(extra, fmt)}$`,
          method: `Gave the second deposit ${n - k + 1} years of interest.`,
          feedback: `From time ${k} to time ${n} is ${n - k} years.`,
        }),
        distractor("TRANS_IGNORED_CONDITION", faceB, `((${lit(T)} - ${lit(B)})/${lit(A)})**(1/${n})-1`, {
          derivation: `$${A}(1+i)^{${n}} = ${mamt(T)} - ${B} \\Rightarrow i = ${shown(faceB, fmt)}$`,
          method: "Subtracted the second deposit at face value, ignoring its interest.",
          feedback: "The second deposit also earns interest from its own date; it is not part of the final value at face value.",
        }),
      ],
      explanation: explanation({
        intuition: "The rate is the one that makes the two deposits, each growing for its own length of time, land exactly on the final value.",
        translation: {
          unknowns: [{ symbol: "$i$", meaning: "the annual effective rate" }],
          relationships: [`$${A}(1+i)^{${n}} + ${B}(1+i)^{${n - k}} = ${mamt(T)}$`],
          conditions: ["One unknown, one equation, no closed form."],
          valuationDate: `Time ${n}.`,
          modelChoice: "An equation of value solved numerically (calculator cash-flow worksheet or trial and error).",
          assumptions: ["Constant effective rate.", "No withdrawals."],
        },
        solution: [
          { title: "Equation", body: `$${A}(1+i)^{${n}} + ${B}(1+i)^{${n - k}} - ${mamt(T)} = 0$` },
          { title: "Bracket", body: `At $i = ${dec(i - 0.005, 3)}$ the left side is ${mnum(f(i - 0.005), 2)}; at $i = ${dec(i + 0.005, 3)}$ it is ${mnum(f(i + 0.005), 2)}.` },
          { title: "Solve", body: `$i = ${shown(i, fmt)}$` },
        ],
        alternatives: [
          {
            name: "Calculator cash-flow IRR",
            body: `CF0 = −${A}, CF${k} = −${B} (zeros between), CF${n} = +${T}; compute IRR.`,
            whenUseful: "The standard exam technique for any unknown rate.",
          },
        ],
        transfer: {
          principle: "When the rate is unknown, write the equation of value and solve it numerically; check by substituting back.",
          unusual: "The unknown is the rate, so the equation cannot be rearranged.",
          misread: "Simple interest gives a tidy linear equation — which is exactly why it is tempting.",
        },
      }),
      visuals: [
        {
          kind: "timeline",
          title: "Deposits and final value",
          unit: "year",
          rate: i,
          flows: [
            { t: 0, amount: A, dir: "out", label: "deposit" },
            { t: k, amount: B, dir: "out", label: "deposit" },
            { t: n, amount: T, dir: "in", label: "value" },
          ],
          valuationTimes: [n, 0],
        },
      ],
      markers: [],
      presentation: ["unknown-rate", "rearrange-first"],
      features: features({ steps: 2, unfamiliar: true }),
      chain: chain(
        [
          step("A.equation-of-value", "Write the time-n value of both deposits and equate it to the fund value.", ["T", T, "fund value at time n"], ["A", "B", "k", "n"]),
          step("M.root-finding", "The rate appears in two powers, so solve numerically.", ["i", i, "annual effective rate"], ["equation of value"], { rearranged: true }),
        ],
        {
          methods: ["equation_construction", "numerical_root"],
          stages: {
            MODEL_COMPOUND_AS_SIMPLE: [0, "selection", "A.simple"],
            TIMING_MISSING_PERIOD: [0, "application"],
            TIMING_EXTRA_PERIOD: [0, "application"],
            TRANS_IGNORED_CONDITION: [0, "application"],
          },
          reasoning: "Try a rate, compute the fund value, adjust: the value rises with the rate, so a bracket narrows quickly.",
        }
      ),
      params: { A, B, k, n, T },
    };
  },
};

// ===================================================================== real returns

const realReturn: QuestionTemplate = {
  id: "tvm-real-return",
  family: "tvm-inflation",
  topic: "TVM",
  levels: [1, 2],
  objective: "TVM.inflation_real",
  secondary: ["TVM.present_future_value", "ANNUITIES.level_payment"],
  reasoning: ["formula_selection", "concept_recognition", "financial_intuition"],
  soaConcept: "Real rates of interest and purchasing power under inflation.",
  generate(rng, lvl): QuestionDraft {
    const i = gridRate(rng, 0.05, 0.1, 0.005);
    const r = gridRate(rng, 0.015, 0.04, 0.005);
    const n = rng.int(5, 15);
    const fmt = MONEY0;
    if (lvl === 1) {
      const D = gridAmount(rng, 5000, 50000, 1000);
      const real = D * Math.pow((1 + i) / (1 + r), n);
      const approx = D * Math.pow(1 + i - r, n);
      const ignored = D * Math.pow(1 + i, n);
      const multiplied = D * Math.pow((1 + i) * (1 + r), n);
      const short = (D * Math.pow(1 + i, n)) / Math.pow(1 + r, n - 1);
      return {
        stem: `An investment of ${amt(D)} earns an annual effective interest rate of ${pc(i)} for ${n} years. Inflation over the period is ${pc(r)} per year.\n\nCalculate the value of the investment at the end of ${n} years, measured in purchasing power at time 0.`,
        answer: {
          value: real,
          calc: `${lit(D)}*((1+${lit(i)})/(1+${lit(r)}))**${n}`,
          format: fmt,
          derivation: `$${mamt(D)}\\left(\\dfrac{${dec(1 + i, 3)}}{${dec(1 + r, 3)}}\\right)^{${n}} = ${shown(real, fmt)}$`,
        },
        model: {
          expr: `${lit(D)}*(1+${lit(i)})**${n} / (1+${lit(r)})**${n}`,
          description: "Accumulate in money terms at i, then deflate by n years of inflation.",
        },
        distractors: [
          distractor("FORMULA_APPROX_REAL", approx, `${lit(D)}*(1+${lit(i)}-${lit(r)})**${n}`, {
            derivation: `$${mamt(D)}(1 + ${dec(i, 3)} - ${dec(r, 3)})^{${n}} = ${shown(approx, fmt)}$`,
            method: "Used i − r as the real rate.",
            feedback: `The real rate is $(1+i)/(1+r) - 1 = ${dec((1 + i) / (1 + r) - 1, 6)}$, a little below i − r. Over ${n} years the gap compounds.`,
          }),
          distractor("TRANS_IGNORED_CONDITION", ignored, `${lit(D)}*(1+${lit(i)})**${n}`, {
            derivation: `$${mamt(D)}(${dec(1 + i, 3)})^{${n}} = ${shown(ignored, fmt)}$`,
            method: "Ignored inflation.",
            feedback: "Purchasing power at time 0 means removing n years of inflation from the money value.",
          }),
          distractor("ALG_DIVIDE_ERROR", multiplied, `${lit(D)}*((1+${lit(i)})*(1+${lit(r)}))**${n}`, {
            derivation: `$${mamt(D)}(${dec(1 + i, 3)} \\times ${dec(1 + r, 3)})^{${n}} = ${shown(multiplied, fmt)}$`,
            method: "Multiplied by the inflation factor instead of dividing.",
            feedback: "Inflation erodes purchasing power, so it divides the money value.",
          }),
          distractor("TIMING_EXTRA_PERIOD", (D * Math.pow(1 + i, n)) / Math.pow(1 + r, n + 1), `${lit(D)}*(1+${lit(i)})**${n}/(1+${lit(r)})**${n + 1}`, {
            derivation: `$\\dfrac{${mamt(D)}(${dec(1 + i, 3)})^{${n}}}{(${dec(1 + r, 3)})^{${n + 1}}} = ${shown((D * Math.pow(1 + i, n)) / Math.pow(1 + r, n + 1), fmt)}$`,
            method: `Deflated for ${n + 1} years.`,
            feedback: `There are exactly ${n} years of price rises between time 0 and time ${n}.`,
          }),
          distractor("TIMING_MISSING_PERIOD", short, `${lit(D)}*(1+${lit(i)})**${n}/(1+${lit(r)})**${n - 1}`, {
            derivation: `$\\dfrac{${mamt(D)}(${dec(1 + i, 3)})^{${n}}}{(${dec(1 + r, 3)})^{${n - 1}}} = ${shown(short, fmt)}$`,
            method: `Deflated for only ${n - 1} years.`,
            feedback: `Prices rise for all ${n} years between time 0 and time ${n}.`,
          }),
        ],
        explanation: realExplanation({ i, r, n, value: real, fmt, annuity: false }),
        visuals: [
          {
            kind: "series",
            title: "Money value versus purchasing power",
            unit: "year",
            series: [
              { label: "money value", values: range(0, n).map((t) => ({ t, amount: D * Math.pow(1 + i, t) })) },
              { label: "purchasing power", values: range(0, n).map((t) => ({ t, amount: D * Math.pow((1 + i) / (1 + r), t) })) },
            ],
          },
        ],
        markers: [(1 + i) / (1 + r) - 1, D * Math.pow(1 + i, n)],
        presentation: ["direct"],
        features: features({ steps: 2, formulaRetrieval: true }),
        chain: chain(
          [
            step("F.real-rate", "Purchasing power grows at the real rate.", ["i'", (1 + i) / (1 + r) - 1, "real rate"], ["i", "r"]),
            step("A.compound", "Compound the real rate for n years.", ["V", real, "value in time-0 purchasing power"], ["D", "i'", "n"]),
          ],
          {
            stages: {
              FORMULA_APPROX_REAL: [0, "selection"],
              TRANS_IGNORED_CONDITION: [0, "application"],
              ALG_DIVIDE_ERROR: [0, "application"],
              TIMING_MISSING_PERIOD: [1, "application"],
              TIMING_EXTRA_PERIOD: [1, "application"],
            },
            reasoning: "Accumulate in money at i, then divide by n years of inflation — the ratio of the two growth factors is the real growth.",
          }
        ),
        params: { D, i, r, n },
      };
    }

    const P = gridAmount(rng, 1000, 6000, 250);
    const realAV = (P * sn(n, i)) / Math.pow(1 + r, n);
    const jr = (1 + i) / (1 + r) - 1;
    const atReal = P * sn(n, jr);
    const approx = (P * sn(n, i - r)) ;
    const nominal = P * sn(n, i);
    const short = (P * sn(n, i)) / Math.pow(1 + r, n - 1);
    return {
      stem: `Deposits of ${amt(P)} are made at the end of each year for ${n} years into a fund earning an annual effective interest rate of ${pc(i)}. The deposits are fixed in money terms. Inflation is ${pc(r)} per year.\n\nCalculate the value of the fund immediately after the last deposit, measured in purchasing power at time 0.`,
      answer: {
        value: realAV,
        calc: `${lit(P)}*${sExpr(n, i)}/(1+${lit(r)})**${n}`,
        format: fmt,
        derivation: `$\\dfrac{${P}\\,${sSym(n)}}{(${dec(1 + r, 3)})^{${n}}} = ${shown(realAV, fmt)}$`,
      },
      model: {
        expr: `${sumOf(range(1, n).map((t) => `${lit(P)}*(1+${lit(i)})**${n - t}`))}/(1+${lit(r)})**${n}`,
        description: "Each deposit accumulated in money terms to time n, then the total deflated to time-0 prices.",
      },
      distractors: [
        distractor("CONC_REAL_NOMINAL_MIX", atReal, `${lit(P)}*${sExpr(n, `((1+${lit(i)})/(1+${lit(r)})-1)`)}`, {
          derivation: `$${P}\\,${sSym(n, "j")}$ at $j = ${dec(jr, 6)}$ $= ${shown(atReal, fmt)}$`,
          method: "Accumulated the deposits at the real rate.",
          feedback: "Accumulating at the real rate assumes deposits rise with inflation. These deposits are fixed in money terms, so later deposits are worth less in real terms.",
        }),
        distractor("FORMULA_APPROX_REAL", approx, `${lit(P)}*${sExpr(n, `(${lit(i)}-${lit(r)})`)}`, {
          derivation: `$${P}\\,${sSym(n)}$ at $${dec(i - r, 4)}$ $= ${shown(approx, fmt)}$`,
          method: "Accumulated at i − r.",
          feedback: "i − r is an approximation to the real rate, and the real rate itself would only apply to indexed deposits.",
        }),
        distractor("TRANS_IGNORED_CONDITION", nominal, `${lit(P)}*${sExpr(n, i)}`, {
          derivation: `$${P}\\,${sSym(n)} = ${shown(nominal, fmt)}$`,
          method: "Ignored inflation.",
          feedback: "The question asks for purchasing power at time 0.",
        }),
        distractor("ALG_DIVIDE_ERROR", P * sn(n, i) * Math.pow(1 + r, n), `${lit(P)}*${sExpr(n, i)}*(1+${lit(r)})**${n}`, {
          derivation: `$${P}\\,${sSym(n)}(${dec(1 + r, 3)})^{${n}} = ${shown(P * sn(n, i) * Math.pow(1 + r, n), fmt)}$`,
          method: "Multiplied by the inflation factor instead of dividing.",
          feedback: "Inflation reduces what money buys, so converting to time-0 prices divides by $(1+r)^n$.",
        }),
        distractor("TIMING_MISSING_PERIOD", short, `${lit(P)}*${sExpr(n, i)}/(1+${lit(r)})**${n - 1}`, {
          derivation: `$\\dfrac{${P}\\,${sSym(n)}}{(${dec(1 + r, 3)})^{${n - 1}}} = ${shown(short, fmt)}$`,
          method: `Deflated for ${n - 1} years.`,
          feedback: `The fund is valued at time ${n}, so ${n} years of price rises separate it from time 0.`,
        }),
      ],
      explanation: realExplanation({ i, r, n, value: realAV, fmt, annuity: true }),
      visuals: [
        {
          kind: "series",
          title: "Each deposit: money value and real value",
          unit: "year",
          series: [
            { label: "deposit (money)", values: range(1, n).map((t) => ({ t, amount: P })) },
            { label: "deposit (time-0 prices)", values: range(1, n).map((t) => ({ t, amount: P / Math.pow(1 + r, t) })) },
          ],
          caption: "Fixed money deposits buy less each year — so the real rate cannot simply replace i.",
        },
      ],
      markers: [nominal, jr],
      presentation: ["combined-topics", "indirect-wording"],
      features: features({ steps: 3, multiConcept: true, unfamiliar: true }),
      chain: chain(
        [
          step("B.annuity-immediate-av", "Accumulate the money deposits at the money rate.", ["P s_n", P * sn(n, i), "fund in money terms"], ["P", "i", "n"], { valuationDate: "n" }),
          step("F.real-rate", "Deflate the single money amount to time-0 prices.", ["V", realAV, "fund in time-0 purchasing power"], ["(1+r)^n"]),
        ],
        {
          stages: {
            CONC_REAL_NOMINAL_MIX: [0, "selection", "F.real-rate"],
            FORMULA_APPROX_REAL: [1, "selection"],
            TRANS_IGNORED_CONDITION: [1, "application"],
            ALG_DIVIDE_ERROR: [1, "application"],
            TIMING_MISSING_PERIOD: [1, "application"],
          },
          reasoning: "Fixed money deposits are nominal amounts: value them at the nominal rate, then convert the total to real terms once.",
        }
      ),
      params: { P, i, r, n },
    };
  },
};

function realExplanation(p: { i: number; r: number; n: number; value: number; fmt: AnswerFormat; annuity: boolean }) {
  const { i, r, n, value, fmt, annuity } = p;
  return explanation({
    intuition: annuity
      ? "Two separate effects are at work: the fund grows at the money rate, and money itself loses purchasing power. Do the money accumulation first, then convert the single final amount to time-0 prices."
      : "Money grows at i, but prices grow at r. What you can buy grows by the ratio of the two each year: (1 + i)/(1 + r).",
    translation: {
      unknowns: [{ symbol: "$V$", meaning: `the time-${n} fund value in time-0 purchasing power` }],
      relationships: annuity
        ? [`$V = \\dfrac{P\\,${sSym(n)}}{(1+r)^{${n}}}$ at $i = ${mpc(i)}$`]
        : [`$V = D\\left(\\dfrac{1+i}{1+r}\\right)^{${n}}$`],
      conditions: [`$r = ${mpc(r)}$ per year`],
      valuationDate: `Time ${n} in money terms, then deflated to time-0 prices.`,
      modelChoice: annuity ? "Nominal accumulation, then deflation; the real rate only applies to inflation-indexed amounts." : "Real accumulation factor.",
      assumptions: ["Inflation is constant.", "Purchasing power is measured with the same price index throughout."],
    },
    solution: annuity
      ? [
          { title: "Money value", body: `$${sSym(n)} = ${dec(sn(n, i), 5)}$` },
          { title: "Deflate", body: `$(1 + r)^{${n}} = ${dec(Math.pow(1 + r, n), 6)}$` },
          { title: "Real value", body: `$V = ${shown(value, fmt)}$` },
        ]
      : [
          { title: "Real growth per year", body: `$\\dfrac{${dec(1 + i, 3)}}{${dec(1 + r, 3)}} = ${dec((1 + i) / (1 + r), 6)}$` },
          { title: "Compound", body: `$(${dec((1 + i) / (1 + r), 6)})^{${n}} = ${dec(Math.pow((1 + i) / (1 + r), n), 6)}$` },
          { title: "Real value", body: `$V = ${shown(value, fmt)}$` },
        ],
    alternatives: [
      {
        name: "Real-rate discounting",
        body: annuity
          ? "Each deposit's real value at time 0 is $P/(1+r)^t$; growing that at the real rate gives the same answer as nominal-then-deflate."
          : "Accumulate at i, then divide by $(1 + r)^n$ — same factor.",
        whenUseful: "A check that the real rate and the money rate never get mixed.",
      },
    ],
    transfer: {
      principle: "Keep nominal amounts with nominal rates and real amounts with real rates; convert at the end with $(1 + r)^n$.",
      unusual: annuity ? "The deposits are fixed in money, not indexed — which changes which rate applies." : "The answer is in purchasing power, not money.",
      misread: "i − r is only an approximation, and the real rate applies only to indexed amounts.",
    },
  });
}

// ===================================================================== two rate regimes, worked backwards

const twoRegimes: QuestionTemplate = {
  id: "tvm-two-regimes",
  family: "tvm-equation",
  topic: "TVM",
  levels: [2, 3],
  objective: "TVM.accumulation_discount",
  secondary: ["TVM.discount_rates", "TVM.effective_nominal", "TVM.force_of_interest"],
  reasoning: ["valuation_dates", "cashflow_modelling", "algebra", "multistep", "translation"],
  soaConcept: "Accumulation through successive rate regimes with an intermediate withdrawal, solved backwards.",
  generate(rng, lvl): QuestionDraft {
    const a = rng.int(3, 6);
    const b = rng.int(4, 8);
    const d = gridRate(rng, 0.06, 0.1, 0.005);
    const F = gridAmount(rng, 10000, 40000, 500);
    const fmt = MONEY0;
    const g1 = Math.pow(1 - d, -a);

    if (lvl === 2) {
      const j = gridRate(rng, 0.07, 0.12, 0.005);
      const g2 = Math.pow(1 + j / 12, 12 * b);
      const W = gridAmount(rng, 1000, Math.round(F / 2000) * 1000, 500);
      const X = (F / g2 + W) / g1;
      const asInterest = (F / g2 + W) / Math.pow(1 + d, a);
      const wAtEnd = (F + W) / g2 / g1;
      const nominalEff = (F / Math.pow(1 + j, b) + W) / g1;
      const sign = (F / g2 - W) / g1;
      return {
        stem: `A fund earns an annual effective rate of discount of ${pc(d)} for the first ${word(a)} years and an annual nominal interest rate of ${pc(j)} convertible monthly thereafter. A single deposit is made at time 0. A withdrawal of ${amt(W)} is made at the end of year ${a}, and at the end of year ${a + b} the fund is worth ${amt(F)}.\n\nCalculate the amount of the deposit.`,
        answer: {
          value: X,
          calc: `(${lit(F)}/(1+${lit(j)}/12)**${12 * b} + ${lit(W)})*(1-${lit(d)})**${a}`,
          format: fmt,
          derivation: `$X = \\left(\\dfrac{${mamt(F)}}{(1 + ${dec(j / 12, 6)})^{${12 * b}}} + ${W}\\right)(1 - ${dec(d, 3)})^{${a}} = ${shown(X, fmt)}$`,
        },
        model: {
          expr: `(x*(1-${lit(d)})**(-${a}) - ${lit(W)})*(1+${lit(j)}/12)**${12 * b} - ${lit(F)}`,
          bracket: [0, F * 2],
          description: "Run the fund forward: grow the deposit through the discount regime, take the withdrawal, then grow through the monthly regime to the final value.",
        },
        distractors: [
          distractor("RATE_DISCOUNT_AS_INTEREST", asInterest, `(${lit(F)}/(1+${lit(j)}/12)**${12 * b} + ${lit(W)})/(1+${lit(d)})**${a}`, {
            derivation: `$\\left(\\dfrac{${mamt(F)}}{${dec(g2, 5)}} + ${W}\\right)(${dec(1 + d, 3)})^{-${a}} = ${shown(asInterest, fmt)}$`,
            method: "Treated the discount rate as an interest rate.",
            feedback: `With an effective discount rate d, the discount factor is $(1 - d)$ per year, not $(1 + d)^{-1}$.`,
          }),
          distractor("TIMING_VALUATION_DATE", wAtEnd, `(${lit(F)} + ${lit(W)})/(1+${lit(j)}/12)**${12 * b}*(1-${lit(d)})**${a}`, {
            derivation: `$\\dfrac{${mamt(F)} + ${W}}{${dec(g2, 5)}}(1 - ${dec(d, 3)})^{${a}} = ${shown(wAtEnd, fmt)}$`,
            method: `Added the withdrawal back at time ${a + b} instead of time ${a}.`,
            feedback: `The withdrawal is taken at time ${a}; it should be added back when the fund is at time ${a}, after the second regime has been undone.`,
          }),
          distractor("RATE_NOMINAL_AS_EFFECTIVE", nominalEff, `(${lit(F)}/(1+${lit(j)})**${b} + ${lit(W)})*(1-${lit(d)})**${a}`, {
            derivation: `$\\left(\\dfrac{${mamt(F)}}{(${dec(1 + j, 3)})^{${b}}} + ${W}\\right)(1 - ${dec(d, 3)})^{${a}} = ${shown(nominalEff, fmt)}$`,
            method: "Used the nominal rate as an annual effective rate.",
            feedback: `Convertible monthly: ${pc(j)}/12 per month for ${12 * b} months.`,
          }),
          distractor("TRANS_IGNORED_CONDITION", F / g2 / g1, `${lit(F)}/(1+${lit(j)}/12)**${12 * b}*(1-${lit(d)})**${a}`, {
            derivation: `$\\dfrac{${mamt(F)}}{${dec(g2, 5)}}(1 - ${dec(d, 3)})^{${a}} = ${shown(F / g2 / g1, fmt)}$`,
            method: "Ignored the withdrawal.",
            feedback: `Money left the fund at time ${a}; the deposit had to be large enough to cover it.`,
          }),
          distractor("TIMING_MISSING_PERIOD", F / g2 / g1 + W, `${lit(F)}/(1+${lit(j)}/12)**${12 * b}*(1-${lit(d)})**${a} + ${lit(W)}`, {
            derivation: `$\\dfrac{${mamt(F)}}{${dec(g2, 5)}}(1 - ${dec(d, 3)})^{${a}} + ${W} = ${shown(F / g2 / g1 + W, fmt)}$`,
            method: `Added the withdrawal back at time 0 without discounting it.`,
            feedback: `The withdrawal happens at time ${a}; its value at time 0 is ${amt(W)} × (1 − d)^${a}.`,
          }),
          distractor("ALG_SIGN_ERROR", sign, `(${lit(F)}/(1+${lit(j)}/12)**${12 * b} - ${lit(W)})*(1-${lit(d)})**${a}`, {
            derivation: `$\\left(\\dfrac{${mamt(F)}}{${dec(g2, 5)}} - ${W}\\right)(1 - ${dec(d, 3)})^{${a}} = ${shown(sign, fmt)}$`,
            method: "Subtracted the withdrawal when working backwards.",
            feedback: "Undoing a withdrawal adds it back: the fund was larger just before the money was taken out.",
          }),
        ],
        explanation: regimesExplanation({ a, b, d, F, X, fmt, withdrawal: W, j }),
        visuals: [regimesFlow(a, b, F, X, `withdraw ${amt(W)}`)],
        markers: [F / g2, F / g2 + W, g1],
        presentation: ["work-backwards", "frequency", "mixed-timing"],
        features: features({ steps: 4, multiConcept: true, multipleValuationDates: true, formulaRetrieval: true }),
        chain: chain(
          [
            step("A.nominal-equivalence", "Growth through the monthly regime.", ["(1+j/12)^{12b}", g2, "second-regime factor"], ["j", "b"]),
            step("A.discount-factor", "Undo the second regime, then add back the withdrawal at time a.", ["fund at a^-", F / g2 + W, "fund just before the withdrawal"], ["F", "W"], { valuationDate: "a", rearranged: true }),
            step("A.interest-discount", "Undo the discount regime with (1 − d) per year.", ["X", X, "deposit"], ["d", "a"], { rearranged: true }),
          ],
          {
            methods: ["work_backwards", "valuation_dates"],
            stages: {
              RATE_DISCOUNT_AS_INTEREST: [2, "selection"],
              TIMING_VALUATION_DATE: [1, "connection"],
              RATE_NOMINAL_AS_EFFECTIVE: [0, "application"],
              ALG_SIGN_ERROR: [1, "application"],
              TRANS_IGNORED_CONDITION: [1, "connection"],
              TIMING_MISSING_PERIOD: [2, "connection"],
            },
            reasoning: "Write the story forward as one equation in X, or undo each step in reverse order; the withdrawal must be undone at its own date.",
          }
        ),
        params: { a, b, d, j, W, F },
      };
    }

    const delta = gridRate(rng, 0.06, 0.1, 0.005);
    const frac = rng.choice([0.25, 0.3, 0.4]);
    const keep = 1 - frac;
    const g2 = Math.exp(delta * b);
    const X = F / g2 / keep / g1;
    const inverted = F / g2 / frac / g1;
    const ofDeposit = (F / g2 + frac * 0) / (g1 - frac) ;
    const asEff = F / Math.pow(1 + delta, b) / keep / g1;
    const asInterest = (F / g2 / keep) / Math.pow(1 + d, a);
    const pct = Math.round(frac * 100);
    return {
      stem: `A single deposit is made into a fund at time 0. For the first ${word(a)} years the fund earns an annual effective rate of discount of ${pc(d)}. At the end of year ${a}, ${pct}% of the fund is withdrawn. After that the fund earns interest at a constant force of interest of ${pc(delta)}. At the end of year ${a + b} the fund is worth ${amt(F)}.\n\nCalculate the amount of the deposit.`,
      answer: {
        value: X,
        calc: `${lit(F)}*exp(-${lit(delta)}*${b})/${lit(keep)}*(1-${lit(d)})**${a}`,
        format: fmt,
        derivation: `$X = \\dfrac{${mamt(F)}e^{-${dec(delta * b, 4)}}}{${keep}}(1 - ${dec(d, 3)})^{${a}} = ${shown(X, fmt)}$`,
      },
      model: {
        expr: `x*(1-${lit(d)})**(-${a})*(1-${lit(frac)})*exp(${lit(delta)}*${b}) - ${lit(F)}`,
        bracket: [0, F * 3],
        description: "Forward: grow the deposit through the discount regime, keep the fraction left after the withdrawal, then grow continuously.",
      },
      distractors: [
        distractor("TRANS_INVERTED_RELATION", inverted, `${lit(F)}*exp(-${lit(delta)}*${b})/${lit(frac)}*(1-${lit(d)})**${a}`, {
          derivation: `$\\dfrac{${mamt(F)}e^{-${dec(delta * b, 4)}}}{${frac}}(1 - ${dec(d, 3)})^{${a}} = ${shown(inverted, fmt)}$`,
          method: `Treated ${pct}% as the fraction that remains.`,
          feedback: `${pct}% is withdrawn, so ${Math.round(keep * 100)}% remains.`,
        }),
        distractor("RATE_FORCE_AS_EFFECTIVE", asEff, `${lit(F)}/(1+${lit(delta)})**${b}/${lit(keep)}*(1-${lit(d)})**${a}`, {
          derivation: `$\\dfrac{${mamt(F)}}{(${dec(1 + delta, 3)})^{${b}} \\cdot ${keep}}(1 - ${dec(d, 3)})^{${a}} = ${shown(asEff, fmt)}$`,
          method: "Treated the force of interest as an effective rate.",
          feedback: "A constant force δ accumulates by $e^{\\delta t}$.",
        }),
        distractor("RATE_DISCOUNT_AS_INTEREST", asInterest, `${lit(F)}*exp(-${lit(delta)}*${b})/${lit(keep)}/(1+${lit(d)})**${a}`, {
          derivation: `$\\dfrac{${mamt(F)}e^{-${dec(delta * b, 4)}}}{${keep}}(${dec(1 + d, 3)})^{-${a}} = ${shown(asInterest, fmt)}$`,
          method: "Treated the discount rate as an interest rate.",
          feedback: "With effective discount d, one year's discount factor is $1 - d$.",
        }),
        distractor("TRANS_IGNORED_CONDITION", F / g2 / g1, `${lit(F)}*exp(-${lit(delta)}*${b})*(1-${lit(d)})**${a}`, {
          derivation: `$${mamt(F)}e^{-${dec(delta * b, 4)}}(1 - ${dec(d, 3)})^{${a}} = ${shown(F / g2 / g1, fmt)}$`,
          method: "Ignored the withdrawal.",
          feedback: `Only ${Math.round(keep * 100)}% of the fund continued to grow after time ${a}.`,
        }),
        distractor("ALLOC_AGGREGATE_AS_EACH", ofDeposit + 0, `${lit(F)}*exp(-${lit(delta)}*${b})/((1-${lit(d)})**(-${a}) - ${lit(frac)})`, {
          derivation: `$X(1-${dec(d, 3)})^{-${a}} - ${frac}X = ${mamt(F)}e^{-${dec(delta * b, 4)}} \\Rightarrow X = ${shown(ofDeposit, fmt)}$`,
          method: `Took ${pct}% of the original deposit rather than ${pct}% of the fund at time ${a}.`,
          feedback: `The withdrawal is a fraction of the fund's value at time ${a}, which already includes ${a} years of growth.`,
        }),
      ],
      explanation: regimesExplanation({ a, b, d, F, X, fmt, fraction: frac, delta }),
      visuals: [regimesFlow(a, b, F, X, `withdraw ${pct}%`)],
      markers: [F / g2, F / g2 / keep, g1],
      presentation: ["work-backwards", "indirect-wording", "mixed-timing"],
      features: features({ steps: 4, multiConcept: true, multipleValuationDates: true, formulaRetrieval: true, unfamiliar: true }),
      chain: chain(
        [
          step("A.constant-force", "Growth in the second regime under a constant force.", ["e^{δb}", g2, "second-regime factor"], ["δ", "b"]),
          step("A.discount-factor", "Undo the growth, then undo the fractional withdrawal (divide by the fraction kept).", ["fund at a^-", F / g2 / keep, "fund before the withdrawal"], ["F", "keep"], { valuationDate: "a", rearranged: true }),
          step("A.interest-discount", "Undo the discount regime.", ["X", X, "deposit"], ["d", "a"], { rearranged: true }),
        ],
        {
          methods: ["work_backwards", "valuation_dates"],
          unconventional: true,
          stages: {
            TRANS_INVERTED_RELATION: [1, "connection"],
            RATE_FORCE_AS_EFFECTIVE: [0, "selection", "A.compound"],
            RATE_DISCOUNT_AS_INTEREST: [2, "selection"],
            TRANS_IGNORED_CONDITION: [1, "connection"],
            ALLOC_AGGREGATE_AS_EACH: [1, "connection"],
          },
          reasoning: "Each event multiplies the fund by a factor; undo them in reverse order by dividing.",
        }
      ),
      params: { a, b, d, delta, frac, F },
    };
  },
};

function regimesFlow(a: number, b: number, F: number, X: number, event: string) {
  return {
    kind: "flowchart" as const,
    title: "Undo each step in reverse order",
    nodes: [
      { id: "x", label: `Deposit $X \\approx ${mnum(X, 0)}$`, detail: "time 0", tone: "result" as const },
      { id: "g1", label: `Grow ${a} years`, detail: "discount regime", tone: "step" as const },
      { id: "w", label: event, detail: `time ${a}`, tone: "trap" as const },
      { id: "g2", label: `Grow ${b} years`, detail: "second regime", tone: "step" as const },
      { id: "f", label: `Final value ${amt(F)}`, detail: `time ${a + b}`, tone: "input" as const },
    ],
    edges: [
      { from: "x", to: "g1" },
      { from: "g1", to: "w" },
      { from: "w", to: "g2" },
      { from: "g2", to: "f" },
    ],
    caption: "Forward, the story runs left to right. To solve it, start at the right and invert each step.",
  };
}

function regimesExplanation(p: {
  a: number;
  b: number;
  d: number;
  F: number;
  X: number;
  fmt: AnswerFormat;
  withdrawal?: number;
  fraction?: number;
  j?: number;
  delta?: number;
}) {
  const { a, b, d, F, X, fmt, withdrawal, fraction, j, delta } = p;
  const g2Text = j !== undefined ? `(1 + ${dec(j / 12, 6)})^{${12 * b}}` : `e^{${dec((delta ?? 0) * b, 4)}}`;
  const g2 = j !== undefined ? Math.pow(1 + j / 12, 12 * b) : Math.exp((delta ?? 0) * b);
  const atA = withdrawal !== undefined ? F / g2 + withdrawal : F / g2 / (1 - (fraction ?? 0));
  return explanation({
    intuition: "The fund's story runs forward through two growth regimes with an event in between. The known number is at the end, so solve by running the story backwards: undo the last growth, undo the withdrawal, undo the first growth.",
    translation: {
      unknowns: [{ symbol: "$X$", meaning: "the deposit at time 0" }],
      relationships: [
        `$\\text{fund at } ${a}^- = X(1 - d)^{-${a}}$`,
        withdrawal !== undefined ? `$\\text{fund at } ${a}^+ = X(1-d)^{-${a}} - ${withdrawal}$` : `$\\text{fund at } ${a}^+ = ${dec(1 - (fraction ?? 0), 2)} \\times X(1-d)^{-${a}}$`,
        `$\\text{fund at } ${a + b} = (\\text{fund at } ${a}^+) \\times ${g2Text} = ${mamt(F)}$`,
      ],
      conditions: [withdrawal !== undefined ? "The withdrawal is a fixed amount." : "The withdrawal is a fraction of the fund at that date."],
      valuationDate: `Time ${a} — the hinge between the regimes, where the withdrawal happens.`,
      modelChoice: "Work backwards from the known final value, one regime at a time.",
      assumptions: ["Each regime's rate applies only within its own years."],
    },
    solution: [
      { title: `Back to time ${a} (after the withdrawal)`, body: `$${mamt(F)} / ${dec(g2, 6)} = ${mnum(F / g2, 2)}$` },
      {
        title: "Undo the withdrawal",
        body: withdrawal !== undefined ? `$${mnum(F / g2, 2)} + ${withdrawal} = ${mnum(atA, 2)}$` : `$${mnum(F / g2, 2)} / ${dec(1 - (fraction ?? 0), 2)} = ${mnum(atA, 2)}$`,
      },
      { title: "Back to time 0", body: `$X = ${mnum(atA, 2)}(1 - ${dec(d, 3)})^{${a}} = ${shown(X, fmt)}$` },
    ],
    alternatives: [
      {
        name: "Forward equation",
        body: withdrawal !== undefined ? `$(X(1-d)^{-${a}} - ${withdrawal})${g2Text} = ${mamt(F)}$, solved for X.` : `$${dec(1 - (fraction ?? 0), 2)}X(1-d)^{-${a}}${g2Text} = ${mamt(F)}$.`,
        whenUseful: "Writing the forward equation first guards against undoing steps in the wrong order.",
      },
    ],
    transfer: {
      principle: "Money crosses each rate regime with that regime's factor only. An intermediate event happens at a date, and must be undone at that date.",
      unusual: "Different rate conventions apply in different periods, separated by an event.",
      misread: "The event is easily undone at the wrong date, or the discount rate used as an interest rate.",
    },
  });
}

export const TVM_TEMPLATES: QuestionTemplate[] = [twoFunds, equivalentRates, variableForce, unknownTime, realReturn, twoRegimes];

