# Authoring questions

This guide is the contract for adding questions to the bank. Every question is
generated from a seeded template, passes an independent validator, and is
stored with its validation record. Nothing unvalidated reaches a session.

> Independent study tool — not affiliated with or endorsed by the SOA. Items are
> original. Use the SOA's published Exam FM sample questions and syllabus only
> for *structure*: terminology, notation, archetypes, answer forms, testing
> philosophy. Never copy or closely paraphrase an SOA question.

## Two kinds of template

| Kind | File(s) | Options | Validator |
| --- | --- | --- | --- |
| Numerical (`QuestionTemplate`) | `lib/engine/templates/{tvm,annuities,loans,bonds,alm,integrated,single}.ts` | one number each (money, percent, number, time) | `lib/engine/validate.ts` |
| Typed (`ChoiceTemplate`) | `lib/engine/concepts/<topic>.ts` (Concept Practice), `lib/engine/templates/composite.ts` (composite calculation) | `OptionContent` — text, math, statements, composite, table | `lib/engine/validate-choice.ts` |

Types live in `lib/engine/types.ts` and `lib/engine/answers.ts`. Authoring helpers:
`lib/engine/templates/kit.ts` (numbers, prose, expressions, formula chains) and
`lib/engine/concepts/kit.ts` (`conceptTemplate`, `conceptQuestion`,
`statementQuestion`, `statement`, `text`, `math`, `keys`, `compositeTemplate`).

Reference examples: `lib/engine/concepts/tvm.ts` (equation-of-value selection
with numeric probes), `lib/engine/concepts/annuities.ts` (error diagnosis with
truth checks), `lib/engine/concepts/alm.ts` (statement combination with
quantitative checks), `lib/engine/templates/alm.ts` (numerical).

## Answer types

```ts
type OptionContent =
  | { type: "numeric"; value; format }                   // money / percent / number / time
  | { type: "text"; text }                               // markup: prose + inline $…$
  | { type: "math"; latex }                              // one formula / equation / condition
  | { type: "statements"; keys: ("I"|"II"|"III"|"IV")[] } // "I and III only", [] = "None"
  | { type: "composite"; style: "ordered-pair" | "allocation" | "amounts"; parts: { label, value, format }[] }
  | { type: "table"; columns; rows };
```

All five options of a question have the same content type. Questions may carry
`exhibits` (a table, or the numbered statements) shown with the stem.

## What the typed validator enforces

A draft is rejected (and regenerated with a new seed) unless **every** check passes:

1. Five options, exactly one correct, four distractors with **five different
   misconception ids** (from `lib/engine/misconceptions.ts` +
   `lib/engine/misconceptions-extra/*`). Supply **more than four** distractor
   candidates where you can; the validator picks the first four that pass.
2. Options distinct after normalisation (case, spacing, punctuation, LaTeX
   spacing). Numeric/composite components must differ visibly (≥ 0.75% or
   1.5 display units) and use one shared format.
3. **Statements**: keys I, II, III… in order; each has `truth`, a
   `justification` and the `misconception` that makes a candidate misjudge it.
   Give a quantitative statement a `check` (`{ expr, op, than }`): its truth is
   re-derived and must match `truth`. The correct combination must equal the set
   of true statements; no distractor may.
4. **Math options**: every option carries a `probe` — an expression in `x`
   (an equation f(x)=0 whose root is the quantity the option defines) or a plain
   expression (the value it states) — and `reference.values` gives the true
   quantity (an equation needs a `bracket`). The correct probe must define the
   reference quantity; no distractor may; two distractors defining the same
   quantity are rejected as equivalent. Alternatively attach a `check`.
