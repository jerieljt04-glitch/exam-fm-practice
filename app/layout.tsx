import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOA Exam FM Practice Platform | Actuarial Mathematics CBT",
  description:
    "Production-grade SOA Exam FM (Financial Mathematics) Computer-Based Testing Practice Platform with dynamic parameterization, actuarial distractor modeling, real-time pause/resume engine, and KaTeX solution derivations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        {children}
      </body>
    </html>
  );
}
