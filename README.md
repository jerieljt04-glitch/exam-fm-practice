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
`data/exam-fm.db`, created automatically by `npm run dev` / `npm start`. When the schema changes,
setup first copies the database to `data/backups/` and applies only non-destructive changes
(Prisma refuses anything that would drop data); history is never reset.

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
| **Exam simulation** | 30 SOA-standard questions, 150 minutes, five options, topic split 3/7/6/6/8 (inside every published weight band). About a quarter of the items are conceptual, symbolic, statement or composite-answer items (configurable in `lib/engine/style.ts`; not an official SOA distribution). |
| **Challenge** | Harder-than-exam reasoning inside the syllabus. Every question is Level 3: a shortage produces a shorter, disclosed session — never an easier question. Scored separately from SOA-standard work. |
| **Formula practice** | Practice retrieving, connecting, rearranging and deriving formulas. Questions chosen by how many formulas they connect (integration levels 1–5), default mix 20% single formula / 40% two formulas / 30% three or more / 10% reconstruction or derivation, adjustable on the dashboard. |
| **Concept practice** | Test whether you understand what the formulas mean, when they apply, and how financial quantities relate. 5–20 questions; SOA standard, Advanced, Challenge or mixed; focus on mixed concepts, definitions and interpretation, equations and notation, statement analysis, or error diagnosis; optional topic filter; closed book. Scored into concept mastery, separately from formula mastery. |
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

## Study area: formula memorisation and concepts

`/study` (also linked from the dashboard and the header) is for *learning with instant feedback*,
separate from the closed-book sessions. Its answers are stored in two additive tables
(`StudyCard`, `StudyAttempt`) and never count toward formula, concept or calculation mastery.

| Tool | What it does |
| --- | --- |
| **Formula flashcards** (`/study/flashcards`) | Every formula in the library (both sheets) as two cards: *recall* (name and purpose → write the formula) and *recognise* (formula → name, use and conditions). The back shows the formula, each sheet's own notation with its PDF page, symbols, assumptions, common misuse and a memory hook. Optional write-it-out box with LaTeX preview. Spaced repetition (`lib/study/schedule.ts`, an SM-2 variant): Again / Hard / Good / Easy, keys `space` and `1`–`4`; a forgotten card returns later in the same round. Filter by sheet section and direction; cram mode reviews a whole selection. Formulas of unclear syllabus relevance are off by default. |
| **Concept flashcards** | Every concept in `lib/concepts/` — explain it, then compare with the summary and the ideas it is confused with. |
| **Formula drill** (`/study/drill`) | 49 formulas, each beside three near-misses (i for d, n − t for n − t + 1, a for ä, a missing root, a flipped ratio). Each wrong form says what it actually computes. `lib/study/drill.ts` carries numerical evaluators: the tests require the correct form to match an independent computation (cash flows summed one by one, schedules simulated, rates by bisection, derivatives by finite differences) and every near-miss to differ from it. |
| **Quick checks** (`/study/concepts`) | 116 true/false statements on what the formulas mean, when they apply and which way quantities move, each with the reason and the sheet page. 54 quantitative ones carry a `check` that the tests evaluate against the stated verdict. |
| **Concept questions with feedback** (`/study/concepts?tab=questions`) | One question at a time from the validated Concept Practice bank (filter by topic, focus, level), with the full explanation — why each option is right or wrong, the concept chain and the transfer principle — as soon as you answer. |

The hub tracks due cards, card maturity, accuracy by topic for each tool, the cards forgotten most
and the formulas missed in the drill. Missed drill items and quick checks can be re-drilled on
their own until answered correctly.

## Answer types and Concept Practice

Answer choices are typed content (`lib/engine/answers.ts`), not free HTML:

| Type | Used for |
| --- | --- |
| numeric | money, percentages, plain numbers, times and period counts |
| text | definitions, classifications, interpretations, correct-statement items (prose with inline mathematics) |
| math | formulas, equations of value, symbolic relationships, inequalities and conditions |
| statements | "I only", "I and III only", "I, II, and III", "None" — over numbered statements shown with the question |
| composite | ordered pairs, portfolio allocations, several cash-flow amounts |
| table | small tables |

