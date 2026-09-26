"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** Tailwind class applied to the filled indicator, e.g. `bg-success`. */
  indicatorClassName?: string;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-white/[0.08]", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        // The fill is driven by translateX, so only `transform` needs to animate.
        "h-full w-full flex-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-transform duration-300 ease-out shadow-[0_0_12px_rgba(59,130,246,0.3)]",
        indicatorClassName
      )}
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
