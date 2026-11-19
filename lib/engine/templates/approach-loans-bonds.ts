/**
 * Solution-approach bank — Loans and Bonds.
 *
 * Routes the rest of the bank does not use: a loan recovered from one
 * payment's interest and another payment's principal, a rate found from two
 * outstanding balances, equal-principal (non-level) repayment, Makeham's
 * formula with no stated term, and a yield read off two bonds' premium and
 * discount.
 */
import { an } from "../finance";
import type { AnswerFormat, DistractorCandidate, QuestionDraft, QuestionTemplate } from "../types";
import { bisect, explain, round2, routeVisual } from "./approach-kit";
import { MONEY2, PCT2, amt, chain, dec, distractor, drawUntil, features, gridAmount, gridRate, lit, mamt, mnum, mpc, ord, pc, shown, step, sumOf } from "./kit";

const L = lit;
const PCT3: AnswerFormat = { kind: "percent", decimals: 3 };

// ===================================================================== Loans — one payment's interest, another's principal

const firstLast: QuestionTemplate = {
  id: "apx-loan-first-last",
  family: "apx-loan-first-last",
  topic: "LOANS",
  levels: [1, 2, 3],
  objective: "LOANS.payment_components",
  secondary: ["LOANS.unknown_variables", "LOANS.amortization"],
  reasoning: ["simultaneous_equations", "algebra", "translation", "multistep"],
  soaConcept: "A level-payment loan recovered from the interest in one payment and the principal in another: two components, two unknowns.",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const Lo = gridAmount(rng, 10000, 100000, 5000);
    const i0 = gridRate(rng, 0.04, 0.09, 0.0025);
    const n = rng.int(8, 25);
    const P0 = Lo / an(n, i0);
    const distractors: DistractorCandidate[] = [];
    let answer: number;
    let calc: string;
    let model: { expr: string; bracket?: [number, number]; description: string };
    let stem: string;
    let v: number;
    let P: number;
    let given: { a: number; b: number };

    if (level <= 2) {
      const I1 = round2(Lo * i0);
      const Rn = round2(P0 / (1 + i0));
      given = { a: I1, b: Rn };
      v = bisect((x) => (Rn * (1 - Math.pow(x, n))) / x - I1, 0.7, 0.99999);
      const i = 1 / v - 1;
      P = Rn / v;
      answer = I1 / i;
      const iX = `(${L(I1)}/x)`;
      calc = `${L(I1)}/(1-(1+${iX})**(-${n}))/(1+${iX}) - ${L(Rn)}`;
      model = {
        expr: `(${L(I1)}/(1-(1+${iX})**(-${n})) - ${L(I1)})*(1+${iX})**${n - 1} - ${L(Rn)}`,
        description: "Principal portions grow by 1 + i: the last equals the first, (P − I₁), grown n − 1 years.",
      };
      stem = `A loan is repaid by ${n} level annual payments at the end of each year. The interest portion of the first payment is ${amt(I1)}, and the principal portion of the last payment is ${amt(Rn)}.\n\nCalculate the amount of the loan.`;

      const P2 = I1 + Rn;
      const i2 = Math.pow(P2 / Rn, 1 / n) - 1;
      distractors.push(
        distractor("CONC_LOAN_SCHEDULE_REVERSED", I1 / i2, `${L(I1)}/((${L(P2)}/${L(Rn)})**(1/${n})-1)`, {
          derivation: `$P = ${mnum(I1, 2)} + ${mnum(Rn, 2)}$, $v^{${n}} = ${mnum(Rn, 2)}/P$; $L = I_1/i = ${shown(I1 / i2, fmt)}$`,
          method: "Treated the last payment's principal as if it were the first payment's, so that the two figures add to one payment.",
          feedback: `The first payment splits into $I_1 + Pv^{${n}}$, the last into $P(1-v) + Pv$. ${amt(I1)} and ${amt(Rn)} come from different payments and do not add to $P$.`,
        }),
        distractor("CONC_LOAN_PRINCIPAL_LEVEL", n * Rn, `${n}*${L(Rn)}`, {
          derivation: `$${n} \\times ${mnum(Rn, 2)} = ${shown(n * Rn, fmt)}$`,
          method: "Assumed every payment repays the same principal as the last one.",
          feedback: "Principal portions grow geometrically by $1+i$; the last is the largest, so this overstates the loan.",
        }),
        distractor("VAR_OTHER_UNKNOWN", P, `${L(Rn)}/${L(v)}`, {
          derivation: `$P = R_{${n}}/v = ${shown(P, fmt)}$`,
          method: "Reported the level payment.",
          feedback: "The loan is $I_1/i$, the amount on which the first year's interest was charged.",
        }),
        distractor("VAR_TOTAL_FOR_COMPONENT", n * P, `${n}*${L(Rn)}/${L(v)}`, {
          derivation: `$${n}P = ${shown(n * P, fmt)}$`,
          method: "Added up all the payments.",
          feedback: "Total payments include interest; the loan is their present value.",
        })
      );
      const iRd = Math.round(i * 1000) / 1000;
      distractors.push(
        distractor("ARITH_ROUNDED_RATE", I1 / iRd, `${L(I1)}/${L(iRd)}`, {
          derivation: `$i \\approx ${mpc(iRd, 1)}$; $${mnum(I1, 2)}/${dec(iRd, 3)} = ${shown(I1 / iRd, fmt)}$`,
          method: "Rounded the rate to 0.1% before dividing.",
          feedback: "Dividing by a rounded rate magnifies the rounding error; keep the full value.",
        })
      );
    } else {
      const R1 = round2(P0 * Math.pow(1 + i0, -n));
      const In = round2(P0 * (1 - 1 / (1 + i0)));
      given = { a: R1, b: In };
      v = bisect((x) => R1 * (1 - x) - In * Math.pow(x, n), 0.7, 0.99999);
      const i = 1 / v - 1;
      P = In / (1 - v);
      answer = (P * (1 - Math.pow(v, n))) / i;
      calc = `${L(In)}/(1-${L(v)})*(1-${L(v)}**${n})*${L(v)}/(1-${L(v)})`;
      model = { expr: sumOf(Array.from({ length: n }, (_, t) => `${L(In)}/(1-${L(v)})*${L(v)}**${t + 1}`)), description: `Each of the ${n} payments discounted at the rate implied by $R_1 = Pv^{${n}}$ and $I_{${n}} = P(1-v)$.` };
      stem = `A loan is repaid by ${n} level annual payments at the end of each year. The principal portion of the first payment is ${amt(R1)}, and the interest portion of the last payment is ${amt(In)}.\n\nCalculate the amount of the loan.`;

      const vR = bisect((x) => (R1 * (1 - Math.pow(x, n))) / x - In, 0.5, 0.99999);
      const iRv = 1 / vR - 1;
      distractors.push(
        distractor("CONC_LOAN_SCHEDULE_REVERSED", In / iRv, `${L(In)}/(1/${L(vR)}-1)`, {
          derivation: `$I_1 = ${mnum(In, 2)},\\ R_{${n}} = ${mnum(R1, 2)}$ read the other way round; $L = ${shown(In / iRv, fmt)}$`,
          method: "Read the figures as the first payment's interest and the last payment's principal.",
          feedback: `The first payment's principal is the smallest principal portion ($Pv^{${n}}$); the last payment's interest is the smallest interest portion ($P(1-v)$).`,
        }),
        distractor("CONC_LOAN_PRINCIPAL_LEVEL", n * R1, `${n}*${L(R1)}`, {
          derivation: `$${n} \\times ${mnum(R1, 2)} = ${shown(n * R1, fmt)}$`,
          method: "Assumed every payment repays the same principal as the first.",
          feedback: "Principal portions grow by $1+i$ every year.",
        }),
        distractor("VAR_OTHER_UNKNOWN", P, `${L(In)}/(1-${L(v)})`, {
          derivation: `$P = ${shown(P, fmt)}$`,
          method: "Reported the level payment.",
          feedback: "The loan is the present value of all the payments, $P\\,a_{\\overline{n|}}$.",
        }),
        distractor("VAR_TOTAL_FOR_COMPONENT", n * P, `${n}*${L(In)}/(1-${L(v)})`, {
          derivation: `$${n}P = ${shown(n * P, fmt)}$`,
          method: "Added up the payments without discounting.",
          feedback: "Total payments include interest; the loan is their present value.",
        }),
        distractor("VAR_INTEREST_FOR_PRINCIPAL", In / i, `${L(In)}/(1/${L(v)}-1)`, {
          derivation: `$I_{${n}}/i = ${shown(In / i, fmt)}$`,
          method: "Divided the last payment's interest by the rate, as if it were the first payment's interest.",
          feedback: `$I_{${n}}/i$ is the balance before the last payment, $B_{${n - 1}}$, not the loan.`,
        })
      );
    }

    const i = 1 / v - 1;
    const steps =
      level <= 2
        ? [
            step("D.interest-component", "Interest in payment 1 is $iL = P(1 - v^n)$.", ["I_1", given.a, "first interest portion"], ["P", "v"]),
            step("D.principal-component", "Principal in the last payment is $Pv$.", ["R_n", given.b, "last principal portion"], ["P", "v"]),
            step("M.root-finding", `Eliminate P: $\\frac{I_1}{R_n} = \\frac{1 - v^{${n}}}{v}$; solve for v.`, ["i", i, "annual effective rate"], ["I_1", "R_n"], { rearranged: true }),
            step("D.interest-component", "The loan is the first year's interest over the rate.", ["L", answer, "loan amount"], ["I_1", "i"], { rearranged: true }),
          ]
        : [
            step("D.principal-component", `Principal in payment 1 is $Pv^{${n}}$.`, ["R_1", given.a, "first principal portion"], ["P", "v"]),
            step("D.interest-component", "Interest in the last payment is $P(1-v)$.", ["I_n", given.b, "last interest portion"], ["P", "v"]),
            step("M.root-finding", `Eliminate P: $\\frac{R_1}{I_n} = \\frac{v^{${n}}}{1-v}$; solve for v.`, ["i", i, "annual effective rate"], ["R_1", "I_n"], { rearranged: true }),
            step("D.loan-payment", "Recover P, then the loan as $P\\,a_{\\overline{n|}}$.", ["L", answer, "loan amount"], ["I_n", "v"]),
          ];
    const chainSpec = chain(steps, {
      methods: ["simultaneous", "elimination", "numerical_root"],
      reasoning: "Two components of different payments are two equations in P and v; dividing them eliminates P.",
      unconventional: true,
      stages: { CONC_LOAN_SCHEDULE_REVERSED: [1, "selection"], CONC_LOAN_PRINCIPAL_LEVEL: [1, "selection"], VAR_OTHER_UNKNOWN: [3, "interpretation"], VAR_TOTAL_FOR_COMPONENT: [3, "interpretation"], ARITH_ROUNDED_RATE: [2, "application"], VAR_INTEREST_FOR_PRINCIPAL: [3, "connection"] },
    });

    return {
      stem,
      answer: { value: answer, calc, format: fmt, derivation: `$v = ${dec(v, 6)},\\ i = ${dec(i, 6)}$; $L = ${shown(answer, fmt)}$` },
      model,
      distractors,
      explanation: explain({
        intuition: "Every payment P splits as interest + principal, and the principal portions run $Pv^n, Pv^{n-1}, \\dots, Pv$. One component of one payment and another of a different payment give two equations in two unknowns (P and v). Divide them and P disappears.",
        unknowns: [
          { symbol: "$P$", meaning: "level payment" },
          { symbol: "$v$", meaning: "annual discount factor" },
        ],
        relationships: level <= 2 ? [`$I_1 = P(1-v^{${n}})$`, "$R_n = Pv$"] : [`$R_1 = Pv^{${n}}$`, "$I_n = P(1-v)$"],
        conditions: ["Level payments at the end of each year; one rate throughout."],
        valuationDate: "Time 0",
        modelChoice: "Amortization components as functions of P and v.",
        assumptions: ["Annual effective rate constant over the term."],
        solution: [
          { title: "Ratio", body: level <= 2 ? `$\\dfrac{1 - v^{${n}}}{v} = \\dfrac{${mnum(given.a, 2)}}{${mnum(given.b, 2)}}$` : `$\\dfrac{v^{${n}}}{1 - v} = \\dfrac{${mnum(given.a, 2)}}{${mnum(given.b, 2)}}$` },
          { title: "Solve", body: `$v = ${dec(v, 6)},\\ i = ${dec(i, 6)}$ (calculator or trial)` },
          { title: "Loan", body: level <= 2 ? `$L = I_1/i = ${shown(answer, fmt)}$` : `$P = ${mnum(P, 2)}$; $L = P\\,a_{\\overline{${n}|}} = ${shown(answer, fmt)}$` },
        ],
        alternative: {
          name: "Calculator worksheet",
          body: "Guess i, compute P from one component, check the other; adjust i. Slower but needs no algebra.",
          whenUseful: "When the ratio equation does not simplify.",
        },
        principle: "Components of different payments are linked through powers of v — divide to eliminate the payment.",
        unusual: "Neither the payment, the rate nor the loan is given.",
        misread: "The two figures come from different payments: they do not add to a single payment.",
      }),
      visuals: [routeVisual(chainSpec, "Route: two components, two unknowns", "Divide to eliminate P, then solve for v.")],
      markers: [v, P, answer],
      presentation: ["unknown-rate", "multi-equation", "hidden-structure"],
      features: features({ steps: 4, unfamiliar: true, multiConcept: true }),
      params: { L: Lo, i: i0, n, level },
      chain: chainSpec,
    };
  },
};