5. **Checks on options** (`check`): must hold for the correct option and fail
   for every distractor that has one. Use these for error diagnosis ("fixing
   the error as described gives the right value") and correct-statement items.
6. **Numeric / composite**: one `calc` expression per component, recomputed
   independently; the correct components must equal `reference.values`.
7. **Length bias**: for text and math options the correct option's length is at
   most 1.6 × the mean distractor length. Keep options parallel in structure
   and detail; do not hedge only the correct one.
8. **Concept chain** (required for `practice: "concept"`): `steps` (each tied
   to a concept id in `lib/concepts/`), `conditions` (≥ 1), and for every
   distractor a `stage` (0-based step index) and `failure`
   (`recognition | interpretation | selection | application | connection |
   conclusion`). `confusedWith`, if given, must be a registered concept id.
9. Every outcome id exists; the primary outcome is inside the template's topic.
10. All markup typesets with KaTeX; no `hint`, no topic labels in the stem.

## Writing in the SOA style

- Concise, neutral stems. State facts, then ask for exactly one conclusion:
  "Calculate …", "Determine which of the following …", "Which of the following
  is true?" No teaching inside the stem, no method clues, no topic labels.
- SOA notation: `$a_{\overline{n|}}$`, `$\ddot{a}_{\overline{n|}}$`,
  `$s_{\overline{n|}}$`, `$v$`, `$d$`, `$i^{(m)}$`, `$d^{(m)}$`, `$\delta$`,
  `$(Ia)_{\overline{n|}}$`, `$(Da)_{\overline{n|}}$`, annual effective unless stated.
  Write money as bare numbers (via `amt` / `mamt`), never with a raw `$`.
- Distractors are realistic misunderstandings (nominal vs effective, discount
  vs interest, due vs immediate, PV vs face, Macaulay vs modified, single
  yield vs spot rates, reversed forward relation, "equal PV immunizes",
  ignoring convexity, price/book/market/redemption, formula outside its
  assumptions…), never arbitrary offsets or absurd claims.
- For false statements and wrong options give `conditionTrue` — the condition
  under which it *would* be true — whenever that is instructive.
- Concept questions must be solvable mainly by understanding. Light arithmetic
  is fine; long computation is not the point.
- Stay inside the December 2026 syllabus outcomes (`lib/syllabus.ts`). No
  stochastic models, contingencies, or later-exam material.

## Expression traps

- `vPow(i, t)` returns `(1+i)**(-(t))` without outer parentheses: write
  `(${vPow(i, t)})**2`, never `${vPow(i, t)}**2`.
- Truth checks compare with tolerance `tol × max(1, |lhs|, |rhs|)` (default
  `tol = 1e-6`), so for quantities below 1 it is effectively absolute. When a
  `<`/`>` claim turns on a tiny difference between rates, scale both sides
  (e.g. compare `1e4 * rate`) or pass a smaller `tol`.
- `mnum` / `mamt` write `{,}` thousands separators for use inside `$…$`. The
  renderer and plain-text labels convert them in prose, but prefer `amt` /
  `num` outside mathematics.

## Levels

| Level | Structure (see `docs/difficulty-rubric.md`) |
| --- | --- |
| 1 SOA standard | 1–3 reasoning steps, familiar presentation |
| 2 Advanced | 2–4 steps plus an inverse, unfamiliar, multi-date or connected-concept feature |
| 3 Challenge | 3–6 steps, ≥ 2 connected formulas/concepts, a non-obvious modelling or interpretation decision |

Calibration is computed from the item (`lib/engine/calibration.ts`):
`features.steps`, the length of the formula/concept chain, presentation tags
(`inverse`, `hidden-structure`, `valuation-date`, …) and `modelingDecisions`.
Set these honestly; tests check every level-3 item against the rubric.

## Concept Practice templates

```ts
conceptTemplate({
  id: "con-<topic>-<slug>", family: "con-<topic>-<group>", topic, levels: [1, 2] | [2, 3] | [1, 2, 3],
  objective: "<TOPIC>.<outcome>", secondary: [...],
  itemFormat: "definition" | "interpretation" | "classification" | "equation-selection" | "expression-selection"
            | "statement-combination" | "correct-statement" | "enumerated-conditions" | "comparative-statics"
            | "applicability" | "error-diagnosis" | "timeline-reading",
  conceptFamily: "definition" | "applicability" | "equation" | "relationship" | "statements"
               | "interpretation" | "error-diagnosis" | "notation" | "timeline" | "cross-topic",
  dimensions: [...ConceptDimension],
  soaConcept: "one line: the archetype",
  variants: 2,            // ≥ 2 genuinely different presentations (wording AND option structure)
  generate(rng, level, variant) { return conceptQuestion({...}) | statementQuestion({...}) },
})
```

- `variant` must change the presentation, not just the numbers: a different
  scenario, a different direction of the question (which is true / which is
  false), a different option structure.
- Draw parameters with `rng` so numbers vary by seed; the same seed must give
  the same question.
- Light numbers in a stem are welcome (they make statements checkable).

## Checking your work

```bash
npm run validate:choice -- con-tvm 30   # typed templates whose id starts with con-tvm, 30 seeds per level×variant
npm run validate:bank -- alm- 40        # numerical templates
npm run typecheck
npm test                                # full suite (unit + SymPy)
```

Every template × level × variant must build on every seed.
