import { ConceptStudy } from "@/components/study/ConceptStudy";
import { missedItems } from "@/lib/server/study";

export const dynamic = "force-dynamic";

export default async function ConceptStudyPage({ searchParams }: { searchParams: { tab?: string } }) {
  const missed = await missedItems("QUICK_CHECK");
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <div>
        <a href="/study" className="text-xs text-primary hover:underline">
          ← Study
        </a>
        <h1 className="text-2xl font-semibold tracking-tight">Concept practice with instant feedback</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Practice aimed at understanding rather than calculation: what a formula means, when it applies, how quantities move together, and why tempting answers are wrong.
        </p>
      </div>
      <ConceptStudy missedChecks={missed} initialTab={searchParams.tab === "questions" ? "questions" : "checks"} />
    </main>
  );
}
