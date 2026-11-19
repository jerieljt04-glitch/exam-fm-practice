"use client";

import React from "react";

import { MathRenderer } from "@/components/MathRenderer";
import { plainText, type Exhibit } from "@/lib/engine/answers";
import { cn } from "@/lib/utils";

export interface ExhibitsProps {
  exhibits?: Exhibit[];
  className?: string;
}

function TableExhibit({ exhibit, index }: { exhibit: Extract<Exhibit, { type: "table" }>; index: number }) {
  // A first column of labels (years, bonds, payments) reads as row headers.
  const rowHeaders = exhibit.columns.length > 1;
  const label = exhibit.caption ? undefined : `Table ${index + 1}`;
  return (
    <div className="max-w-full overflow-x-auto rounded-md border outline-none scrollbar-slim focus-visible:ring-2 focus-visible:ring-ring" role="region" aria-label={exhibit.caption ? plainText(exhibit.caption) : label} tabIndex={0}>
      <table className="w-full text-sm tabular-nums">
        <caption className={cn("px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground", !exhibit.caption && "sr-only")}>
          {exhibit.caption ? <MathRenderer content={exhibit.caption} /> : label}
        </caption>
        <thead className="bg-muted/60">
          <tr>
            {exhibit.columns.map((c, idx) => (
              <th key={idx} scope="col" className="border-b px-3 py-1.5 text-left font-semibold">
                <MathRenderer content={c} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {exhibit.rows.map((row, r) => (
            <tr key={r} className="border-b last:border-b-0">
              {row.map((cell, c) =>
                c === 0 && rowHeaders ? (
                  <th key={c} scope="row" className="px-3 py-1 text-left font-medium">
                    <MathRenderer content={cell} />
                  </th>
                ) : (
                  <td key={c} className="px-3 py-1">
                    <MathRenderer content={cell} />
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatementsExhibit({ exhibit }: { exhibit: Extract<Exhibit, { type: "statements" }> }) {
  return (
    // role="list" keeps list semantics in Safari, which drops them when list-style is none.
    <ol role="list" className="list-none space-y-1.5 rounded-md border px-3 py-2.5" aria-label="Statements">
      {exhibit.items.map((item) => (
        <li key={item.key} className="flex gap-2">
          <span className="w-8 shrink-0 font-semibold">{item.key}.</span>
          <MathRenderer content={item.text} className="min-w-0 flex-1 text-[15px]" />
        </li>
      ))}
    </ol>
  );
}

/** Tables and numbered statements (I, II, III) presented with a question. */
export function Exhibits({ exhibits, className }: ExhibitsProps) {
  if (!exhibits?.length) return null;
  let tables = 0;
  return (
    <div className={cn("space-y-3", className)}>
      {exhibits.map((exhibit, idx) =>
        exhibit.type === "table" ? <TableExhibit key={idx} exhibit={exhibit} index={tables++} /> : <StatementsExhibit key={idx} exhibit={exhibit} />
      )}
    </div>
  );
}
