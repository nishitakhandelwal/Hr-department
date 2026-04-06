import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type PortalTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
};

type PortalDataTableProps<T> = {
  title: string;
  subtitle: string;
  columns: PortalTableColumn<T>[];
  rows: T[];
  loading?: boolean;
  emptyTitle: string;
  emptyDescription: string;
  pageSize?: number;
  getRowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
};

export function PortalDataTable<T>({
  title,
  subtitle,
  columns,
  rows,
  loading = false,
  emptyTitle,
  emptyDescription,
  pageSize = 6,
  getRowKey,
  onRowClick,
}: PortalDataTableProps<T>) {
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  React.useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  const paginatedRows = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [page, pageSize, rows]);

  return (
    <section className="dashboard-panel overflow-hidden p-0">
      <div className="relative flex flex-col gap-3 border-b border-[var(--portal-surface-border)] px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(var(--portal-primary-rgb),0.08),transparent)]" />
        <div>
          <p className="dashboard-label">Live Table</p>
          <h3 className="portal-heading mt-2 text-[22px] font-semibold">{title}</h3>
          <p className="portal-copy mt-1 text-sm leading-6">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-2xl"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page === 1 || loading}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="portal-muted min-w-[92px] text-center text-xs font-semibold uppercase tracking-[0.16em]">
            Page {page} / {totalPages}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-2xl"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page === totalPages || loading}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 p-6">
          {Array.from({ length: Math.min(5, pageSize) }).map((_, index) => (
            <div key={`table-skeleton-${index}`} className="grid grid-cols-4 gap-4 rounded-[20px] border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface)] p-4">
              {columns.map((column) => (
                <Skeleton key={`${column.key}-${index}`} className="h-5 rounded-full bg-[rgba(var(--portal-primary-rgb),0.08)]" />
              ))}
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      ) : (
        <div className="overflow-x-auto px-4 pb-4 pt-2">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn("portal-muted px-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em]", column.className)}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, index) => (
                <tr
                  key={getRowKey(row, index)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "group rounded-[22px] transition-all duration-300",
                    onRowClick ? "cursor-pointer hover:-translate-y-0.5" : "",
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "border-y border-[var(--portal-surface-border)] bg-[linear-gradient(180deg,var(--portal-subtle-surface-strong),var(--portal-subtle-surface))] px-4 py-4 text-sm first:rounded-l-[22px] first:border-l last:rounded-r-[22px] last:border-r dark:hover:shadow-[0_0_0_1px_rgba(var(--portal-primary-rgb),0.12)]",
                        onRowClick ? "group-hover:border-[rgba(var(--portal-primary-rgb),0.22)] group-hover:bg-[linear-gradient(180deg,rgba(var(--portal-primary-rgb),0.09),rgba(var(--portal-primary-rgb),0.04))] group-hover:shadow-[0_18px_36px_rgba(var(--portal-primary-rgb),0.08)]" : "",
                        column.className,
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
