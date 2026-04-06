import React from "react";

import { Skeleton } from "@/components/ui/skeleton";

const PortalDashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="page-shell space-y-4">
        <Skeleton className="h-6 w-32 rounded-full bg-[rgba(var(--portal-primary-rgb),0.1)]" />
        <Skeleton className="h-12 w-2/3 rounded-2xl bg-[rgba(var(--portal-primary-rgb),0.12)]" />
        <Skeleton className="h-5 w-1/2 rounded-full bg-[rgba(var(--portal-primary-rgb),0.08)]" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <div className="dashboard-panel space-y-5 p-7">
          <Skeleton className="h-6 w-28 rounded-full bg-[rgba(var(--portal-primary-rgb),0.1)]" />
          <Skeleton className="h-12 w-3/4 rounded-3xl bg-[rgba(var(--portal-primary-rgb),0.12)]" />
          <Skeleton className="h-5 w-2/3 rounded-full bg-[rgba(var(--portal-primary-rgb),0.08)]" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={`hero-card-${index}`} className="h-36 rounded-[24px] bg-[rgba(var(--portal-primary-rgb),0.08)]" />
            ))}
          </div>
        </div>
        <Skeleton className="dashboard-panel h-[360px] rounded-[24px] bg-[rgba(var(--portal-primary-rgb),0.08)]" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`metric-card-${index}`} className="h-40 rounded-[24px] bg-[rgba(var(--portal-primary-rgb),0.08)]" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-[360px] rounded-[24px] bg-[rgba(var(--portal-primary-rgb),0.08)]" />
        <Skeleton className="h-[360px] rounded-[24px] bg-[rgba(var(--portal-primary-rgb),0.08)]" />
      </div>

      <Skeleton className="h-[420px] rounded-[24px] bg-[rgba(var(--portal-primary-rgb),0.08)]" />
    </div>
  );
};

export default PortalDashboardSkeleton;
