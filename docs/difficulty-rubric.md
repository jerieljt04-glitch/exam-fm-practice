# Difficulty rubric (structural)

The bank's three levels are defined by **structure**, not by a guess at how
hard an item "feels". The rubric was written from the structure of the SOA's
published Exam FM sample questions and syllabus — how many reasoning steps a
typical item needs, how many formulas or concepts it connects, how it is
presented — without copying any of their content. It is not an official SOA
classification, and it is not a psychometric estimate: no candidate data was
used. `lib/engine/calibration.ts` implements it; `npm run report:calibration`
applies it to the whole bank; the test suite enforces it.

## What is recorded for every question

| Field | Basis | How |
| --- | --- | --- |
| Stem length | measured | words in the stem and its exhibits |
| Reasoning steps | measured | the larger of the template's step count and the length of its formula chain or concept chain |
| Connected formulas | measured | distinct formula ids in the formula chain |
| Connected concepts | measured | distinct concept ids in the concept chain |
| Inverse | measured | presentation tags `inverse`, `work-backwards`, `unknown-rate`, `unknown-time`, `rearrange-first` |
| Multiple valuation dates | measured | feature flag or tags `valuation-date`, `mixed-timing` |
| Unfamiliar | measured | feature flag or tags `hidden-structure`, `indirect-wording` |
| Multi-concept | measured | feature flag, tag `combined-topics`, or ≥ 3 concepts |
| Reconstruction | measured | a derived chain step, methods such as working backwards / simultaneous equations / elimination / equation construction, or tags `hidden-structure`, `multi-equation` |
| Answer type / class | measured | numerical, conceptual (text, statements), symbolic (math), composite (pairs, allocations, tables) |
| Modelling decisions | inferred | stated by the template, otherwise counted from decision-bearing presentation tags |
| Calculator burden | inferred | from formula count, chain length and heavy methods (root finding, simultaneous equations, series) |
| Expected time band | inferred | from steps + decisions + burden + stem length: under 3, 3–6, 6–9, over 9 minutes |

## Levels

| Level | Structural target |
| --- | --- |
| 1 — SOA standard | 1–3 reasoning steps (one step of tolerance), usually one or two formulas or concepts, familiar presentation, normal calculator burden |
| 2 — Advanced | 2–4 reasoning steps (one step of tolerance) and at least one of: inverse, unfamiliar, multiple valuation dates, multi-concept, reconstruction, or three or more connected formulas/concepts |
| 3 — Challenge | 3–6 reasoning steps, at least two connected formulas or concepts, and a non-obvious modelling or interpretation decision (a stated modelling decision, reconstruction, unfamiliar or inverse structure) — always inside the syllabus |

Challenge difficulty comes from reasoning — hidden structure, inverse problems,
reconstructed parameters, multiple valuation dates, mixed frequencies, changing
rate regimes, linked equations, interpretation after calculation, relevant-looking
but unnecessary information — never from stochastic models, contingencies,
later-exam material, tedious arithmetic or ambiguous wording.

## Enforcement

- Every Level-3 question built in the test suite must meet the Level-3 rubric.
- Every Level-1 question must meet the Level-1 rubric.
- Level-2 items are reported; the calibration report lists any that fall
  outside the Advanced target so they can be reviewed (at the time of writing
  the numerical `alm-duration` Level-2 variant — a direct bond-duration
  calculation — is flagged as structurally standard).

## Measured versus inferred

Everything in the "measured" rows is a count taken from the generated item.
Modelling decisions, calculator burden and time bands are rule-based
inferences from those counts. Neither says how a particular candidate will
find the question; the report's per-question timing (from your own sessions)
is the only observed time evidence.
