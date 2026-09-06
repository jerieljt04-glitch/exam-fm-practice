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
      // Step 1: Render Display Math blocks: $$...$$
      let processed = content.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
        try {
          return `<div class="my-3 overflow-x-auto py-1 text-center">${katex.renderToString(math.trim(), {
            displayMode: true,
            throwOnError: false,
          })}</div>`;
        } catch (e) {
          return `<div class="text-red-500 font-mono text-sm">${math}</div>`;
        }
      });

      // Step 2: Render Inline Math: $...$
      // We avoid matching escaped \$
      processed = processed.replace(/(?<!\\)\$([^\$\n]+?)\$/g, (_, math) => {
        try {
          return `<span class="inline-block px-0.5">${katex.renderToString(math.trim(), {
            displayMode: false,
            throwOnError: false,
          })}</span>`;
        } catch (e) {
          return `<span class="text-red-500 font-mono text-sm">${math}</span>`;
        }
      });

      // Step 3: Simple Markdown formatting: bold **text**, italics *text*, and line breaks
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
