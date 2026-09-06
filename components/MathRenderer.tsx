"use client";

import React, { useMemo } from "react";
import { InlineMath, BlockMath } from "react-katex";

import { cn } from "@/lib/utils";
import { parseMarkup, type Emphasis } from "@/lib/math/markup";

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
export const MathRenderer: React.FC<MathRendererProps> = ({ content, className }) => {
  const nodes = useMemo(() => (content ? parseMarkup(content) : []), [content]);

  return (
    <div className={cn("katex-content select-text", className)}>
      {nodes.map((node, index) => {
        const key = `node-${index}`;

        switch (node.type) {
          case "break":
            return <br key={key} />;

          case "display":
            return (
              <div key={key} className="scrollbar-slim my-3 overflow-x-auto py-1 text-center">
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
            return withEmphasis(node.value, node, key);
        }
      })}
    </div>
  );
};

export default MathRenderer;
