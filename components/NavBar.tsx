"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenCheck, FlaskConical, House, Sigma, TrendingUp, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}

const LINKS: readonly NavLink[] = [
  { href: "/", label: "Home", icon: House, match: (p) => p === "/" || (p.startsWith("/session") && !p.endsWith("/report")) },
  { href: "/progress", label: "Progress", icon: TrendingUp, match: (p) => p.startsWith("/progress") || p.endsWith("/report") },
  { href: "/study", label: "Study", icon: BookOpenCheck, match: (p) => p.startsWith("/study") },
  { href: "/formulas", label: "Formulas", icon: Sigma, match: (p) => p.startsWith("/formulas") },
  { href: "/lab", label: "Visual lab", icon: FlaskConical, match: (p) => p.startsWith("/lab") },
];

/** Icon-led navigation; the current section carries a pill-shaped tonal indicator. */
export function NavBar() {
  const path = usePathname() ?? "/";
  return (
    <nav className="flex items-center gap-1 overflow-x-auto text-sm" aria-label="Main">
      {LINKS.map(({ href, label, icon: Icon, match }) => {
        const active = match(path);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap rounded-pill px-4 py-2 font-medium",
              active ? "bg-primary-container text-primary-on-container" : "text-muted-foreground hover:bg-primary/[0.08] hover:text-foreground"
            )}
          >
            <Icon aria-hidden size={18} strokeWidth={1.75} />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
