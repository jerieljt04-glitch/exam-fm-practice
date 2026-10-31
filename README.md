# Exam FM Practice — diagnostic and challenge simulator

A personalised preparation tool for SOA Exam FM (December 2026 syllabus). It is built to expose
weaknesses in reasoning — formula selection, translation, cash-flow timing, transfer to unfamiliar
presentations — rather than to drill familiar questions.

> Independent study tool. Not affiliated with, endorsed by, or sponsored by the Society of
> Actuaries. Every question is generated and validated by this application.

## Running it

```bash
npm install
npm run dev            # http://localhost:3000
```

No database server or API key is needed. History is stored in a local SQLite file,
`data/exam-fm.db`, created automatically by `npm run dev` / `npm start`.

Production server: `npm run build && npm start`.

### As a desktop app (macOS)

```bash
npm run app:build      # installs "Exam FM Practice.app" in ~/Applications (+ Desktop shortcut)
npm run app:stop       # stops the background server
```

The app starts the production server on port 4173, rebuilds when the sources change, and opens the
dashboard. Re-run `npm run app:build` after moving the project folder.

## What it does

| Mode | Purpose |
| --- | --- |
| **Diagnostic** | Untimed, mixed, unlabelled. Default 15 questions; length and difficulty adjustable. Leans toward skills your history has not tested yet. |
| **Exam simulation** | 30 questions, 150 minutes, five options, topic split 3/7/6/6/8 (inside every published weight band). |
| **Challenge** | Harder-than-exam reasoning inside the syllabus. Scored separately from SOA-standard work. |
| **Formula practice** | Questions chosen by how many formulas they connect (integration levels 1–5), default mix 20% single formula / 40% two formulas / 30% three or more / 10% reconstruction or derivation, adjustable on the dashboard. |
| **Remediation** | Built from your mistakes: two new problems on the same principle from different templates, then a retest after 24 hours. |
| **Transfer check** | From any reviewed question: two questions testing the same principle in a different context. |

During a session nothing reveals the topic, the answer, or whether you are right — the server never
sends that data until submission. Each question records your answer, a required confidence rating,
an optional method, your working (with KaTeX preview) and the time spent. Progress autosaves, so a
closed tab or browser loses nothing; the clock pauses while the page is closed.

After submission the report shows overall, per-difficulty and per-topic results; a 14-dimension
reasoning profile; the misconceptions your chosen answers correspond to; confidence calibration;
and where errors cluster by question feature. Every statement is labelled **observed** (what was
recorded) or **inferred** (an interpretation). Each question has six explanation layers: visual
intuition, mathematical translation, main solution, alternative solutions, why each wrong answer
is wrong (with the arithmetic that produces it), and the transfer principle.

The dashboard tracks history, current weaknesses, common misconceptions, SOA-standard improvement,
mastery for every syllabus learning outcome, and your starting profile — each strength and
weakness from your own account, tested against the evidence. A skill is never “mastered” after one
correct answer: mastery needs three secure answers on three different presentations, across
sittings at least 20 hours apart.

### Formulas

The **formula library** (`/formulas`) is built from the two reference sheets in
`reference_material/formula_sheets/` — TIA *FM Formula Sheets* (2026-08-10, 15 pages) and ACTEX
*Exam FM Formula & Review Sheet* (2023-06-29, 5 pages) — read page by page, not by text extraction.
`lib/formulas/registry.ts` holds 77 formulas, each with a canonical statement, every sheet's own
notation with its PDF page and section, variables, assumptions, conditions, meaning, prerequisites,
related formulas, common misuse, applications, a derivation and the syllabus outcomes it serves.

- Forms the sheets write differently (geometric annuities, increasing perpetuities, i^(m)/d^(m),
  Makeham, modified duration and convexity, retrospective and prospective balances…) are
  cross-referenced only after `scripts/tests/formulas.test.ts` confirms they agree numerically.
- Genuine differences are **flagged, not merged** (14 entries), e.g. P versus R for the loan payment,
  `A_t` meaning a cash flow on one sheet and its present value on the other, a misprint in one
  sheet's Makeham formula, ACTEX's callable-bond shortcut missing a stepped-down call price, and
  Redington's third condition stated in a form that only holds once the first two do.
- Four formulas are on a sheet but of unclear relevance to the current syllabus (continuous and
  continuously varying annuities, m-thly increasing annuities, the second-order price
  approximation). They are marked, and the question bank never requires them.
- `lib/formulas/graph.ts` holds the prerequisite graph and the six named chains (amortization,
  refinancing, bond, interest-rate, duration/immunization, general cash flow).

Every question records its **formula chain**: the formulas in order, why each is used, what it
produces and which later step uses it, the algebraic methods involved (substitution, elimination,
working backwards, series…), and a route to the answer without memorised formulas. Every wrong
option is tied to the step where its mistake happens and to the kind of error — selecting the
formula, applying it, connecting it to the next step, or interpreting the result. The integration
level (1–5) is computed from the chain. After submission the review shows the chain as a numbered
flow with your answer's break point marked, and the report's **Formula chains** tab tallies where
your wrong answers left the chain.

