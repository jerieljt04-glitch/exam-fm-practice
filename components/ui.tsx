"use client";

import React, { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import type { AccentTone, ButtonVariant } from "@/lib/theme/tokens";

export type { ButtonVariant };

/**
 * Buttons. `primary` (filled Google blue), `tonal` (blue container), `outlined`
 * (hairline, blue label), `ghost` (text button with an 8% state layer) and
 * `danger`. All are 40px pills with Material 3 emphasized motion.
 */
const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-resting active:shadow-none",
  tonal: "bg-primary-container text-primary-on-container hover:shadow-resting active:brightness-95",
  outlined: "border border-border bg-transparent text-primary hover:bg-primary/[0.08] active:bg-primary/[0.12]",
  ghost: "bg-transparent text-primary hover:bg-primary/[0.08] active:bg-primary/[0.12]",
  danger: "bg-destructive-ink text-destructive-foreground hover:shadow-resting active:brightness-95",
};

const BUTTON_SIZES = { sm: "h-8 px-4 text-[13px]", md: "h-10 px-6 text-sm", lg: "h-12 px-7 text-[15px]" } as const;
export type ButtonSize = keyof typeof BUTTON_SIZES;

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-pill font-medium tracking-[0.01em] duration-medium ease-emphasized focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-40",
        BUTTON_SIZES[size],
        BUTTON_STYLES[variant],
        className
      )}
      {...props}
    />
  );
}

/** Older tone names used across the app, kept as aliases of the accent tones. */
type LegacyTone = "good" | "warn" | "bad" | "info";
export type Tone = AccentTone | LegacyTone;

const TONE_OF: Record<Tone, AccentTone> = {
  neutral: "neutral",
  primary: "primary",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "primary",
  good: "success",
  warn: "warning",
  bad: "danger",
};

/** Tonal chips: a container colour with its readable on-container ink. */
const CHIP: Record<AccentTone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  primary: "bg-primary-container text-primary-on-container",
  success: "bg-success-container text-success",
  warning: "bg-warning-container text-warning",
  danger: "bg-destructive-container text-destructive",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium", CHIP[TONE_OF[tone]], className)}>{children}</span>;
}

/** A card: tonal surface on the canvas, 16px corners, generous padding. */
export function Panel({ title, action, className, children }: { title?: React.ReactNode; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("panel", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-6 pt-5">
          <h2 className="text-base font-medium">{title}</h2>
          {action}
        </div>
      )}
      <div className="px-6 pb-6 pt-4">{children}</div>
    </section>
  );
}

/** A horizontal bar showing a proportion; label text carries the value so colour is never the only signal. */
export function Meter({ value, tone = "info", className }: { value: number | null; tone?: Tone; className?: string }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  const fill: Record<AccentTone, string> = { neutral: "bg-muted-foreground", primary: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-destructive" };
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-pill bg-secondary", className)} role="presentation">
      <div className={cn("h-full rounded-pill duration-slow ease-emphasized", fill[TONE_OF[tone]])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: string }>; value: T; onChange: (id: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === value}
          onClick={() => onChange(tab.id)}
          className={cn(
            "-mb-px rounded-t-sm border-b-[3px] px-4 py-2.5 text-sm font-medium",
            tab.id === value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:bg-primary/[0.08] hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="w-[min(560px,calc(100vw-2rem))] animate-fade-in rounded-dialog border-0 bg-elevated p-0 text-foreground shadow-raised backdrop:bg-black/40"
    >
      <div className="px-6 pt-6">
        <h2 className="text-2xl font-medium">{title}</h2>
      </div>
      <div className="px-6 py-4 text-sm text-muted-foreground">{children}</div>
      {footer && <div className="flex justify-end gap-2 px-6 pb-5">{footer}</div>}
    </dialog>
  );
}
