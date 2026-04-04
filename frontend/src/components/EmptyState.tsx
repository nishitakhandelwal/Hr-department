import React from "react";
import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description = "No records available yet.",
  icon: Icon = Inbox,
  action,
}) => {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border bg-white/75 px-6 py-10 text-center shadow-card dark:border-white/12 dark:bg-[linear-gradient(180deg,rgba(10,14,28,0.92),rgba(15,20,37,0.9))]">
      <div className="gradient-primary-soft flex h-16 w-16 items-center justify-center rounded-2xl border border-white/80 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <Icon className="h-8 w-8 text-primary [stroke-width:2.5]" />
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
};
