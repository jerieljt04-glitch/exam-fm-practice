"use client";

import React, { useEffect, useState } from "react";

/**
 * A date in the viewer's own locale and time zone. The server renders a
 * stable ISO form and the browser replaces it after mounting, so server and
 * client markup always match (formatting with toLocaleString during render
 * caused hydration mismatches when the two locales differ).
 */
export function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => setText(new Date(iso).toLocaleString()), [iso]);
  return <time dateTime={iso}>{text ?? `${iso.slice(0, 16).replace("T", " ")} UTC`}</time>;
}
