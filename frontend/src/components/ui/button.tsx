/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-2xl text-sm font-semibold ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-[#1f2937] bg-[#1f2937] text-white hover:bg-[#111827] dark:border-[#374151] dark:bg-[#374151] dark:hover:bg-[#4b5563]",
        destructive:
          "border border-[#7f1d1d] bg-[#991b1b] text-white hover:bg-[#7f1d1d]",
        outline:
          "border border-[var(--portal-surface-border)] bg-white text-foreground shadow-none hover:border-[#cbd5e1] hover:bg-[#f8fafc] hover:text-foreground dark:border-[var(--border)] dark:bg-[var(--bg-surface,#1A1816)] dark:text-[var(--text-primary,#F5F5F5)] dark:hover:bg-[var(--bg-elevated,#23201D)]",
        secondary:
          "border border-[#e2e8f0] bg-[#f1f5f9] text-[#1f2937] shadow-none hover:bg-[#e2e8f0] dark:border-[#374151] dark:bg-[#1f2937] dark:text-[#f3f4f6] dark:hover:bg-[#374151]",
        ghost: "text-muted-foreground hover:bg-[#f1f5f9] hover:text-foreground dark:hover:bg-white/[0.06] dark:hover:text-white",
        link: "text-[#1f2937] underline-offset-4 hover:underline dark:text-white",
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
