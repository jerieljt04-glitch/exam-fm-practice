"use client";

import React from "react";
import { BlockMath } from "react-katex";

import { MathRenderer } from "@/components/MathRenderer";
import { statementsLabel, type OptionContent } from "@/lib/engine/answers";
import { formatAnswer } from "@/lib/engine/format";
import { cn } from "@/lib/utils";

export interface OptionContentViewProps {
  /** Typed content. Absent on options stored before the rich answer model: `display` is shown as a number. */
  content?: OptionContent;
  /** Plain-text form of the option (always present; the fallback for old numeric options). */
  display: string;
  /** Number of statements in the question, so a combination reads "I and III only" or "I, II, and III". */
  statementCount?: number;
  className?: string;
}

/** Display mathematics, left-aligned and horizontally scrollable so long equations never widen the page. */
function DisplayMath({ latex }: { latex: string }) {
  return (
    <div className="math-display-frame scrollbar-slim max-w-full [&_.katex-display>.katex]:text-left [&_.katex-display]:my-0">
      <BlockMath math={latex} renderError={() => <span className="katex-error font-mono text-sm">{latex}</span>} />
    </div>
  );
}

function ContentBody({ content, display, statementCount }: { content?: OptionContent; display: string; statementCount?: number }) {
  if (!content || content.type === "numeric") {
    return <span className="font-mono text-[15px] tabular-nums">{display}</span>;
  }
  switch (content.type) {
    case "text":
      return <MathRenderer content={content.text} className="text-[15px]" />;
    case "math":
      return <DisplayMath latex={content.latex} />;
    case "statements":
      return <span className="text-[15px] font-medium">{statementCount ? statementsLabel(content.keys, statementCount) : display}</span>;
    case "composite":
      if (content.style === "ordered-pair") {
        return <span className="font-mono text-[15px] tabular-nums">({content.parts.map((p) => formatAnswer(p.value, p.format)).join(", ")})</span>;
      }
      return (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[15px]">
          {content.parts.map((p, idx) => (
            <React.Fragment key={idx}>
              <dt className="min-w-0 text-muted-foreground">
                <MathRenderer content={p.label} />
              </dt>
              <dd className="font-mono tabular-nums">{formatAnswer(p.value, p.format)}</dd>
            </React.Fragment>
          ))}
        </dl>
      );
    case "table":
      return (
        <div className="max-w-full overflow-x-auto scrollbar-slim">
          <table className="text-sm tabular-nums">
            <thead>
              <tr>
                {content.columns.map((c, idx) => (
                  <th key={idx} scope="col" className="border-b px-2 py-1 text-left font-semibold">
                    <MathRenderer content={c} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.rows.map((row, r) => (
                <tr key={r} className="border-b last:border-b-0">
                  {row.map((cell, c) => (
                    <td key={c} className="px-2 py-0.5">
                      <MathRenderer content={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/**
 * Renders one answer choice of any type: a number, prose, an equation, a
 * statement combination, a composite answer or a small table. Old numeric
 * options (no `content`) render from `display` exactly as before.
 */
function OptionContentViewImpl({ content, display, statementCount, className }: OptionContentViewProps) {
  return (
    <div className={cn("min-w-0 break-words", className)}>
      <ContentBody content={content} display={display} statementCount={statementCount} />
    </div>
  );
}

/** Memoised: the exam runner re-renders once per second for the clock, and option content never changes. */
export const OptionContentView = React.memo(OptionContentViewImpl);
OptionContentView.displayName = "OptionContentView";

/** The number of numbered statements a question shows, for statement-combination labels. */
export function statementCountOf(exhibits: readonly { type: string; items?: readonly unknown[] }[] | undefined): number | undefined {
  const block = exhibits?.find((e) => e.type === "statements");
  return block?.items?.length || undefined;
}
