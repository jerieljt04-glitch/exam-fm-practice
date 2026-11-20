import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-card bg-primary-container text-primary-on-container">
        <Compass aria-hidden size={28} strokeWidth={1.75} />
      </span>
      <h1 className="font-display text-[32px] font-semibold">Page not found</h1>
      <p className="mt-3 text-muted-foreground">
        That page or session does not exist. It may have been removed when history was reset, or the link is incomplete.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="inline-flex h-10 items-center rounded-pill bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
          Go to the dashboard
        </Link>
        <Link href="/progress" className="inline-flex h-10 items-center rounded-pill border px-6 text-sm font-medium text-primary hover:bg-primary/[0.08]">
          Session history
        </Link>
      </div>
    </main>
  );
}
