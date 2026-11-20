"use client";

import { MathRenderer } from "@/components/MathRenderer";
import { CONCEPT_BY_ID } from "@/lib/concepts/registry";
import { FORMULA_BY_ID } from "@/lib/formulas/registry";
import { SOURCE_LABELS } from "@/lib/formulas/types";
import { type StudyCardDef } from "@/lib/study/cards";
import { OUTCOMES } from "@/lib/syllabus";

/** The front and back of formula and concept flashcards. */
function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="eyebrow mb-0.5">{title}</div>
      <ul className="list-disc space-y-0.5 pl-5">
        {items.map((item) => (
          <li key={item}>
            <MathRenderer content={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- card faces

export function FormulaFront({ card, showHint }: { card: StudyCardDef; showHint: boolean }) {
  const f = FORMULA_BY_ID[card.ref];
  if (card.kind === "recognise") {
    return (
      <div className="space-y-3 text-center">
        <div className="overflow-x-auto py-2 text-lg scrollbar-slim">
          <MathRenderer content={`$$${f.expression}$$`} />
        </div>
        <p className="text-sm text-muted-foreground">Name this formula. What does it compute, and when does it apply (or not)?</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 text-center">
      <h3 className="text-xl font-semibold">{f.name}</h3>
      <MathRenderer content={f.meaning} className="mx-auto max-w-xl text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Write the formula from memory, then flip.</p>
      {showHint && f.variables.length > 0 && (
        <div className="mx-auto max-w-xl rounded-md bg-muted/60 p-2 text-left text-xs">
          <div className="eyebrow mb-1">Hint: the symbols involved</div>
          <ul className="space-y-0.5">
            {f.variables.map((v) => (
              <li key={v.symbol}>
                <MathRenderer content={`$${v.symbol}$ — ${v.meaning}`} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function FormulaBack({ card }: { card: StudyCardDef }) {
  const f = FORMULA_BY_ID[card.ref];
  return (
    <div className="space-y-3 text-sm">
      {card.kind === "recognise" ? (
        <div className="text-center">
          <h3 className="text-xl font-semibold">{f.name}</h3>
          <MathRenderer content={f.meaning} className="mx-auto mt-1 max-w-xl text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md bg-primary/5 py-2 text-lg scrollbar-slim">
          <MathRenderer content={`$$${f.expression}$$`} />
        </div>
      )}
      {f.discrepancy && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
          <span className="font-semibold">The sheets differ: </span>
          <MathRenderer content={f.discrepancy} className="inline" />
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          {f.variables.length > 0 && (
            <div>
              <div className="eyebrow mb-0.5">Symbols</div>
              <ul className="space-y-0.5">
                {f.variables.map((v) => (
                  <li key={v.symbol}>
                    <MathRenderer content={`$${v.symbol}$ — ${v.meaning}`} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <List title="Assumptions" items={f.assumptions} />
          <List title="Applies when" items={f.conditions} />
          <List title="Common misuse" items={f.misuse} />
        </div>
        <div className="space-y-2">
          <div>
            <div className="eyebrow mb-0.5">Why it holds (memory hook)</div>
            <MathRenderer content={f.derivation} />
          </div>
          <List title="Used for" items={f.applications} />
          <div>
            <div className="eyebrow mb-0.5">On the formula sheets</div>
            <ul className="space-y-1">
              {f.sources.map((s, idx) => (
                <li key={idx} className="rounded-md bg-muted/50 px-2 py-1 text-xs">
                  <div className="text-muted-foreground">
                    {s.doc === "DERIVED" ? SOURCE_LABELS.DERIVED : `${s.doc} · PDF p.${s.page} · ${s.label} · ${s.section}`}
                  </div>
                  {s.doc !== "DERIVED" && (
                    <div className="overflow-x-auto scrollbar-slim">
                      <MathRenderer content={`$${s.notation}$`} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <a href={`/formulas#f-${f.id}`} className="inline-block text-xs text-primary hover:underline" target="_blank" rel="noreferrer">
        Full entry in the formula library ↗
      </a>
    </div>
  );
}

export function ConceptFront({ card }: { card: StudyCardDef }) {
  const c = CONCEPT_BY_ID[card.ref];
  return (
    <div className="space-y-3 text-center">
      <h3 className="text-xl font-semibold">{c.label}</h3>
      <p className="mx-auto max-w-xl text-sm text-muted-foreground">
        Explain this idea in your own words: what it means, when it applies, and the relationship behind it. Then flip.
      </p>
    </div>
  );
}

export function ConceptBack({ card }: { card: StudyCardDef }) {
  const c = CONCEPT_BY_ID[card.ref];
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-md bg-primary/5 p-3">
        <MathRenderer content={c.summary} className="text-[15px]" />
      </div>
      {c.confusable?.length ? (
        <div>
          <div className="eyebrow mb-1">Often confused with</div>
          <ul className="space-y-1.5">
            {c.confusable.map((id) => (
              <li key={id} className="rounded-md border p-2">
                <div className="font-medium">{CONCEPT_BY_ID[id]?.label ?? id}</div>
                {CONCEPT_BY_ID[id] && <MathRenderer content={CONCEPT_BY_ID[id].summary} className="text-muted-foreground" />}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <div className="eyebrow mb-0.5">Syllabus outcomes</div>
        <ul className="list-disc pl-5 text-muted-foreground">
          {c.outcomes.map((o) => (
            <li key={o}>{OUTCOMES[o]?.label ?? o}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the trainer