**Reference modes.** Diagnostics, exams and challenges are always **closed book**. Formula practice
can run as **formula integration practice** (nothing shown; chain revealed after submission) or
**formula-supported learning** (the library is open beside the question, with a filter for this
question's formulas listed alphabetically so the order of use is not given away).

**Formula mastery** is tracked per formula and per combination of consecutive formulas, across
recognising, retrieving, applying, rearranging, deriving, combining, using in an unfamiliar
presentation, and recognising when a formula does not apply. A correct answer passes every step;
a wrong one passes the steps before its break point, fails that step, and says nothing about the
rest. A formula is mastered only after successful use in three presentations including a
combination and an unfamiliar one — reproducing it is not enough.

The **Visual lab** (`/lab`) has interactive loan amortization (with refinancing), annuity, bond,
duration/convexity/Redington, arithmetic-versus-geometric and free-form cash-flow explorers.

## How questions are generated and validated

The bank has 47 parameterised templates (96 template × difficulty combinations), including eight
formula-integration templates (bond price → forward rate, an unknown refinancing rate, an
equivalent level annuity, a payoff between payment dates, a business valued as a growing stream,
two annuities solved simultaneously, growing deposits every few years, and a price change built
from scratch), across all five
syllabus areas, and every wrong option is produced by one of 64 catalogued misconceptions — never
by spacing numbers around the answer. A template supplies, for each question:

- the answer and the arithmetic that produces it (`calc`);
- an **independent equation of value** (`model`) written from explicit cash flows, not closed forms;
- four or more misconception distractors, each with its own arithmetic, derivation, explanation and
  how-to-recognise tip;
- the six explanation layers and the visual specifications;
- the formula chain, with the step and kind of error behind each distractor.

`lib/engine/validate.ts` then recomputes the answer and every option from their expressions,
solves the equation of value independently, requires **exactly one** option to satisfy it,
requires all five displayed options to be distinct and every misconception to be different,
checks every derivation states the value it claims, typesets every piece of mathematics, and
checks the formula chain (every formula in the library and mapped to the syllabus, finite values,
the last step equal to the answer, every trap placed at a real step).
A draft that fails any check is regenerated with a new seed; a template that cannot pass is
flagged and skipped. Nothing unvalidated reaches a session, and every question stores its
validation record (shown at the foot of each question review).

`npm run test:sympy` additionally re-derives a sample of the bank (288 questions) in Python with SymPy at 40-digit
precision — every option, every displayed rounding, and the equation of value — independently of
the TypeScript engine.

### Optional language-model wording

Set `ANTHROPIC_API_KEY` (see `.env.example`) to offer a “vary question wording” option. The model
only rewrites the scenario text; a rewording is accepted only if every number and every
mathematical expression is unchanged, no method or topic is revealed, and it still typesets.
Otherwise the validated original is used. The key is used only on the server.

## Tests

```bash
npm test               # unit, bank, trap, session and persistence tests, then the SymPy check
npm run validate:bank  # stress-build every template level (default 40 seeds: `validate:bank -- "" 150`)
npm run typecheck
npm run lint
```

Test coverage includes the financial formulas against explicit sums, annuity-immediate versus
annuity-due, amortization and outstanding balances (retrospective = prospective), refinancing,
bonds, duration and convexity against numerical derivatives, root finding, validator rejection of
bad questions, the eight named traps (interest on the payment, a combined amount treated as one
account's, the annuity-due extra period, valuation-date moves, arithmetic versus geometric,
substitution slips, algebra slips, refinancing periods), the exam distribution, scoring, the
timer, mastery, the remediation cycle, and save/restore/submit/report persistence (on a temporary
database), the formula registry (pages, links, syllabus mapping, typesetting, no prerequisite
cycles), the numerical equivalence of the sheets' alternative forms, chain coverage of every
integration level and named chain, the practice-mode mix, the reference modes, chain diagnosis and
formula mastery. `scripts/e2e.ts` drives a running server through the full flow over HTTP.

## Layout

```
lib/syllabus.ts            syllabus data: topics, weights, outcomes, exam structure
lib/profile.ts             starting diagnostic hypotheses
lib/formulas/              formula registry (from the two sheets) and relationship graph
lib/reference.ts           closed / supported / integration reference modes
lib/engine/                finance maths, expression engine, misconceptions, validator,
                           assembly, session builder, templates/ (the question bank)
lib/analysis/              evidence, reasoning profile, report, mastery, formula mastery, remediation
lib/server/                SQLite (Prisma) repository
lib/llm/provider.ts        optional rewording, checked before use
app/                       dashboard, session, report, formulas, lab pages and API routes
reference_material/        the two formula sheets (PDF)
components/                exam runner, report, formula library and chain views, visualisations, lab
scripts/                   tests, SymPy validator, desktop launcher
```

To update the syllabus when the SOA publishes a new one, edit `lib/syllabus.ts`.
