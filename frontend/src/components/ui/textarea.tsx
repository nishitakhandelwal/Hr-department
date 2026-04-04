import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-2xl border border-input/80 bg-white/80 px-4 py-3 text-sm text-foreground shadow-soft backdrop-blur-sm ring-offset-background transition-all duration-300 placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0 focus-visible:border-primary/40 hover:border-primary/20 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-50 dark:bg-card/70",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
