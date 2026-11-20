"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import type { ThemeMode } from "@/lib/theme/tokens";

export type ThemePreference = ThemeMode | "system";
export const THEME_STORAGE_KEY = "exam-fm-theme";

const NEXT: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };
const ICON: Record<ThemePreference, LucideIcon> = { system: Monitor, light: Sun, dark: Moon };
const LABEL: Record<ThemePreference, string> = { system: "Theme: follow the system", light: "Theme: light", dark: "Theme: dark" };

function apply(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
}

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Cycles system → light → dark. The choice is remembered on this device. */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference>("system");
  useEffect(() => setPref(read()), []);
  const Icon = ICON[pref];
  return (
    <button
      type="button"
      onClick={() => {
        const next = NEXT[pref];
        setPref(next);
        apply(next);
        try {
          if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
          else localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // Storage unavailable (private mode): the choice lasts for this page only.
        }
      }}
      aria-label={`${LABEL[pref]}. Click to change.`}
      title={LABEL[pref]}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-pill text-muted-foreground hover:bg-primary/[0.08] hover:text-foreground"
    >
      <Icon aria-hidden size={18} strokeWidth={1.75} />
    </button>
  );
}

/** Runs before first paint (inlined in <head>) so a saved theme never flashes the other one. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
