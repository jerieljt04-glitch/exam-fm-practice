import Link from "next/link";

import { cn } from "@/lib/utils";

/** Tabs that are links (?tab=…), so each tab is shareable and works without client code. */
export function LinkTabs<T extends string>({ tabs, active, base }: { tabs: ReadonlyArray<{ id: T; label: string }>; active: T; base: string }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b" aria-label="Sections">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={`${base}?tab=${tab.id}`}
          aria-current={tab.id === active ? "page" : undefined}
          className={cn(
            "-mb-px rounded-t-sm border-b-[3px] px-4 py-2.5 text-sm font-medium",
            tab.id === active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:bg-primary/[0.08] hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
