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
          "border border-white/10 bg-[linear-gradient(135deg,rgba(129,140,248,0.95),rgba(168,85,247,0.92),rgba(56,189,248,0.9))] text-primary-foreground shadow-[0_18px_48px_rgba(99,102,241,0.32)] before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-white/60 before:opacity-80 hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(99,102,241,0.42)]",
        destructive:
          "border border-red-400/20 bg-[linear-gradient(135deg,#fb7185_0%,#ef4444_100%)] text-destructive-foreground shadow-[0_16px_36px_rgba(239,68,68,0.28)] before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-white/55 hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(239,68,68,0.36)]",
        outline:
          "border border-white/10 bg-white/[0.06] text-foreground shadow-soft backdrop-blur-xl before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-white/20 hover:-translate-y-1 hover:border-primary/40 hover:bg-primary/[0.08] hover:text-primary hover:shadow-card-hover",
        secondary:
          "border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(45,212,191,0.22),rgba(34,211,238,0.22))] text-cyan-100 shadow-soft before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-white/30 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(34,211,238,0.22)]",
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
