"use client";

import React, { useMemo } from "react";
import { InlineMath, BlockMath } from "react-katex";

import { cn } from "@/lib/utils";
import { normalizePlainMathText, parseMarkup, type Emphasis } from "@/lib/math/markup";

interface MathRendererProps {
  /** Authored markup — see `lib/math/markup.ts` for the supported dialect. */
  content: string;
  className?: string;
}

function MathError({ expression }: { expression: string }) {
  return (
    <span className="katex-error" title="This expression could not be typeset">
      {expression}
    </span>
  );
}

/** Wraps a node in whichever emphasis was active at that point in the markup. */
function withEmphasis(child: React.ReactNode, emphasis: Emphasis, key: string): React.ReactNode {
  let wrapped = child;
  if (emphasis.code) {
    wrapped = (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{wrapped}</code>
    );
  }
  if (emphasis.em) {
    wrapped = <em className="italic">{wrapped}</em>;
  }
  if (emphasis.strong) {
    wrapped = <strong className="font-semibold">{wrapped}</strong>;
  }
  return <React.Fragment key={key}>{wrapped}</React.Fragment>;
}

/**
 * Renders exam prose with embedded KaTeX.
 *
 * Content is parsed into typed nodes and rendered as React elements — nothing
 * is injected as raw HTML, so question text loaded from the database cannot
 * inject markup into the exam interface.
 */
const MathRendererImpl: React.FC<MathRendererProps> = ({ content, className }) => {
  const nodes = useMemo(() => (content ? parseMarkup(content) : []), [content]);

  return (
    <div className={cn("katex-content select-text", className)}>
      {nodes.map((node, index) => {
        const key = `node-${index}`;

        switch (node.type) {
          case "break":
            // Two source newlines mark a paragraph boundary. Render that as a
            // controlled block gap instead of two browser-dependent <br>s.
            if (nodes[index - 1]?.type === "break") return null;
            if (nodes[index + 1]?.type === "break") {
              return <span key={key} className="katex-paragraph-break" aria-hidden="true" />;
            }
            return <br key={key} />;

          case "display":
            return (
              <div key={key} className="math-display-frame scrollbar-slim text-center">
                <BlockMath
                  math={node.value}
                  renderError={() => <MathError expression={node.value} />}
                />
              </div>
            );

          case "inline":
            return withEmphasis(
              <InlineMath math={node.value} renderError={() => <MathError expression={node.value} />} />,
              node,
              key
            );

          default:
            return withEmphasis(normalizePlainMathText(node.value), node, key);
        }
      })}
    </div>
  );
};

/**
 * Memoised so that a parent re-render with unchanged `content` and `className`
 * skips the whole parse-and-typeset pass. This matters a great deal in the exam
 * runner, where the countdown clock re-renders its parent once per second: the
 * question stem and every answer choice would otherwise be re-parsed and
 * re-typeset by KaTeX on each tick.
 */
export const MathRenderer = React.memo(MathRendererImpl);

MathRenderer.displayName = "MathRenderer";

export default MathRenderer;
