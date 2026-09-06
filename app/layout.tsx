import type { Metadata } from "next";
import "katex/dist/katex.min.css";
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
    <html lang="en" className="h-full bg-slate-900">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full bg-slate-900 text-slate-100 font-sans antialiased flex flex-col selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
