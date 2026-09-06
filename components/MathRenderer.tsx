"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface MathRendererProps {
  content: string;
  className?: string;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = "" }) => {
  const renderedHtml = useMemo(() => {
    if (!content) return "";

    try {
      const displayMathBlocks: string[] = [];
      const inlineMathBlocks: string[] = [];
      const currencyBlocks: string[] = [];

      // 1. Extract Display Math: $$...$$
      let processed = content.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
        const idx = displayMathBlocks.length;
        displayMathBlocks.push(math.trim());
        return `___DISPLAY_MATH_${idx}___`;
      });

      // 2. Extract Currency amounts: e.g. $1,010.00, \$1,010.00, $500, \$50.25
      // Ensures that currency numbers do not match as LaTeX delimiters
      processed = processed.replace(
        /(?:\\+\$|\$)(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?(?![a-zA-Z\^\+\-\*\/(=_])/g,
        (match) => {
          const idx = currencyBlocks.length;
          // Clean currency string to always start with single $
          const cleanCurrency = match.replace(/^\\+\$/, "$");
          currencyBlocks.push(cleanCurrency);
          return `___CURRENCY_${idx}___`;
        }
      );

      // 3. Normalize any remaining escaped dollar signs (e.g. \$ -> $)
      processed = processed.replace(/\\+\$/g, "$");

      // 4. Normalize escaped percentage signs outside of math (e.g. \% -> %)
      processed = processed.replace(/\\+%/g, "%");

      // 5. Extract genuine Inline Math blocks: $...$
      processed = processed.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
        const idx = inlineMathBlocks.length;
        inlineMathBlocks.push(math.trim());
        return `___INLINE_MATH_${idx}___`;
      });

      // 6. Render Display Math blocks with KaTeX
      processed = processed.replace(/___DISPLAY_MATH_(\d+)___/g, (_, idx) => {
        const raw = displayMathBlocks[Number(idx)];
        try {
          return `<div class="my-3 overflow-x-auto py-1 text-center">${katex.renderToString(raw, {
            displayMode: true,
            throwOnError: false,
          })}</div>`;
        } catch {
          return `<div class="text-red-500 font-mono text-sm">${raw}</div>`;
        }
      });

      // 7. Render Inline Math blocks with KaTeX
      processed = processed.replace(/___INLINE_MATH_(\d+)___/g, (_, idx) => {
        const raw = inlineMathBlocks[Number(idx)];
        try {
          return `<span class="inline-block px-0.5">${katex.renderToString(raw, {
            displayMode: false,
            throwOnError: false,
          })}</span>`;
        } catch {
          return `<span class="text-red-500 font-mono text-sm">${raw}</span>`;
        }
      });

      // 8. Restore Currency placeholders
      processed = processed.replace(/___CURRENCY_(\d+)___/g, (_, idx) => {
        return currencyBlocks[Number(idx)];
      });

      // 9. Markdown formatting: bold **text**, italics *text*, and line breaks
      processed = processed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      processed = processed.replace(/\n\n/g, '<div class="h-3"></div>');
      processed = processed.replace(/\n/g, "<br />");

      return processed;
    } catch (err) {
      console.error("MathRenderer processing error:", err);
      return content;
    }
  }, [content]);

  return (
    <div
      className={`katex-content leading-relaxed select-text ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
export default MathRenderer;