// ===================================================================== Loans — the rate from two balances

const twoBalances: QuestionTemplate = {
  id: "apx-loan-two-balances",
  family: "apx-loan-two-balances",
  topic: "LOANS",
  levels: [1, 2, 3],
  objective: "LOANS.unknown_variables",
  secondary: ["LOANS.outstanding_balance", "LOANS.payment_components"],
  reasoning: ["cashflow_modelling", "algebra", "valuation_dates", "multistep"],
  soaConcept: "The unknown loan rate recovered from two outstanding balances and the payment, then a component of a later payment.",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const Lo = gridAmount(rng, 20000, 200000, 5000);
    const i0 = gridRate(rng, 0.04, 0.1, 0.0025);
    const n = rng.int(15, 30);
    const k = rng.int(2, n - 10);
    const g = rng.int(3, 6);
    const m = k + g;
    const P = round2(Lo / an(n, i0));
    const Bk = round2(P * an(n - k, i0));
    const Bm = round2(P * an(n - m, i0));
    const fwd = (r: number) => Bk * Math.pow(1 + r, g) - (P * (Math.pow(1 + r, g) - 1)) / r - Bm;
    const i = bisect(fwd, 0.001, 0.3);
    const interest = i * Bm;
    const askPrincipal = level === 3;
    const answer = askPrincipal ? P - interest : interest;
    const iX = askPrincipal ? `((${L(P)}-x)/${L(Bm)})` : `(x/${L(Bm)})`;
    const calc = `${L(Bk)}*(1+${iX})**${g} - ${L(P)}*((1+${iX})**${g}-1)/${iX} - ${L(Bm)}`;
    let rec = L(Bk);
    for (let t = 0; t < g; t += 1) rec = `(${rec}*(1+${iX}) - ${L(P)})`;
    const bracket: [number, number] = askPrincipal ? [answer * 0.5, Math.min(answer * 1.5, P * 0.995)] : [answer * 0.5, answer * 1.5];
    const level2: [number, number] = [P - (Bk - Bm) / g, (Bk - Bm) / g];

    const distractors: DistractorCandidate[] = askPrincipal
      ? [
          distractor("VAR_INTEREST_FOR_PRINCIPAL", interest, `${L(i)}*${L(Bm)}`, {
            derivation: `$iB_{${m}} = ${shown(interest, fmt)}$`,
            method: "Reported the interest portion.",
            feedback: "Principal = payment − interest.",
          }),
          distractor("TIMING_BALANCE_INDEX", P - i * Bk, `${L(P)} - ${L(i)}*${L(Bk)}`, {
            derivation: `$P - iB_{${k}} = ${shown(P - i * Bk, fmt)}$`,
            method: `Charged interest on the balance after payment ${k}.`,
            feedback: `Payment ${m + 1}'s interest is charged on the balance just after payment ${m}.`,
          }),
          distractor("CONC_LOAN_PRINCIPAL_LEVEL", level2[1], `(${L(Bk)} - ${L(Bm)})/${g}`, {
            derivation: `$(B_{${k}} - B_{${m}})/${g} = ${shown(level2[1], fmt)}$`,
            method: "Took the average principal repaid between the two dates.",
            feedback: "Principal portions grow by $1+i$ each payment; the next one exceeds the average of the earlier ones.",
          }),
          distractor("TIMING_EXTRA_PERIOD", (P - interest) * (1 + i), `(${L(P)} - ${L(i)}*${L(Bm)})*(1+${L(i)})`, {
            derivation: `$(P - iB_{${m}})(1+i) = ${shown((P - interest) * (1 + i), fmt)}$`,
            method: `Found the principal of payment ${m + 2}.`,
            feedback: `Payment ${m + 1} is the first payment after the balance $B_{${m}}$.`,
          }),
          distractor("ALLOC_EVEN_SPLIT", P - (i * (Bk + Bm)) / 2, `${L(P)} - ${L(i)}*(${L(Bk)}+${L(Bm)})/2`, {
            derivation: `$P - i\\,\\tfrac{B_{${k}} + B_{${m}}}{2} = ${shown(P - (i * (Bk + Bm)) / 2, fmt)}$`,
            method: "Charged interest on the average of the two given balances.",
            feedback: `Interest in payment ${m + 1} is on the balance just after payment ${m}, $B_{${m}}$.`,
          }),
        ]
      : [
          distractor("TIMING_BALANCE_INDEX", i * Bk, `${L(i)}*${L(Bk)}`, {
            derivation: `$iB_{${k}} = ${shown(i * Bk, fmt)}$`,
            method: `Charged interest on the balance after payment ${k}.`,
            feedback: `Payment ${m + 1}'s interest is charged on the balance just after payment ${m}.`,
          }),
          distractor("CONC_LOAN_PRINCIPAL_LEVEL", level2[0], `${L(P)} - (${L(Bk)} - ${L(Bm)})/${g}`, {
            derivation: `$P - (B_{${k}} - B_{${m}})/${g} = ${shown(level2[0], fmt)}$`,
            method: "Assumed each payment repays the same principal.",
            feedback: "Principal portions grow geometrically, so interest portions shrink faster than the average suggests.",
          }),
          distractor("VAR_INTEREST_FOR_PRINCIPAL", P - interest, `${L(P)} - ${L(i)}*${L(Bm)}`, {
            derivation: `$P - iB_{${m}} = ${shown(P - interest, fmt)}$`,
            method: "Reported the principal portion.",
            feedback: "Interest = rate × outstanding balance.",
          }),
          distractor("TIMING_EXTRA_PERIOD", interest * (1 + i), `${L(i)}*${L(Bm)}*(1+${L(i)})`, {
            derivation: `$iB_{${m}}(1+i) = ${shown(interest * (1 + i), fmt)}$`,
            method: "Accumulated the balance one period before charging interest.",
            feedback: "Interest for the year is i times the balance at the start of the year.",
          }),
          distractor("ALLOC_EVEN_SPLIT", (i * (Bk + Bm)) / 2, `${L(i)}*(${L(Bk)}+${L(Bm)})/2`, {
            derivation: `$i\\,\\tfrac{B_{${k}} + B_{${m}}}{2} = ${shown((i * (Bk + Bm)) / 2, fmt)}$`,
            method: "Charged interest on the average of the two given balances.",
            feedback: `Interest in payment ${m + 1} is on the balance just after payment ${m}, $B_{${m}}$.`,
          }),
        ];

    const steps = [
      step("D.balance-recursion", `Roll $B_{${k}}$ forward ${g} payments: $B_{${m}} = B_{${k}}(1+i)^{${g}} - P\\,s_{\\overline{${g}|}}$.`, ["eq", Bm, `balance after payment ${m}`], ["B_k", "P"], { derived: true }),
      step("M.root-finding", "Solve that equation for i.", ["i", i, "annual effective rate"], ["B_k", "B_m", "P"], { rearranged: true }),
      step("D.interest-component", `Interest in payment ${m + 1} is $iB_{${m}}$.`, ["I", interest, `interest in payment ${m + 1}`], ["i", "B_m"]),
    ];
    if (askPrincipal) steps.push(step("D.principal-component", "Principal = payment − interest.", ["R", answer, `principal in payment ${m + 1}`], ["P", "I"]));
    const chainSpec = chain(steps, {
      methods: ["equation_construction", "numerical_root"],
      reasoning: "Two balances are linked by the retrospective recursion over the payments between them — one equation, one unknown rate.",
      stages: { TIMING_BALANCE_INDEX: 2, CONC_LOAN_PRINCIPAL_LEVEL: [0, "selection"], VAR_INTEREST_FOR_PRINCIPAL: [steps.length - 1, "interpretation"], TIMING_EXTRA_PERIOD: 2, ALLOC_EVEN_SPLIT: 2 },
    });

    return {
      stem: `A loan is repaid by level annual payments of ${amt(P)} at the end of each year. The outstanding balance immediately after the ${ord(k)} payment is ${amt(Bk)}, and immediately after the ${ord(m)} payment it is ${amt(Bm)}.\n\nCalculate the ${askPrincipal ? "principal" : "interest"} portion of the ${ord(m + 1)} payment.`,
      answer: { value: answer, calc, format: fmt, derivation: `$i = ${dec(i, 6)}$; $= ${shown(answer, fmt)}$` },
      model: { expr: `${rec} - ${L(Bm)}`, bracket, description: `The balance rolled forward one payment at a time: $B \\to B(1+i) - P$, ${g} times.` },
      distractors,
      explanation: explain({
        intuition: `The two balances are ${g} payments apart. Grow the earlier one with interest and take off the ${g} payments: that must give the later one. The only unknown in that statement is the rate.`,
        unknowns: [{ symbol: "$i$", meaning: "annual effective loan rate" }],
        relationships: [`$B_{${m}} = B_{${k}}(1+i)^{${g}} - ${mamt(P)}\\,s_{\\overline{${g}|}\\,i}$`],
        conditions: ["Balances are measured immediately after payments."],
        valuationDate: `Time ${m}`,
        modelChoice: "Retrospective (recursive) balance between two dates.",
        assumptions: ["One annual effective rate throughout."],
        solution: [
          { title: "Equation", body: `$${mnum(Bk, 2)}(1+i)^{${g}} - ${mamt(P)}\\,s_{\\overline{${g}|}} = ${mnum(Bm, 2)}$` },
          { title: "Rate", body: `$i = ${dec(i, 6)}$` },
          { title: `Payment ${m + 1}`, body: askPrincipal ? `$${mamt(P)} - ${dec(i, 6)} \\times ${mnum(Bm, 2)} = ${shown(answer, fmt)}$` : `$${dec(i, 6)} \\times ${mnum(Bm, 2)} = ${shown(answer, fmt)}$` },
        ],
        alternative: {
          name: "Calculator worksheet",
          body: `N = ${g}, PV = −${amt(Bk)}, PMT = ${amt(P)}, FV = ${amt(Bm)}; compute I/Y.`,
          whenUseful: "Fastest on a BA II Plus or similar.",
        },
        principle: "Any two balances of one loan are linked by the payments between them.",
        unusual: "The rate is not given; the loan amount and term are not needed.",
        misread: `Interest in payment ${m + 1} is charged on the balance after payment ${m}, not after payment ${k}.`,
      }),
      visuals: [routeVisual(chainSpec, "Route: roll one balance into the other", "One equation gives the rate.")],
      markers: [i, interest],
      presentation: ["unknown-rate", "valuation-date"],
      features: features({ steps: askPrincipal ? 4 : 3, unfamiliar: true, multipleValuationDates: true }),
      params: { L: Lo, i: i0, n, k, m, level },
      chain: chainSpec,
    };
  },
};

