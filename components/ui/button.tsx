"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/30 hover:brightness-110 hover:shadow-blue-500/40 hover:-translate-y-0.5",
        destructive:
          "bg-destructive/85 text-destructive-foreground shadow-lg shadow-red-500/20 border border-destructive/40 hover:bg-destructive hover:shadow-red-500/35 hover:-translate-y-0.5",
        success:
          "bg-success/90 text-success-foreground shadow-lg shadow-emerald-500/20 border border-success/40 hover:bg-success hover:shadow-emerald-500/35 hover:-translate-y-0.5",
        outline:
          "border border-white/10 bg-white/[0.04] text-slate-200 shadow-sm hover:bg-white/[0.09] hover:border-white/20 hover:text-white hover:-translate-y-0.5",
        secondary:
          "border border-white/10 bg-slate-800/80 text-slate-100 shadow-sm hover:bg-slate-700/85 hover:border-white/20 hover:text-white hover:-translate-y-0.5",
        ghost:
          "text-slate-300 hover:bg-white/[0.06] hover:text-white",
        link: "text-blue-400 underline-offset-4 hover:underline hover:text-blue-300",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-7 text-base font-bold",
        icon: "h-9 w-9 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
