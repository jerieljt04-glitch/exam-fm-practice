import type { Metadata, Viewport } from "next";

import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Exam FM Practice",
  description:
    "A timed, 30-question computer-based practice exam for SOA Exam FM (Financial Mathematics), with parameterized questions, error-driven distractors, a pause/resume engine and full KaTeX solutions.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080c15",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full dark">
      <body className="relative min-h-full bg-[#080c15] font-sans text-foreground antialiased selection:bg-blue-500/30 selection:text-white">
        {/* Ambient atmospheric background.
            Painted as a single static gradient layer instead of four 600px
            elements with 140px blur filters: the visual result is nearly
            identical, but the browser no longer has to rasterise and hold
            four enormous filtered layers. */}
        <div className="ambient-backdrop pointer-events-none fixed inset-0 -z-10" aria-hidden="true" />

        {children}
      </body>
    </html>
  );
}