Questions can also carry exhibits — tables and cash-flow schedules, and the numbered statements.
Questions stored before this model have no typed content; they are read as the numeric variant,
so every old session, report and mastery record still opens unchanged.

**Concept Practice** items are built from a *concept chain* — the concepts required (registry in
`lib/concepts/`), the reasoning sequence, the conditions it relies on — and every wrong option is
placed at the step where its reasoning fails, with the kind of failure (recognition,
interpretation, selection, application, connection or conclusion), the concept it confuses and,
where useful, the condition under which it would be true. The ten families are definition,
formula applicability, equation construction, relationships and comparative statics, statement
analysis, interpretation, error diagnosis, notation, timeline reasoning and cross-topic concepts.
After submission each concept question shows why the right choice is right and every other one
wrong, the statement truth table, the applicable relationship, a boundary case, the transfer
principle, the learning outcomes and the misconception and failure type of your choice. A wrong
concept answer opens a remediation item whose retest is a *different kind* of question on the
same idea (another family or format), not the same question with new numbers.

**Concept mastery** (`lib/analysis/concepts.ts`) is tracked by topic, learning outcome, concept and
ten dimensions (terminology, interpretation, conditions, applicability, equation construction,
timing, rate conversion, relationships, error recognition, transfer), with weak concepts,
frequently confused concept pairs, conceptual misconceptions, improvement over time and concept
versus calculation accuracy. Concept items never count toward formula mastery or calculation
mastery, and calculation items never count toward concept mastery.

Authoring rules for all question kinds: `docs/authoring.md`.

## Difficulty calibration

Every question records a structural calibration (`lib/engine/calibration.ts`): stem length,
reasoning steps, connected formulas and concepts, inverse structure, valuation dates,
unfamiliarity, multi-concept, reconstruction, answer type, calculator burden and an expected-time
band — the first group measured from the item, the last two inferred. `docs/difficulty-rubric.md`
defines the SOA-standard, Advanced and Challenge targets; tests require every Level-1 and
Level-3 question to meet them. `npm run report:calibration` summarises the whole bank by topic,
outcome, difficulty, format, steps, formulas, concepts, integration level, presentation,
expected time and distractor category, and checks outcome coverage.

## Different reasoning every exam, not different numbers

Re-taking an exam should not mean re-doing the same steps with new numbers. Two mechanisms
prevent it:

- **Solution-approach memory** (`lib/engine/approach.ts`). Every calculation question is
  fingerprinted by its solution route — the formulas in order, how each is used (rearranged or
  derived) and the algebraic methods. No exam repeats a route while another is available, and each
  new session steers away from the routes (and templates) used in the last six submitted sessions,
  with the most recent weighted heaviest. When a template can produce more than one route, a fresh
  one is drawn first.
- **Solution-approach bank** (`lib/engine/templates/approach-*.ts`): 13 templates on familiar
  syllabus topics, each reaching the answer by a route the rest of the bank does not use, at all
  three levels so they reach the timed exam simulation too. Examples: the stated growth factor used
  as the unit of time (the rate is never found); the rate from the ratio of two years' interest; a
  decreasing annuity from the `(Ia) + (Da) = (n+1)a` identity at an unstated rate; the rate from
  `1/a − 1/s = i` with no stated term; a perpetuity split whose condition is a quadratic in `vⁿ`;
  a loan from one payment's interest and another payment's principal; the loan rate from two
  outstanding balances; equal-principal (non-level) repayment; Makeham's formula with no stated
  term; the yield from two bonds' premium and discount; a yield read back from a perpetuity's
  duration; a duration updated by PV-weighting; and the IRR used as an input to recover unknown
  cash flows.

**Multi-route families** (`lib/engine/templates/approach-{mixed,curve-inflation,amortization}.ts`):
11 more families, each drawing one of several twists per level so one family can serve several
different routes, with Challenge versions of 4–6 steps:

- *Mixed present values* — an annuity followed by a (growing) perpetuity under a rate that changes
  mid-stream (before, at or after the switch in payments); a perpetuity bought at one yield and sold
  at another (value received, required sale price, buyer's yield, holding-period yield, including
  arithmetically increasing perpetuities); monthly payments followed by an annual perpetuity with
  deferral, rate changes and growth; a forward-rate or spot-rate curve with a flat perpetual tail.
