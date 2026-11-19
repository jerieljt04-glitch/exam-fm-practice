import type { Metadata, Viewport } from "next";
import Link from "next/link";

// Self-hosted fonts (bundled at build time, so the desktop app works offline):
// Plus Jakarta Sans for display type, Inter for body, Roboto as the fallback.
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/roboto/400.css";
import "katex/dist/katex.min.css";
import "./globals.css";

import { NavBar } from "@/components/NavBar";

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
        <header className="sticky top-0 z-40 bg-background/90 shadow-[0_1px_0_0_hsl(var(--border))] backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/" className="group flex shrink-0 items-center gap-3 rounded-pill pr-2">
              <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-expressive font-display text-sm font-bold text-white shadow-resting">
                FM
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-display text-[17px] font-semibold tracking-[-0.01em] text-foreground">Exam FM Practice</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">Diagnostic &amp; challenge simulator</span>
              </span>
            </Link>
            <NavBar />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
