import type { Metadata, Viewport } from "next";

import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Exam FM Practice Platform",
  description:
    "A timed, 30-question computer-based practice exam for SOA Exam FM (Financial Mathematics), with parameterized questions, error-driven distractors, a pause/resume engine and full KaTeX solutions.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