- *Spot rates* — bootstrapping spot and forward rates from coupon-bond prices, par yields and yields
  of other bonds from the bootstrapped curve; zero-coupon prices hidden in a ladder of annuity
  prices (spot, forward, bond price, yield, and the increasing annuity `4A₄ − A₃ − A₂ − A₁`).
- *Inflation* — indexed annuities and perpetuities (nominal growth vs real rate, payments stated in
  today's money, indexation that starts late with the rate given in real terms); index-linked bonds
  with indexed or fixed redemption; saving for a target in today's money with level deposits,
  deposits that rise with inflation, and inflation that changes part-way.
- *Bond amortization* — interest income over the life, in one coupon, over a window of coupons, or
  used backwards to recover a book value; book values, the price and later book values worked from
  a single write-down or write-up; the yield from two write-downs.

These families value cash flows with a shared kit (`flows-kit.ts`) that handles level and geometric
segments, payments every k periods and rate regimes. The answer uses closed forms; the
independent check discounts payment by payment through the regimes.

**Harder exams.** The exam simulation offers SOA standard, Mixed, Advanced, **Hard mix** (Advanced
and Challenge only, three in five at Challenge) and **Challenge**; every setting builds the full
30-question blueprint.

**Abandoned attempts count.** The approach memory reads the last six sessions *served* — submitted
or not — so starting and abandoning an exam does not make its routes reappear in the next one.

The design follows SOA sample-question practice and item-writing research: difficulty should come
from recognising structure and choosing a method (inverse problems, hidden relationships, two
partial facts combined into a system, unstated quantities that are not needed), not from heavier
arithmetic or unclear wording, and wrong options come from real misconceptions.

## How questions are generated and validated

The bank has 233 parameterised templates: 88 numerical templates — including the single-formula and
formula-integration templates and 12 Challenge templates added so every learning outcome has Level-3
coverage — 12 composite calculation templates (ordered pairs, portfolio allocations, table-driven and
cash-flow-schedule items) and 133 Concept Practice templates covering all 42 learning outcomes at
SOA-standard and higher levels. Every wrong option is produced by a catalogued misconception —
never by spacing numbers around the answer. `docs/calibration-report.md` gives the counts by topic,
outcome, level, format and family. A numerical template supplies, for each question:

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

Typed questions pass `lib/engine/validate-choice.ts`: statement truth values are re-derived from
quantitative checks and the correct combination must be exactly the true statements; equation and
expression options are probed numerically so that exactly one defines the reference quantity and
equivalent equations are rejected; option claims must hold for the correct option only; composite
answers are recomputed component by component against an independent reference; options must be
distinct after normalisation, of one type and format, tied to five different misconceptions, and
the correct option may not stand out by length; concept chains must place every distractor at a
real step.

`npm run test:sympy` additionally re-derives a sample of the bank in Python with SymPy at 40-digit
precision — every numeric and composite option, every displayed rounding, every equation of value,
every quantitative statement and option claim, and every equation probe — independently of the
TypeScript engine.

### Optional language-model wording

Set `ANTHROPIC_API_KEY` (see `.env.example`) to offer a “vary question wording” option. The model
only rewrites the scenario text; a rewording is accepted only if every number and every
mathematical expression is unchanged, no method or topic is revealed, and it still typesets.
Otherwise the validated original is used. The key is used only on the server.

## Exam tools, progress and data

- **Exam screen:** a BA II Plus-style calculator (chain arithmetic, STO/RCL, 2nd functions, TVM keys
  with CPT, BGN, P/Y and C/Y, cash-flow NPV/IRR and AMORT worksheets; `lib/calculator/`, unit-tested
  against handheld results) beside the working pad; keyboard shortcuts (A–E answer, ← / → move,
  F flag, 1–5 confidence, ? help); a Prometric-style review screen (review all, flagged or
  unanswered before ending); a wall-clock timer that keeps running in another tab; confidence is
  optional in timed exams and required only where the diagnostic analyses it.
- **Home and Progress:** Home shows readiness, key numbers, sessions in progress, the score trend
  and recent sessions; `/progress` has Overview (trend against the pass mark, readiness range),
  Mastery, Concepts, Question formats and a paginated History with backup, restore and reset.
  Reports open with a summary: score against the pass mark, the three things to look at, and next
  steps.
- **Speed:** history analytics are computed once per history version and stored (memory and the
  `Snapshot` table); question payloads are parsed once per run. Exams and the dashboard no longer
  re-read every answered question.
- **API:** every route validates its body with shared zod schemas (`lib/api/schemas.ts`) and returns
  400 / 404 / 409 / 500 correctly; reading a session never changes it.
- **Backup:** `GET /api/backup` downloads everything as JSON; restoring (`POST /api/backup`) first
  saves the current history next to the database.
- **Server:** the desktop app listens on 127.0.0.1 only.

## Continuous integration

`.github/workflows/ci.yml` runs typecheck, lint, unit tests and the SymPy check on every push, then
the Playwright browser tests (`npm run test:e2e`): visual snapshots of the main pages in light and
dark mode, a WCAG AA contrast sweep over every visible text element, the theme toggle, the exam
flow and API status codes. Browser tests build into `.next-e2e` and use a temporary database.
Snapshots are kept per platform; run the **Update visual baselines** workflow (or
`npm run test:e2e:update` locally) after an intended design change.

## Design system

The interface follows Google's design language (Material 3 with Google Workspace surfaces and a
Gemini-style expressive accent, kept to roughly 90% calm surfaces and 10% expressive colour).