// ===================================================================== Loans — equal principal repayments

const equalPrincipal: QuestionTemplate = {
  id: "apx-loan-equal-principal",
  family: "apx-loan-equal-principal",
  topic: "LOANS",
  levels: [1, 2, 3],
  objective: "LOANS.principal_interest",
  secondary: ["LOANS.payment_components", "LOANS.unknown_variables"],
  reasoning: ["cashflow_modelling", "algebra", "translation"],
  soaConcept: "A loan repaid by equal principal amounts plus interest on the balance: payments fall arithmetically, so differences and sums replace annuity factors.",
  generate(rng, level): QuestionDraft {
    const n = rng.int(5, 20);
    const Lo = n * gridAmount(rng, 500, 5000, 100);
    const i = gridRate(rng, 0.03, 0.1, 0.0025);
    const pay = (t: number) => Lo / n + (i * Lo * (n - t + 1)) / n;
    const stemHead = `A loan is repaid over ${n} years by annual payments at the end of each year. Each payment consists of ${level === 1 ? `${amt(Lo / n)} of principal` : "an equal amount of principal"} plus interest at the annual effective rate ${level === 1 ? pc(i) : "$i$"} on the outstanding balance.`;
    const distractors: DistractorCandidate[] = [];
    let answer: number;
    let calc: string;
    let model: { expr: string; bracket?: [number, number]; description: string };
    let ask: string;
    let fmt: AnswerFormat = MONEY2;
    let steps;

    if (level === 1) {
      answer = (i * Lo * (n + 1)) / 2;
      calc = `${L(i)}*${L(Lo)}*${n + 1}/2`;
      model = { expr: sumOf(Array.from({ length: n }, (_, t) => `${L(i)}*${L(Lo)}*${n - t}/${n}`)), description: "Interest on each year's opening balance, added year by year." };
      ask = `The amount of the loan is ${amt(Lo)}. Calculate the total interest paid over the life of the loan.`;
      const lvl = (n * Lo) / an(n, i) - Lo;
      distractors.push(
        distractor("SEQ_TERM_COUNT", (i * Lo * n) / 2, `${L(i)}*${L(Lo)}*${n}/2`, {
          derivation: `$iL\\,\\tfrac{${n}}{2} = ${shown((i * Lo * n) / 2, fmt)}$`,
          method: "Averaged the balances as n/2 loans instead of (n + 1)/2.",
          feedback: `Opening balances are $L, \\tfrac{${n - 1}}{${n}}L, \\dots, \\tfrac{1}{${n}}L$: their sum is $\\tfrac{${n + 1}}{2}L$.`,
        }),
        distractor("MODEL_INTEREST_ON_ORIGINAL", i * Lo * n, `${L(i)}*${L(Lo)}*${n}`, {
          derivation: `$${n} \\times iL = ${shown(i * Lo * n, fmt)}$`,
          method: "Charged interest on the original loan every year.",
          feedback: "Interest is charged on the outstanding balance, which falls by $L/n$ each year.",
        }),
        distractor("MODEL_LEVEL_FOR_VARYING", lvl, `${n}*${L(Lo)}/((1-(1+${L(i)})**(-${n}))/${L(i)}) - ${L(Lo)}`, {
          derivation: `$${n}\\,L/a_{\\overline{${n}|}} - L = ${shown(lvl, fmt)}$`,
          method: "Treated the loan as repaid by level payments.",
          feedback: "Here the principal is level, not the payment. Level-payment loans repay principal slowly at first, so they pay more interest.",
        }),
        distractor("TIMING_PAYMENT_BEFORE_INTEREST", (i * Lo * (n - 1)) / 2, `${L(i)}*${L(Lo)}*${n - 1}/2`, {
          derivation: `$iL\\,\\tfrac{${n - 1}}{2} = ${shown((i * Lo * (n - 1)) / 2, fmt)}$`,
          method: "Charged each year's interest on the balance after that year's principal repayment.",
          feedback: "Interest for a year is earned on the balance at the start of the year, before the payment.",
        })
      );
      steps = [
        step("D.principal-component", "Principal is level, so the balance falls by L/n each year.", ["L/n", Lo / n, "principal per payment"], ["L", "n"]),
        step("M.arithmetic-series", "Opening balances form an arithmetic sequence; their sum is (n+1)L/2.", ["ΣB", (Lo * (n + 1)) / 2, "sum of opening balances"], ["L", "n"]),
        step("D.total-interest", "Total interest = i × sum of opening balances.", ["I", answer, "total interest"], ["i", "ΣB"]),
      ];
    } else if (level === 2) {
      const k = rng.int(1, n - 3);
      const m = rng.int(k + 2, n);
      const Pk = round2(pay(k));
      const Pm = round2(pay(m));
      const Dd = (n * (Pk - Pm)) / (m - k);
      answer = n * Pk - (n - k + 1) * Dd;
      const DdE = `(${n}*(${L(Pk)}-${L(Pm)})/${m - k})`;
      calc = `${n}*${L(Pk)} - ${n - k + 1}*${DdE}`;
      model = { expr: `x/${n} + ${DdE}*${n - m + 1}/${n} - ${L(Pm)}`, description: `Payment ${m} written as principal x/n plus interest on the balance $\\tfrac{${n - m + 1}}{${n}}x$.` };
      ask = `The ${ord(k)} payment is ${amt(Pk)} and the ${ord(m)} payment is ${amt(Pm)}. Calculate the amount of the loan.`;
      const aD = n * Pk - ((n - k + 1) * (Pk - Pm)) / (m - k);
      distractors.push(
        distractor("ALG_DIVIDE_ERROR", aD, `${n}*${L(Pk)} - ${n - k + 1}*(${L(Pk)}-${L(Pm)})/${m - k}`, {
          derivation: `$iL = (P_{${k}} - P_{${m}})/${m - k}$; $L = ${shown(aD, fmt)}$`,
          method: "Took the yearly drop in payments as iL, forgetting it is iL/n.",
          feedback: `Each year the balance falls by $L/n$, so the interest (and the payment) falls by $iL/n$: $iL = ${n}(P_{${k}} - P_{${m}})/${m - k}$.`,
        }),
        distractor("TRANS_IGNORED_CONDITION", n * Pk, `${n}*${L(Pk)}`, {
          derivation: `$${n} \\times ${mnum(Pk, 2)} = ${shown(n * Pk, fmt)}$`,
          method: "Treated the payment as pure principal.",
          feedback: "Each payment includes interest; remove it before multiplying by n.",
        }),
        distractor("TIMING_BALANCE_INDEX", n * Pk - (n - k) * Dd, `${n}*${L(Pk)} - ${n - k}*${DdE}`, {
          derivation: `$${n}P_{${k}} - ${n - k}\\,iL = ${shown(n * Pk - (n - k) * Dd, fmt)}$`,
          method: `Used the balance after payment ${k} for the interest in payment ${k}.`,
          feedback: `Payment ${k}'s interest is on the balance before it: $\\tfrac{${n - k + 1}}{${n}}L$.`,
        }),
        distractor("ALG_SIGN_ERROR", n * Pk + (n - k + 1) * Dd, `${n}*${L(Pk)} + ${n - k + 1}*${DdE}`, {
          derivation: `$${n}P_{${k}} + ${n - k + 1}\\,iL = ${shown(n * Pk + (n - k + 1) * Dd, fmt)}$`,
          method: "Added the interest instead of removing it.",
          feedback: `$P_{${k}} = L/n + iL\\,\\tfrac{${n - k + 1}}{${n}}$, so $L = ${n}P_{${k}} - ${n - k + 1}\\,iL$.`,
        })
      );
      steps = [
        step("D.interest-component", `Payments fall by $iL/n$ a year: $P_{${k}} - P_{${m}} = iL\\,\\tfrac{${m - k}}{${n}}$.`, ["iL", Dd, "first year's interest"], ["P_k", "P_m"], { rearranged: true }),
        step("M.linear-system", `Substitute into $P_{${k}} = L/${n} + iL\\,\\tfrac{${n - k + 1}}{${n}}$.`, ["L", answer, "loan amount"], ["P_k", "iL"], { rearranged: true }),
      ];
    } else {
      fmt = PCT3;
      const P1 = round2(pay(1));
      const T = round2(Lo + (i * Lo * (n + 1)) / 2);
      const Lf = (f: number) => (T - P1 * f) / (1 - f / n);
      const iOf = (f: number) => (P1 - Lf(f) / n) / Lf(f);
      const LfE = (f: string) => `((${L(T)} - ${L(P1)}*${f})/(1 - ${f}/${n}))`;
      const iE = (f: string) => `((${L(P1)} - ${LfE(f)}/${n})/${LfE(f)})`;
      const Lc = Lf((n + 1) / 2);
      answer = iOf((n + 1) / 2);
      calc = iE(`${n + 1}/2`);
      model = { expr: `${L(T)} - ${L(P1)}*(1 + x*${n + 1}/2)/(1/${n} + x)`, bracket: [answer * 0.4, answer * 1.6], description: "Loan from the first payment, $L = P_1/(1/n + i)$, substituted into total payments $L(1 + i(n+1)/2)$." };
      ask = `The first payment is ${amt(P1)} and the payments total ${amt(T)}. Calculate $i$.`;
      distractors.push(
        distractor("SEQ_TERM_COUNT", iOf(n / 2), iE(`${n}/2`), {
          derivation: `$\\sum I_t = iL\\,\\tfrac{${n}}{2}$; $i = ${shown(iOf(n / 2), fmt)}$`,
          method: "Summed the opening balances as nL/2.",
          feedback: `The opening balances sum to $\\tfrac{${n + 1}}{2}L$.`,
        }),
        distractor("TIMING_PAYMENT_BEFORE_INTEREST", iOf((n - 1) / 2), iE(`${n - 1}/2`), {
          derivation: `$\\sum I_t = iL\\,\\tfrac{${n - 1}}{2}$; $i = ${shown(iOf((n - 1) / 2), fmt)}$`,
          method: "Charged interest on balances after each principal repayment.",
          feedback: "Interest is charged on the balance at the start of each year.",
        }),
        distractor("VAR_TOTAL_FOR_COMPONENT", (T - Lc) / Lc, `(${L(T)} - ${LfE(`${n + 1}/2`)})/${LfE(`${n + 1}/2`)}`, {
          derivation: `$(T - L)/L = ${shown((T - Lc) / Lc, fmt)}$`,
          method: "Divided total interest by the loan.",
          feedback: "That is total interest over the life as a fraction of the loan, not an annual rate.",
        }),
        distractor("MODEL_INTEREST_ON_ORIGINAL", (T - Lc) / (n * Lc), `(${L(T)} - ${LfE(`${n + 1}/2`)})/(${n}*${LfE(`${n + 1}/2`)})`, {
          derivation: `$(T - L)/(${n}L) = ${shown((T - Lc) / (n * Lc), fmt)}$`,
          method: "Spread total interest evenly over the years, as if charged on the original loan.",
          feedback: "Interest is charged on a falling balance; the average balance is $\\tfrac{n+1}{2n}L$, not L.",
        })
      );
      steps = [
        step("D.total-interest", `Total payments = loan + total interest = $L + iL\\,\\tfrac{${n + 1}}{2}$.`, ["T", T, "total of payments"], ["L", "i"]),
        step("D.interest-component", "The first payment is $L/n + iL$.", ["P_1", P1, "first payment"], ["L", "i"]),
        step("M.linear-system", "Eliminate iL between the two and solve for L.", ["L", Lc, "loan amount"], ["T", "P_1"], { rearranged: true }),
        step("D.interest-component", "Then $i = (P_1 - L/n)/L$.", ["i", answer, "annual effective rate"], ["P_1", "L"], { rearranged: true }),
      ];
    }

    const chainSpec = chain(steps, {
      methods: level === 1 ? ["arithmetic_series"] : ["elimination", "substitution"],
      reasoning: "With level principal, balances and interest fall arithmetically: sums and differences of payments replace annuity factors.",
      stages: Object.fromEntries(distractors.map((d) => [d.misconception, Math.min(steps.length - 1, ["VAR_TOTAL_FOR_COMPONENT", "MODEL_INTEREST_ON_ORIGINAL"].includes(d.misconception) ? steps.length - 1 : 0)])),
    });

    return {
      stem: `${stemHead}\n\n${ask}`,
      answer: { value: answer, calc, format: fmt, derivation: `$= ${shown(answer, fmt)}$` },
      model,
      distractors,
      explanation: explain({
        intuition: "Equal principal means the balance falls in equal steps, so the interest — and the payment — falls by the same amount every year. Everything is arithmetic: no annuity factor is needed.",
        unknowns: level === 3 ? [{ symbol: "$i$", meaning: "annual effective rate" }, { symbol: "$L$", meaning: "loan amount" }] : [{ symbol: level === 1 ? "$I$" : "$L$", meaning: level === 1 ? "total interest" : "loan amount" }],
        relationships: ["$P_t = \\dfrac{L}{n} + iL\\,\\dfrac{n - t + 1}{n}$", "$\\sum_t I_t = iL\\,\\dfrac{n+1}{2}$"],
        conditions: ["Principal repaid is the same in every payment."],
        valuationDate: "Payment dates",
        modelChoice: "Non-level payments with level principal (not an amortized level-payment loan).",
        assumptions: ["One annual effective rate throughout."],
        solution:
          level === 1
            ? [
                { title: "Opening balances", body: `$L, \\tfrac{${n - 1}}{${n}}L, \\dots, \\tfrac{1}{${n}}L$ sum to $\\tfrac{${n + 1}}{2}L = ${mnum((Lo * (n + 1)) / 2, 2)}$` },
                { title: "Total interest", body: `$${dec(i, 4)} \\times ${mnum((Lo * (n + 1)) / 2, 2)} = ${shown(answer, fmt)}$` },
              ]
            : level === 2
              ? [
                  { title: "Drop per year", body: `$iL = \\dfrac{${n}(P_k - P_m)}{m - k} = ${mnum(Number(steps[0].output.value), 2)}$` },
                  { title: "Loan", body: `$L = ${n}P_k - (n - k + 1)\\,iL = ${shown(answer, fmt)}$` },
                ]
              : [
                  { title: "Two equations", body: `$T = L + iL\\,\\tfrac{${n + 1}}{2}$, $P_1 = \\tfrac{L}{${n}} + iL$` },
                  { title: "Loan", body: `$L = ${mnum(Number(steps[2].output.value), 2)}$` },
                  { title: "Rate", body: `$i = (P_1 - L/${n})/L = ${shown(answer, fmt)}$` },
                ],
        alternative: {
          name: "Write out the schedule",
          body: "List the balances and payments year by year; the pattern is linear, so two rows determine the rest.",
          whenUseful: "When the arithmetic structure is not obvious.",
        },
        principle: "Know which part of a payment is level: level payment → geometric principal; level principal → arithmetic interest.",
        unusual: "The loan is not amortized by level payments, so annuity factors do not apply.",
        misread: "Interest is charged on the balance at the start of each year.",
      }),
      visuals: [routeVisual(chainSpec, "Route: arithmetic, not annuity factors", "Level principal makes every quantity linear in time.")],
      markers: [answer],
      presentation: level === 1 ? ["hidden-structure"] : ["inverse", "multi-equation", "hidden-structure"],
      features: features({ steps: level === 3 ? 4 : 3, unfamiliar: true }),
      params: { L: Lo, i, n, level },
      chain: chainSpec,
    };
  },
};

