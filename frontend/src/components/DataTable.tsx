import React from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  exportable?: boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({ columns, data, onRowClick }: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.82))] shadow-card backdrop-blur-xl dark:border-[#2A2623] dark:bg-[linear-gradient(135deg,#1A1816,#2A211B)]">
      {data.length === 0 ? (
        <div className="p-6">
          <EmptyState title="No records available yet." description="New items will appear here as soon as your team starts using this module." />
        </div>
      ) : (
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="border-b bg-[linear-gradient(180deg,rgba(230,199,163,0.12),rgba(255,255,255,0.8))] dark:border-[#2A2623] dark:bg-[linear-gradient(135deg,#1A1816,#2A211B)]">
              {columns.map((col) => (
                <TableHead key={col.key} className={col.key === "actions" ? "text-right" : undefined}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, i) => (
              <TableRow
                key={i}
                onClick={() => onRowClick?.(item)}
                className={[
                  "border-b border-border/70 transition-all duration-300 hover:bg-[linear-gradient(90deg,rgba(230,199,163,0.14),rgba(166,124,82,0.08))] dark:border-white/8 dark:hover:bg-[linear-gradient(90deg,rgba(230,199,163,0.2),rgba(166,124,82,0.12))]",
                  onRowClick ? "cursor-pointer" : "",
                ].join(" ")}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.key === "actions" ? "text-right" : undefined}>
                    {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const variants: Record<string, string> = {
    active: "bg-[linear-gradient(135deg,rgba(34,197,94,0.14),rgba(16,185,129,0.08))] text-success border-success/20",
    inactive: "bg-slate-100/90 text-slate-600 border-slate-200 dark:border-white/12 dark:bg-white/[0.07] dark:text-slate-300",
    disabled: "bg-[linear-gradient(135deg,rgba(239,68,68,0.14),rgba(251,113,133,0.08))] text-destructive border-destructive/20",
    selected: "bg-[linear-gradient(135deg,rgba(34,197,94,0.14),rgba(16,185,129,0.08))] text-success border-success/20",
    rejected: "bg-[linear-gradient(135deg,rgba(239,68,68,0.14),rgba(251,113,133,0.08))] text-destructive border-destructive/20",
    "on hold": "bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(249,115,22,0.08))] text-warning border-warning/20",
    pending: "bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(249,115,22,0.08))] text-warning border-warning/20",
    approved: "bg-[linear-gradient(135deg,rgba(34,197,94,0.14),rgba(16,185,129,0.08))] text-success border-success/20",
    configured: "bg-[linear-gradient(135deg,rgba(34,197,94,0.14),rgba(16,185,129,0.08))] text-success border-success/20",
    processed: "bg-[linear-gradient(135deg,rgba(34,197,94,0.14),rgba(16,185,129,0.08))] text-success border-success/20",
    present: "bg-[linear-gradient(135deg,rgba(34,197,94,0.14),rgba(16,185,129,0.08))] text-success border-success/20",
    absent: "bg-[linear-gradient(135deg,rgba(239,68,68,0.14),rgba(251,113,133,0.08))] text-destructive border-destructive/20",
    leave: "bg-[linear-gradient(135deg,rgba(230,199,163,0.2),rgba(166,124,82,0.12))] text-info border-[#2A2623]",
    late: "bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(249,115,22,0.08))] text-warning border-warning/20",
    paid: "bg-[linear-gradient(135deg,rgba(34,197,94,0.14),rgba(16,185,129,0.08))] text-success border-success/20",
    processing: "bg-[linear-gradient(135deg,rgba(230,199,163,0.2),rgba(166,124,82,0.12))] text-info border-[#2A2623]",
    new: "bg-[linear-gradient(135deg,rgba(230,199,163,0.2),rgba(166,124,82,0.12))] text-info border-[#2A2623]",
    "interview scheduled": "bg-[linear-gradient(135deg,rgba(200,162,124,0.18),rgba(139,94,60,0.08))] text-primary border-primary/20",
  };

  const className = variants[status.toLowerCase()] || "bg-muted text-muted-foreground border-border";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${className}`}>
      {status}
    </span>
  );
};
