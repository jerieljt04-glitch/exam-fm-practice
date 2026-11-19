import type { Metadata, Viewport } from "next";
import Link from "next/link";

import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Exam FM Practice",
  description:
    "A diagnostic and challenge simulator for SOA Exam FM: unlabelled mixed questions, misconception-based answer choices, validated mathematics, layered visual explanations and adaptive remediation.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-base font-semibold tracking-tight">Exam FM Practice</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">diagnostic &amp; challenge simulator</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-accent">
                Dashboard
              </Link>
              <Link href="/study" className="rounded-md px-3 py-1.5 hover:bg-accent">
                Study
              </Link>
              <Link href="/formulas" className="rounded-md px-3 py-1.5 hover:bg-accent">
                Formulas
              </Link>
              <Link href="/lab" className="rounded-md px-3 py-1.5 hover:bg-accent">
                Visual lab
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