// ===================================================================== Bonds — Makeham with no stated term

const makeham: QuestionTemplate = {
  id: "apx-bond-makeham",
  family: "apx-bond-makeham",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.price_redemption",
  secondary: ["BONDS.coupons", "BONDS.yield"],
  reasoning: ["formula_selection", "concept_recognition", "translation"],
  soaConcept: "A coupon bond priced from a zero-coupon bond with the same redemption date and yield, using Makeham's formula — the term is never stated.",
  generate(rng, level): QuestionDraft {
    const fmt = MONEY2;
    const F = rng.choice([1000, 5000, 10000]);
    const C = level === 3 ? F * rng.choice([1.05, 1.1, 1.2]) : F;
    const r = gridRate(rng, 0.03, 0.1, 0.005);
    const y = drawUntil(() => gridRate(rng, 0.03, 0.1, 0.0025), (yy) => Math.abs(yy - r) >= 0.005);
    const nYears = rng.int(5, 20);
    const m = level === 1 ? 1 : 2;
    const j = level === 1 ? y : level === 2 ? y / 2 : Math.pow(1 + y, 0.5) - 1;
    const jE = level === 1 ? L(y) : level === 2 ? `(${L(y)}/2)` : `((1+${L(y)})**0.5-1)`;
    const K = round2(C * Math.pow(1 + j, -nYears * m));
    const cpn = (F * r) / m;
    const g = cpn / C;
    const answer = K + (g / j) * (C - K);
    const calc = `${L(K)} + (${L(cpn)}/${L(C)})/${jE}*(${L(C)}-${L(K)})`;
    const N = `(log(${L(C)}/${L(K)})/log(1+${jE}))`;
    const model = `${L(cpn)}*(1-(1+${jE})**(-${N}))/${jE} + ${L(C)}*(1+${jE})**(-${N})`;
    const yieldText = level === 1 ? `an annual effective yield of ${pc(y)}` : level === 2 ? `a yield of ${pc(y)} convertible semiannually` : `an annual effective yield of ${pc(y)}`;
    const coupons = level === 1 ? `annual coupons at a rate of ${pc(r)}` : `semiannual coupons at a rate of ${pc(r)} per year convertible semiannually`;

    const distractors: DistractorCandidate[] = [
      distractor("MODEL_IGNORED_COUPON", K, L(K), {
        derivation: `$${shown(K, fmt)}$`,
        method: "Took the zero-coupon bond's price.",
        feedback: "The coupon bond also pays coupons; their value is $\\tfrac{g}{i}(C - K)$.",
      }),
      distractor("CONC_IGNORED_REDEMPTION", (g / j) * (C - K), `(${L(cpn)}/${L(C)})/${jE}*(${L(C)}-${L(K)})`, {
        derivation: `$\\tfrac{g}{j}(C - K) = ${shown((g / j) * (C - K), fmt)}$`,
        method: "Valued the coupons only.",
        feedback: "Add the present value of the redemption payment, K.",
      }),
      distractor("ALG_INVERTED_RATIO", K + (j / g) * (C - K), `${L(K)} + ${jE}/(${L(cpn)}/${L(C)})*(${L(C)}-${L(K)})`, {
        derivation: `$K + \\tfrac{j}{g}(C - K) = ${shown(K + (j / g) * (C - K), fmt)}$`,
        method: "Inverted the ratio of coupon rate to yield.",
        feedback: "Makeham: $P = K + \\tfrac{g}{j}(C - K)$; a coupon rate above the yield must give a price above C.",
      }),
      distractor("FORMULA_PERPETUITY_FOR_FINITE", K + cpn / j, `${L(K)} + ${L(cpn)}/${jE}`, {
        derivation: `$K + Fr/j = ${shown(K + cpn / j, fmt)}$`,
        method: "Valued the coupons as a perpetuity.",
        feedback: "Coupons stop at redemption; their value is $\\tfrac{Fr}{j}\\left(1 - v^n\\right) = \\tfrac{Fr}{j}\\cdot\\tfrac{C-K}{C}$.",
      }),
      distractor("ALG_DIVIDE_ERROR", K + g * (C - K), `${L(K)} + (${L(cpn)}/${L(C)})*(${L(C)}-${L(K)})`, {
        derivation: `$K + g(C - K) = ${shown(K + g * (C - K), fmt)}$`,
        method: "Forgot to divide by the yield.",
        feedback: "$a_{\\overline{n|}} = (1 - v^n)/j$: the factor is $g/j$.",
      }),
    ];
    if (level === 3) {
      const g2 = (r / 2) / 1;
      const vFace = K + ((F * r) / 2 / F / j) * (C - K);
      distractors.unshift(
        distractor("CONC_BOND_REDEMPTION_AS_FACE", vFace, `${L(K)} + (${L(g2)})/${jE}*(${L(C)}-${L(K)})`, {
          derivation: `$g = r/2 = ${dec(g2, 4)}$; $= ${shown(vFace, fmt)}$`,
          method: "Used the coupon rate on face as the modified coupon rate g.",
          feedback: `Makeham's g is the coupon as a fraction of the redemption value: $g = Fr/C = ${dec(g, 6)}$.`,
        })
      );
      const jN = y / 2;
      const vN = K + (g / jN) * (C - K);
      distractors.push(
        distractor("RATE_NOMINAL_AS_EFFECTIVE", vN, `${L(K)} + (${L(cpn)}/${L(C)})/(${L(y)}/2)*(${L(C)}-${L(K)})`, {
          derivation: `$j = ${dec(jN, 4)}$; $= ${shown(vN, fmt)}$`,
          method: "Halved the annual effective yield to get the half-year rate.",
          feedback: `An annual effective ${pc(y)} is $(${dec(1 + y, 4)})^{1/2} - 1 = ${dec(j, 6)}$ per half-year.`,
        })
      );
    }

    const steps = [] as ReturnType<typeof step>[];
    if (level >= 2) steps.push(step("A.nominal-conversion", "Convert the yield to the coupon period.", ["j", j, "half-year yield"], ["y"]));
    if (level === 3) steps.push(step("E.premium-discount", "Modified coupon rate: coupon over redemption value.", ["g", g, "modified coupon rate"], ["F", "r", "C"]));
    steps.push(step("A.discount-factor", "K is the present value of the redemption payment — the same for the coupon bond.", ["K", K, "PV of redemption"], ["C"]));
    steps.push(step("E.makeham", "Makeham: $P = K + \\tfrac{g}{j}(C - K)$ — no term needed.", ["P", answer, "price"], ["K", "g", "j", "C"]));
    const chainSpec = chain(steps, {
      methods: ["substitution"],
      reasoning: "$C - K = C(1 - v^n) = Cj\\,a_{\\overline{n|}}$, so the coupons are worth $\\tfrac{g}{j}(C - K)$ without knowing n.",
      unconventional: true,
      stages: { MODEL_IGNORED_COUPON: steps.length - 1, CONC_IGNORED_REDEMPTION: steps.length - 1, ALG_INVERTED_RATIO: steps.length - 1, FORMULA_PERPETUITY_FOR_FINITE: [steps.length - 1, "selection"], ALG_DIVIDE_ERROR: steps.length - 1, CONC_BOND_REDEMPTION_AS_FACE: 1, RATE_NOMINAL_AS_EFFECTIVE: 0 },
    });

    return {
      stem: `A zero-coupon bond redeemable for ${amt(C)} on a certain date sells for ${amt(K)} at ${yieldText}. A bond with face amount ${amt(F)} and ${coupons} is redeemable for ${amt(C)} on the same date and is bought at the same yield.\n\nCalculate the price of the coupon bond.`,
      answer: { value: answer, calc, format: fmt, derivation: `$K + \\tfrac{g}{j}(C - K) = ${shown(answer, fmt)}$` },
      model: { expr: model, description: "Coupons as an annuity plus discounted redemption, with the term recovered from the zero-coupon price." },
      distractors,
      explanation: explain({
        intuition: "The zero-coupon bond's price is exactly the present value of the coupon bond's redemption payment. Makeham's formula needs only that, the coupon-to-redemption ratio and the yield — the term never appears.",
        unknowns: [{ symbol: "$P$", meaning: "price of the coupon bond" }],
        relationships: ["$P = K + \\dfrac{g}{j}(C - K)$", "$g = \\dfrac{Fr}{C}$ per coupon period"],
        conditions: ["Same redemption value, date and yield for both bonds."],
        valuationDate: "Purchase date",
        modelChoice: "Makeham's formula.",
        assumptions: ["Yield constant to redemption."],
        solution: [
          ...(level >= 2 ? [{ title: "Coupon-period yield", body: `$j = ${dec(j, 6)}$` }] : []),
          { title: "Ratio", body: `$g/j = ${dec(g, 6)}/${dec(j, 6)} = ${dec(g / j, 6)}$` },
          { title: "Price", body: `$${mnum(K, 2)} + ${dec(g / j, 6)}(${mamt(C)} - ${mnum(K, 2)}) = ${shown(answer, fmt)}$` },
        ],
        alternative: {
          name: "Recover the term",
          body: "Solve $K = Cv^n$ for n with logarithms, then price coupons and redemption separately — longer, same result.",
          whenUseful: "When a later part needs n anyway.",
        },
        principle: "Makeham prices a bond from the present value of its redemption alone.",
        unusual: "The term is not given.",
        misread: "g is the coupon divided by the redemption value, not by the face amount.",
      }),
      visuals: [routeVisual(chainSpec, "Route: Makeham, no term", "The zero-coupon price is the redemption's present value.")],
      markers: [K, answer],
      presentation: level === 1 ? ["hidden-structure"] : ["hidden-structure", "frequency"],
      features: features({ steps: steps.length, unfamiliar: true }),
      params: { F, C, r, y, n: nYears, level },
      chain: chainSpec,
    };
  },
};

