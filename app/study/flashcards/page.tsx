import { Flashcards } from "@/components/study/Flashcards";
import { cardStates } from "@/lib/server/study";

export const dynamic = "force-dynamic";

export default async function FlashcardsPage({ searchParams }: { searchParams: { deck?: string } }) {
  const states = await cardStates();
  const deck = searchParams.deck === "concepts" ? "concepts" : "formulas";
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <div>
        <a href="/study" className="text-xs text-primary hover:underline">
          ← Study
        </a>
        <h1 className="text-2xl font-semibold tracking-tight">Flashcards</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Every formula from the two reference sheets in both directions — recall it from its name, and recognise it from its form — plus every concept the question bank tests.
          Rate each card honestly; cards you find hard come back sooner, cards you know drift weeks apart. Keys: <kbd>space</kbd> to flip, <kbd>1</kbd>–<kbd>4</kbd> to rate.
        </p>
      </div>
      <Flashcards initialStates={states} initialDeck={deck} />
    </main>
  );
}
