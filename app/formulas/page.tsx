import { FormulaLibrary } from "@/components/formulas/FormulaLibrary";
import { Panel } from "@/components/ui";
import { formulaMastery, DIMENSION_LABELS, FORMULA_DIMENSIONS } from "@/lib/analysis/formulas";
import { NAMED_CHAINS } from "@/lib/formulas/graph";
import { FORMULAS, FORMULA_BY_ID } from "@/lib/formulas/registry";
import { SOURCE_FILES, SOURCE_LABELS } from "@/lib/formulas/types";
import { attemptHistory } from "@/lib/server/repository";
import { pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  MASTERED: "text-success",
  SECURE: "text-primary",
  DEVELOPING: "text-warning",
  WEAK: "text-destructive",
  NOT_TESTED: "text-muted-foreground",
};

export default async function FormulasPage() {
  const history = await attemptHistory();
  const { formulas, combinations } = formulaMastery(history);
  const tested = formulas.filter((f) => f.status !== "NOT_TESTED").sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name));
  const discrepancies = FORMULAS.filter((f) => f.discrepancy).length;
  const unclear = FORMULAS.filter((f) => f.relevance === "unclear").length;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-[30px] font-semibold sm:text-[32px]">Formula library</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {FORMULAS.length} formulas extracted from the two reference sheets, each with the sheets’ own notation and page, its assumptions, common misuse and the syllabus outcomes it serves. {discrepancies} entries are flagged where the sheets
          differ; {unclear} are on a sheet but of unclear relevance to the current syllabus and are never required by the question bank.
        </p>
        <ul className="mt-2 text-xs text-muted-foreground">
          {(["TIA", "ACTEX"] as const).map((doc) => (
            <li key={doc}>
              {doc}: {SOURCE_LABELS[doc]} — <code>{SOURCE_FILES[doc]}</code>
            </li>
          ))}
        </ul>
      </div>

      <Panel title="How formulas connect">
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {NAMED_CHAINS.map((chain) => (
            <div key={chain.id} className="rounded-lg border p-3 text-sm">
              <div className="mb-2 font-semibold">{chain.name}</div>
              <ol className="space-y-1">
                {chain.steps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{idx + 1}</span>
                    <span>
                      {step.label}
                      {step.formula && (
                        <a href={`#f-${step.formula}`} className="ml-1 text-xs text-primary hover:underline">
                          {FORMULA_BY_ID[step.formula]?.name}
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Your formula mastery">
        <div className="space-y-4 p-4 text-sm">
          {tested.length === 0 ? (
            <p className="text-muted-foreground">No evidence yet. Formula mastery is read from the formula chains of the questions you answer; it needs combined and unfamiliar uses, not just reproduction.</p>
          ) : (
            <div className="overflow-x-auto scrollbar-slim">
              <table className="w-full min-w-[640px] text-left">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1">Formula</th>
                    <th>Status</th>
                    <th>Successful uses</th>
                    <th>Presentations</th>
                    <th>Weakest dimension</th>
                    <th>What would change it</th>
                  </tr>
                </thead>
                <tbody>
                  {tested.map((f) => {
                    const weakest = FORMULA_DIMENSIONS.filter((d) => f.dimensions[d].fail > 0).sort((a, b) => f.dimensions[b].fail - f.dimensions[a].fail)[0];
                    return (
                      <tr key={f.formula} className="border-t align-top">
                        <td className="py-1.5">
                          <a href={`#f-${f.formula}`} className="hover:underline">
                            {f.name}
                          </a>
                        </td>
                        <td className={STATUS_TONE[f.status]}>{f.status.replace("_", " ").toLowerCase()}</td>
                        <td className="tabular-nums">
                          {f.passes} / {f.passes + f.fails}
                        </td>
                        <td className="tabular-nums">{f.templates}</td>
                        <td className="text-xs">{weakest ? DIMENSION_LABELS[weakest] : "—"}</td>
                        <td className="text-xs text-muted-foreground">{f.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {combinations.length > 0 && (
            <div>
              <div className="eyebrow mb-1">Formula combinations practised</div>
              <ul className="grid gap-1 md:grid-cols-2">
                {combinations.slice(0, 16).map((c) => (
                  <li key={`${c.from}-${c.to}`} className="flex justify-between gap-3 rounded-md bg-muted/50 px-2 py-1 text-xs">
                    <span>{c.label}</span>
                    <span className="tabular-nums text-muted-foreground">{c.attempts ? `${c.success}/${c.attempts} · ${pct(c.success, c.attempts)}` : "no evidence"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="All formulas">
        <div className="p-4">
          <FormulaLibrary />
        </div>
      </Panel>
    </main>
  );
}
