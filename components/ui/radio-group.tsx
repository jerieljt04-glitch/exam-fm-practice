"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-3", className)} {...props} />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

/**
 * Option row styled as a CBT answer choice: the whole card is the
 * radio control with frosted glass styling and smooth selection states.
 */
const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      // Answer choices are the most numerous interactive elements on the exam
      // screen, so they carry no backdrop-filter: the translucent fill and
      // border already read as glass against the static backdrop.
      "group relative flex w-full items-start gap-4 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-4 text-left shadow-sm transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200",
      "hover:border-blue-400/40 hover:bg-slate-800/60 hover:shadow-[0_4px_20px_rgba(59,130,246,0.12)] hover:-translate-y-0.5",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
      "data-[state=checked]:border-blue-500/80 data-[state=checked]:bg-blue-600/15 data-[state=checked]:shadow-[0_0_25px_rgba(59,130,246,0.22)]",
      "disabled:pointer-events-none disabled:opacity-60",
      className
    )}
    {...props}
  >
    {children}
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
