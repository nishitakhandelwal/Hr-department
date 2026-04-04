import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-2xl border border-input/80 bg-background px-4 py-3 text-sm text-foreground shadow-soft backdrop-blur-sm ring-offset-background transition-all duration-300 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0 focus-visible:border-primary/40 hover:border-primary/20 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-50 dark:bg-background/70",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
