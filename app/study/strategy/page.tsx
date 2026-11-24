import { StrategyPractice } from "@/components/study/StrategyPractice";
import { missedItems } from "@/lib/server/study";
import { STRATEGY_QUESTIONS } from "@/lib/study/strategy";

export const dynamic = "force-dynamic";

export default async function StrategyPage() {
  const missed = await missedItems("STRATEGY");
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <div>
        <a href="/study" className="text-xs text-primary hover:underline">
          ← Study
        </a>
        <h1 className="font-display text-[30px] font-semibold sm:text-[32px]">Solution strategy: pick the plan, not the number</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {STRATEGY_QUESTIONS.length} exam-style problems where every answer choice is a way of solving it — which formula to reach for, what to do first, how to set up the
          equation of value, which trap to avoid. No calculating: train the instinct for the route, then see where the right plan leads and why each wrong one fails.
        </p>
      </div>
      <StrategyPractice missed={missed} />
    </main>
  );
}
