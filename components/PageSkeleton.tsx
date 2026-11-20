/** Placeholder shown while a page's data loads: soft tonal blocks with a gentle pulse. */
export function PageSkeleton({ label = "Loading…", blocks = 3 }: { label?: string; blocks?: number }) {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="h-10 w-72 animate-pulse rounded-pill bg-surface-alt" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded-pill bg-surface-alt" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: blocks }, (_, k) => (
          <div key={k} className="h-48 animate-pulse rounded-card bg-surface" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-card bg-surface" />
    </main>
  );
}
