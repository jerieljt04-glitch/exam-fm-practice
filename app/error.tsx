"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui";

/** Shown when a page fails to render. Answers already autosaved are safe; retrying re-runs the page. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center" role="alert">
      <span className="mb-6 flex h-14 w-14 items-center justify-center rounded-card bg-destructive-container text-destructive">
        <TriangleAlert aria-hidden size={28} strokeWidth={1.75} />
      </span>
      <h1 className="font-display text-[32px] font-semibold">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">
        This page could not be displayed. Anything you had answered was autosaved, so trying again is safe.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className="inline-flex h-10 items-center rounded-pill border px-6 text-sm font-medium text-primary hover:bg-primary/[0.08]">
          Go to the dashboard
        </Link>
      </div>
    </main>
  );
}