// ===================================================================== Bonds — the yield from a premium and a discount

const premiumRatio: QuestionTemplate = {
  id: "apx-bond-premium-ratio",
  family: "apx-bond-premium-ratio",
  topic: "BONDS",
  levels: [1, 2, 3],
  objective: "BONDS.yield",
  secondary: ["BONDS.price_redemption", "BONDS.coupons"],
  reasoning: ["concept_recognition", "algebra", "financial_intuition"],
  soaConcept: "Two bonds with the same term and yield, one at a premium and one at a discount: premium ∝ (coupon − yield), so their ratio gives the yield without the term.",
  generate(rng, level): QuestionDraft {
    const C = 1000;
    const n = rng.int(8, 25);
    const y = gridRate(rng, 0.04, 0.08, 0.0025);
    const dA = rng.choice([0.02, 0.025, 0.03]);
    const dB = rng.choice([0.005, 0.01, 0.015]);
    const rA = y + dA;
    const rB = y - dB;
    const pA = round2(C * dA * an(n, y));
    const dBv = round2(C * dB * an(n, y));
    const iR = (rA * dBv + rB * pA) / (pA + dBv);
    const iE = `((${L(rA)}*${L(dBv)} + ${L(rB)}*${L(pA)})/(${L(pA)} + ${L(dBv)}))`;
    const distractors: DistractorCandidate[] = [];
    let answer: number;
    let calc: string;
    let model: { expr: string; bracket?: [number, number]; description: string };
    let fmt: AnswerFormat;
    let ask: string;
    const iEven = (rA + rB) / 2;
    const iSw = (rA * pA + rB * dBv) / (pA + dBv);
    const iSwE = `((${L(rA)}*${L(pA)} + ${L(rB)}*${L(dBv)})/(${L(pA)} + ${L(dBv)}))`;

    let rC = 0;
    if (level <= 2) {
      fmt = PCT2;
      answer = iR;
      calc = iE;
      model = { expr: `${L(pA)}*(x - ${L(rB)}) - ${L(dBv)}*(${L(rA)} - x)`, bracket: [rB + 1e-6, rA - 1e-6], description: "Premium and discount are both $C\\,a_{\\overline{n|}}$ times the coupon–yield gap; equate the implied annuity values." };
      ask = "Calculate the yield rate.";
      distractors.push(
        distractor("ALLOC_EVEN_SPLIT", iEven, `(${L(rA)}+${L(rB)})/2`, {
          derivation: `$(${mpc(rA)} + ${mpc(rB)})/2 = ${shown(iEven, fmt)}$`,
          method: "Averaged the two coupon rates.",
          feedback: "The yield sits between the coupon rates in proportion to the premium and discount, not halfway.",
        }),
        distractor("ALLOC_SWAPPED", iSw, iSwE, {
          derivation: `$\\dfrac{r_A p_A + r_B d_B}{p_A + d_B} = ${shown(iSw, fmt)}$`,
          method: "Weighted each coupon rate by its own bond's premium or discount.",
          feedback: "The yield is closer to the coupon rate of the bond whose price is closer to par: weight $r_A$ by B's discount and $r_B$ by A's premium.",
        }),
        distractor("FORMULA_CURRENT_YIELD", (rA * C) / (C + pA), `${L(rA)}*${C}/(${C}+${L(pA)})`, {
          derivation: `$${mpc(rA)} \\times ${C}/${mnum(C + pA, 2)} = ${shown((rA * C) / (C + pA), fmt)}$`,
          method: "Used bond A's current yield (coupon over price).",
          feedback: "Current yield ignores the loss of the premium at redemption; it is not the yield to maturity.",
        }),
        distractor("CONC_PAR_ASSUMPTION", (rB * C) / (C - dBv), `${L(rB)}*${C}/(${C}-${L(dBv)})`, {
          derivation: `$${mpc(rB)} \\times ${C}/${mnum(C - dBv, 2)} = ${shown((rB * C) / (C - dBv), fmt)}$`,
          method: "Used bond B's coupon over its price.",
          feedback: "That ignores the gain from the discount at redemption.",
        }),
        distractor("CONC_BOND_YIELD_IS_COUPON_RATE", rB, L(rB), {
          derivation: `$${shown(rB, fmt)}$`,
          method: "Took bond B's coupon rate as the yield.",
          feedback: "A bond sells at a discount precisely because its coupon rate is below the yield.",
        })
      );
    } else {
      fmt = MONEY2;
      rC = y + rng.choice([-0.02, -0.015, -0.01, 0.01, 0.015]);
      answer = C + C * (rC - iR) * (pA / (C * (rA - iR)));
      calc = `${C} + ${C}*(${L(rC)} - ${iE})*${L(pA)}/(${C}*(${L(rA)} - ${iE}))`;
      model = { expr: `${C} + (${L(rC)} - ${L(rB)})/(${L(rA)} - ${L(rB)})*(${L(pA)} + ${L(dBv)}) - ${L(dBv)}`, description: "Price is linear in the coupon rate: interpolate between the two given bonds." };
      ask = `A third bond with the same face, redemption value, term and yield pays annual coupons at a rate of ${pc(rC)}. Calculate its price.`;
      const priceAt = (i: number) => C + C * (rC - i) * (pA / (C * (rA - i)));
      distractors.push(
        distractor("ALLOC_EVEN_SPLIT", priceAt(iEven), `${C} + ${C}*(${L(rC)} - ${L(iEven)})*${L(pA)}/(${C}*(${L(rA)} - ${L(iEven)}))`, {
          derivation: `$i = ${mpc(iEven)}$; $= ${shown(priceAt(iEven), fmt)}$`,
          method: "Took the yield as the average of the two coupon rates.",
          feedback: "The yield is pinned down by the premium and the discount, not by the coupon rates alone.",
        }),
        distractor("ALLOC_SWAPPED", priceAt(iSw), `${C} + ${C}*(${L(rC)} - ${iSwE})*${L(pA)}/(${C}*(${L(rA)} - ${iSwE}))`, {
          derivation: `$i = ${dec(iSw, 6)}$; $= ${shown(priceAt(iSw), fmt)}$`,
          method: "Weighted the coupon rates the wrong way round.",
          feedback: "Weight $r_A$ by B's discount and $r_B$ by A's premium.",
        }),
        distractor("CONC_PRICE_YIELD_DIRECTION", 2 * C - answer, `${2 * C} - (${calc})`, {
          derivation: `$${C} - (P - ${C}) = ${shown(2 * C - answer, fmt)}$`,
          method: "Gave the premium the wrong sign.",
          feedback: rC > iR ? "Coupon rate above the yield: the bond sells at a premium." : "Coupon rate below the yield: the bond sells at a discount.",
        }),
        distractor("CONC_PAR_ASSUMPTION", C, `${C}`, {
          derivation: `$${shown(C, fmt)}$`,
          method: "Assumed the third bond sells at par.",
          feedback: "Only a bond whose coupon rate equals the yield sells at par.",
        }),
        distractor("FORMULA_PERPETUITY_FOR_FINITE", (C * rC) / iR, `${C}*${L(rC)}/${iE}`, {
          derivation: `$${C} \\times ${dec(rC, 4)}/${dec(iR, 6)} = ${shown((C * rC) / iR, fmt)}$`,
          method: "Priced the bond as coupon divided by yield.",
          feedback: "Coupon over yield values the coupons as a perpetuity and ignores redemption at par.",
        })
      );
    }

    const steps = [
      step("E.premium-discount", "Premium (or discount) = $C(r - i)\\,a_{\\overline{n|}}$ for both bonds, with the same $a_{\\overline{n|}}$.", ["p_A/d_B", pA / dBv, "ratio of premium to discount"], ["p_A", "d_B"], { derived: true }),
      step("M.linear-system", "$p_A (i - r_B) = d_B (r_A - i)$: solve for i.", ["i", iR, "yield rate"], ["r_A", "r_B", "p_A", "d_B"], { rearranged: true }),
    ];
    if (level === 3) {
      steps.push(step("E.premium-discount", "The common annuity factor: $a_{\\overline{n|}} = p_A/(C(r_A - i))$.", ["a_n", pA / (C * (rA - iR)), "annuity factor"], ["p_A", "i"], { rearranged: true }));
      steps.push(step("E.premium-discount", "Third bond: $C + C(r_C - i)\\,a_{\\overline{n|}}$.", ["P_C", answer, "price of the third bond"], ["a_n", "i"]));
    }
    const chainSpec = chain(steps, {
      methods: ["elimination", "equation_construction"],
      reasoning: "Both bonds share $a_{\\overline{n|}}$ at the common yield; dividing premium by discount eliminates it and leaves a linear equation in i.",
      unconventional: true,
      stages: Object.fromEntries(distractors.map((d) => [d.misconception, Math.min(steps.length - 1, 1)])),
    });

    return {
      stem: `Bonds A and B each have face amount ${amt(C)}, are redeemable at par at the same date and pay annual coupons. They are bought to give the same annual effective yield. Bond A has a coupon rate of ${pc(rA)} and sells at a premium of ${amt(pA)}. Bond B has a coupon rate of ${pc(rB)} and sells at a discount of ${amt(dBv)}.\n\n${ask}`,
      answer: { value: answer, calc, format: fmt, derivation: `$i = ${dec(iR, 6)}$; $= ${shown(answer, fmt)}$` },
      model,
      distractors,
      explanation: explain({
        intuition: "A bond's premium is the coupon excess over the yield, paid as an annuity: $C(r - i)a_{\\overline{n|}}$. Both bonds share the same annuity factor, so the premium and the discount are in the ratio $(r_A - i):(i - r_B)$ — one linear equation in i, and the term never matters.",
        unknowns: [{ symbol: "$i$", meaning: "common yield rate" }],
        relationships: ["$P - C = C(r - i)\\,a_{\\overline{n|}}$", `$\\dfrac{${mnum(pA, 2)}}{${mnum(dBv, 2)}} = \\dfrac{r_A - i}{i - r_B}$`],
        conditions: ["Same term, redemption value and yield."],
        valuationDate: "Purchase date",
        modelChoice: "Premium/discount formula for both bonds.",
        assumptions: ["Annual coupons; annual effective yield."],
        solution: [
          { title: "Yield", body: `$i = \\dfrac{r_A d_B + r_B p_A}{p_A + d_B} = ${level <= 2 ? shown(answer, fmt) : dec(iR, 6)}$` },
          ...(level === 3 ? [{ title: "Third bond", body: `$a_{\\overline{n|}} = ${dec(pA / (C * (rA - iR)), 6)}$; $P = ${C} + ${C}(r_C - i)a_{\\overline{n|}} = ${shown(answer, fmt)}$` }] : []),
        ],
        alternative: {
          name: "Price is linear in the coupon rate",
          body: "Plot price against coupon rate: the line through the two bonds crosses par at the yield, and passes through every other bond with the same term and yield.",
          whenUseful: level === 3 ? "Gives the third bond's price by interpolation without finding i." : "As a quick check.",
        },
        principle: "Bonds with the same term and yield have premiums proportional to their coupon–yield gaps.",
        unusual: "The term is not given.",
        misread: "The yield is not the average of the coupon rates.",
      }),
      visuals: [routeVisual(chainSpec, "Route: ratio of premiums", "The annuity factor cancels.")],
      markers: [iR, answer],
      presentation: ["unknown-rate", "hidden-structure", "compare-streams"],
      features: features({ steps: level === 3 ? 4 : 3, unfamiliar: true, multiConcept: true }),
      params: { n, y, rA, rB, rC, level },
      chain: chainSpec,
    };
  },
};

export const APPROACH_LOAN_BOND_TEMPLATES: QuestionTemplate[] = [firstLast, twoBalances, equalPrincipal, makeham, premiumRatio];
