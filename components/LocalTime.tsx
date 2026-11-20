"use client";

import React, { useEffect, useState } from "react";

const FORMATS: Record<"datetime" | "date" | "relative", Intl.DateTimeFormatOptions | null> = {
  datetime: { dateStyle: "medium", timeStyle: "short" },
  date: { dateStyle: "medium" },
  relative: null,
};

function relative(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secs] of steps) if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  return rtf.format(Math.round(diff), "second");
}

/**
 * A date in the viewer's own locale and time zone. The server renders a
 * stable ISO form and the browser replaces it after mounting, so server and
 * client markup always match and times are never shown in the server's zone.
 */
export function LocalTime({ iso, format = "datetime" }: { iso: string; format?: "datetime" | "date" | "relative" }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const options = FORMATS[format];
    setText(options ? new Intl.DateTimeFormat(undefined, options).format(new Date(iso)) : relative(iso));
  }, [iso, format]);
  return (
    <time dateTime={iso} title={new Date(iso).toISOString()} suppressHydrationWarning>
      {text ?? iso.slice(0, format === "date" ? 10 : 16).replace("T", " ")}
    </time>
  );
}
