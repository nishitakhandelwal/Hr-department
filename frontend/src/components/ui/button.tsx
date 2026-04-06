/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-2xl text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:scale-[1.03] active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "border border-white/20 bg-[linear-gradient(135deg,var(--portal-primary-solid),var(--portal-primary-dark))] text-primary-foreground shadow-[0_18px_48px_rgba(var(--portal-primary-rgb),0.26)] before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-white/60 before:opacity-80 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(var(--portal-primary-rgb),0.38)] dark:border-[var(--border)] dark:text-[#1A1816] dark:shadow-[0_6px_20px_rgba(166,124,82,0.4)] dark:hover:shadow-[0_10px_30px_rgba(166,124,82,0.5)]",
        destructive:
          "border border-red-400/20 bg-[linear-gradient(135deg,#fb7185_0%,#ef4444_100%)] text-destructive-foreground shadow-[0_16px_36px_rgba(239,68,68,0.28)] before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-white/55 hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(239,68,68,0.36)]",
        outline:
          "border border-[rgba(86,72,58,0.12)] bg-white/70 text-foreground shadow-soft backdrop-blur-xl before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-white/50 hover:-translate-y-1 hover:border-primary/30 hover:bg-[rgba(var(--portal-primary-rgb),0.08)] hover:text-primary hover:shadow-card-hover dark:border-[var(--border)] dark:bg-[var(--bg-surface,#1A1816)] dark:text-[var(--text-primary,#F5F5F5)] dark:before:bg-white/5 dark:hover:bg-[var(--bg-elevated,#23201D)] dark:hover:border-[rgba(230,199,163,0.2)] dark:hover:shadow-[0_12px_30px_rgba(0,0,0,0.35)]",
        secondary:
          "border border-[rgba(200,162,124,0.26)] bg-[linear-gradient(135deg,rgba(200,162,124,0.24),rgba(139,94,60,0.18))] text-[#5d3c23] shadow-soft before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-white/35 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(139,94,60,0.18)] dark:border-[rgba(230,199,163,0.16)] dark:bg-[linear-gradient(135deg,rgba(230,199,163,0.12),rgba(166,124,82,0.12))] dark:text-[#f3e4d2]",
        ghost: "text-muted-foreground hover:bg-white/[0.06] hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-xl px-3.5",
        lg: "h-12 rounded-2xl px-8",
        icon: "h-11 w-11 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