- **One source of truth:** `lib/theme/tokens.ts` defines every colour (light and dark), gradient,
  elevation, radius, motion curve and font stack as typed `as const` objects, with union types
  `ThemeMode`, `SurfaceVariant`, `ButtonVariant` and `AccentTone`.
- `tailwind.config.ts` imports the tokens and emits them as CSS custom properties (`--g-*` and the
  HSL channels behind the Tailwind colour names). `app/globals.css` contains no colour values.
- Fonts are self-hosted (`@fontsource`): Plus Jakarta Sans for display type, Inter for body text,
  Roboto as fallback — the desktop app builds and runs offline.
- Components: 40px pill buttons (`primary`, `tonal`, `outlined`, `ghost`, `danger`), tonal chips,
  16px cards that separate from the white canvas by tone rather than borders, 12px outlined fields
  with a Google-blue focus, 28px dialogs, icon-led pill navigation (lucide, stroke 1.75), Material 3
  emphasized easing, and `prefers-reduced-motion` respected.
- `scripts/tests/theme.test.ts` checks WCAG AA contrast for every text/surface pairing in both modes,
  that the stylesheet hard-codes no colours, and that every `text-*` colour class in use exists.

## Tests

```bash
npm test               # unit, bank, concept, session and persistence tests, then the SymPy check
npm run validate:bank  # stress-build every numerical template level (default 40 seeds: `validate:bank -- "" 150`)
npm run validate:choice  # stress-build every typed template × level × variant (`validate:choice -- con-alm 30`)
npm run report:calibration  # bank calibration and coverage report (`-- docs/calibration-report.md 3` to write it)
npm run test:migration # migrate a COPY of data/exam-fm.db and open every stored session and report
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
lib/engine/                finance maths, expression engine, misconceptions (+ misconceptions-extra/),
                           answers.ts (answer model), validators, calibration, style mix, assembly,
                           session builder, templates/ (numerical and composite bank),
                           concepts/ (Concept Practice bank and authoring kit)
lib/concepts/              concept registry used by concept chains and concept mastery
docs/                      authoring contract, difficulty rubric, calibration report
lib/analysis/              evidence, reasoning profile, report, mastery, formula mastery, remediation
lib/server/                SQLite (Prisma) repository
lib/llm/provider.ts        optional rewording, checked before use
app/                       dashboard, session, report, formulas, lab pages and API routes
reference_material/        the two formula sheets (PDF)
components/                exam runner, report, formula library and chain views, visualisations, lab
scripts/                   tests, SymPy validator, desktop launcher
```

To update the syllabus when the SOA publishes a new one, edit `lib/syllabus.ts`.
