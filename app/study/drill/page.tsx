import { FormulaDrill } from "@/components/study/FormulaDrill";
import { missedItems } from "@/lib/server/study";
import { DRILL_ITEMS } from "@/lib/study/drill";

export const dynamic = "force-dynamic";

export default async function DrillPage() {
  const missed = await missedItems("DRILL");
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <div>
        <a href="/study" className="text-xs text-primary hover:underline">
          ← Study
        </a>
        <h1 className="text-2xl font-semibold tracking-tight">Formula drill: spot the right form</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {DRILL_ITEMS.length} formulas, each shown beside three near-misses of the kind memory really produces — i for d, n − t for n − t + 1, a for ä, a missing root.
          Every wrong form is checked numerically to be genuinely wrong, and says what it actually computes.
        </p>
      </div>
      <FormulaDrill missed={missed} />
    </main>
  );
}
