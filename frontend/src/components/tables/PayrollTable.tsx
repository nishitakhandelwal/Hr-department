/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { ChevronDown, Download, Eye, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ExportColumn } from "@/utils/export";

export interface PayrollRow {
  _id: string;
  employeeName: string;
  monthLabel: string;
  presentDays: number;
  lateDays: number;
  halfDays: number;
  absentDays: number;
  incompleteDays: number;
  payableDays: number;
  perDaySalaryFormatted: string;
  earnedSalaryFormatted: string;
  overtimePayFormatted: string;
  grossSalaryFormatted: string;
  advanceDeductionFormatted: string;
  deductionsFormatted: string;
  netSalaryFormatted: string;
  status: string;
  paymentStatus: string;
}

export const payrollExportColumns: ExportColumn<PayrollRow>[] = [
  { key: "employeeName", label: "Employee" },
  { key: "monthLabel", label: "Month" },
  { key: "presentDays", label: "Present Days" },
  { key: "lateDays", label: "Late Days" },
  { key: "halfDays", label: "Half Days" },
  { key: "absentDays", label: "Absent Days" },
  { key: "incompleteDays", label: "Incomplete Days" },
  { key: "payableDays", label: "Payable Days" },
  { key: "perDaySalaryFormatted", label: "Per Day Salary" },
  { key: "earnedSalaryFormatted", label: "Earned Salary" },
  { key: "overtimePayFormatted", label: "Overtime Pay" },
  { key: "grossSalaryFormatted", label: "Gross Salary" },
  { key: "advanceDeductionFormatted", label: "Advance Recovery" },
  { key: "deductionsFormatted", label: "Deductions" },
  { key: "netSalaryFormatted", label: "Net Salary" },
  { key: "paymentStatus", label: "Payment Status" },
];

interface PayrollTableProps {
  data: PayrollRow[];
  onGeneratePayslip: (row: PayrollRow) => void;
  onViewPayslip: (row: PayrollRow) => void;
  onDownloadPdf: (row: PayrollRow) => void;
  onManagePayment?: (row: PayrollRow) => void;
  actionLoadingId?: string;
  generatedPayrollIds?: string[];
}

const actionTriggerClass =
  "h-10 min-w-[126px] justify-between rounded-xl border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] px-3.5 text-sm font-medium text-[var(--portal-heading-color)] shadow-none transition-all duration-200 hover:border-[rgba(var(--portal-primary-rgb),0.2)] hover:bg-[rgba(var(--portal-primary-rgb),0.06)] hover:text-[var(--portal-heading-color)] dark:border-white/12 dark:bg-[#111111] dark:text-white dark:hover:border-white/18 dark:hover:bg-[#161616] dark:hover:text-white";

const tableShellClass =
  "overflow-hidden rounded-2xl border border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] shadow-[0_16px_36px_rgba(15,23,42,0.08)] dark:bg-[#0a0a0a] dark:shadow-[0_16px_36px_rgba(0,0,0,0.32)]";

const statusClassName = (status: string) => {
  const normalized = status.toLowerCase();

  if (normalized === "paid") {
    return "border border-emerald-500/20 bg-emerald-500/12 text-emerald-300";
  }

  if (normalized === "partially paid") {
    return "border border-sky-500/20 bg-sky-500/12 text-sky-300";
  }

  if (normalized === "unpaid" || normalized === "pending") {
    return "border border-amber-500/20 bg-amber-500/12 text-amber-300";
  }

  return "border border-[var(--portal-surface-border)] bg-[rgba(var(--portal-primary-rgb),0.08)] text-[var(--portal-heading-color)] dark:border-white/12 dark:bg-white/8 dark:text-neutral-200";
};

const PayrollTable: React.FC<PayrollTableProps> = ({
  data,
  onGeneratePayslip,
  onViewPayslip,
  onDownloadPdf,
  onManagePayment,
  actionLoadingId,
  generatedPayrollIds = [],
}) => {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] px-6 py-10 text-center dark:bg-[#0a0a0a]">
        <p className="text-base font-medium text-[var(--portal-heading-color)] dark:text-white">No payroll records found</p>
        <p className="mt-1 text-sm text-[var(--portal-muted-color)]">Try another month or adjust your payroll filters.</p>
      </div>
    );
  }

  return (
    <div className={tableShellClass}>
      <Table>
        <TableHeader>
            <TableRow className="border-b border-[var(--portal-surface-border)] bg-[rgba(var(--portal-primary-rgb),0.05)] hover:bg-[rgba(var(--portal-primary-rgb),0.05)] dark:bg-[#111111] dark:hover:bg-[#111111]">
            <TableHead>Month</TableHead>
            <TableHead>Present Days</TableHead>
            <TableHead>Late Days</TableHead>
            <TableHead>Half Days</TableHead>
            <TableHead>Absent Days</TableHead>
            <TableHead>Incomplete</TableHead>
            <TableHead>Payable Days</TableHead>
            <TableHead>Per Day</TableHead>
            <TableHead>Earned</TableHead>
            <TableHead>Overtime</TableHead>
            <TableHead>Gross Salary</TableHead>
            <TableHead>Advance Recovery</TableHead>
            <TableHead>Deductions</TableHead>
            <TableHead>Net Salary</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const isGenerated = generatedPayrollIds.includes(row._id);

            return (
              <TableRow key={row._id} className="border-b border-[var(--portal-surface-border)] hover:bg-[rgba(var(--portal-primary-rgb),0.04)] dark:hover:bg-[#141414]">
                <TableCell className="min-w-[180px]">
                  <div className="font-medium text-[var(--portal-heading-color)] dark:text-white">{row.monthLabel}</div>
                  <div className="mt-1 text-xs text-[var(--portal-muted-color)]">{row.employeeName}</div>
                </TableCell>
                <TableCell>{row.presentDays}</TableCell>
                <TableCell>{row.lateDays}</TableCell>
                <TableCell>{row.halfDays}</TableCell>
                <TableCell>{row.absentDays}</TableCell>
                <TableCell>{row.incompleteDays}</TableCell>
                <TableCell>{row.payableDays}</TableCell>
                <TableCell>{row.perDaySalaryFormatted}</TableCell>
                <TableCell>{row.earnedSalaryFormatted}</TableCell>
                <TableCell>{row.overtimePayFormatted}</TableCell>
                <TableCell className="font-medium">{row.grossSalaryFormatted}</TableCell>
                <TableCell>{row.advanceDeductionFormatted}</TableCell>
                <TableCell>{row.deductionsFormatted}</TableCell>
                <TableCell className="font-semibold">{row.netSalaryFormatted}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(row.paymentStatus)}`}>
                    {row.paymentStatus}
                  </span>
                </TableCell>
                <TableCell className="w-[170px] text-right">
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={actionTriggerClass}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <span className="inline-flex items-center gap-2">
                            <FileText className="h-4 w-4 text-[var(--portal-muted-color)] dark:text-neutral-300" />
                            Actions
                          </span>
                          <ChevronDown className="h-4 w-4 text-[var(--portal-muted-color)] dark:text-neutral-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 rounded-xl border-[var(--portal-surface-border)] bg-[var(--portal-subtle-surface-strong)] p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[#111111] dark:shadow-[0_18px_40px_rgba(0,0,0,0.38)]">
                        <DropdownMenuLabel className="px-2.5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--portal-muted-color)] dark:text-neutral-500">
                          Payslip Actions
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--portal-heading-color)] focus:bg-[rgba(var(--portal-primary-rgb),0.08)] focus:text-[var(--portal-heading-color)] dark:text-white dark:focus:bg-[#181818] dark:focus:text-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            onGeneratePayslip(row);
                          }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {isGenerated ? "Regenerate Payslip" : "Generate Payslip"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--portal-heading-color)] focus:bg-[rgba(var(--portal-primary-rgb),0.08)] focus:text-[var(--portal-heading-color)] dark:text-white dark:focus:bg-[#181818] dark:focus:text-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            onViewPayslip(row);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Payslip
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--portal-heading-color)] focus:bg-[rgba(var(--portal-primary-rgb),0.08)] focus:text-[var(--portal-heading-color)] dark:text-white dark:focus:bg-[#181818] dark:focus:text-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            onManagePayment?.(row);
                          }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Update Payment
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={actionLoadingId === row._id}
                          className="rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--portal-heading-color)] focus:bg-[rgba(var(--portal-primary-rgb),0.08)] focus:text-[var(--portal-heading-color)] dark:text-white dark:focus:bg-[#181818] dark:focus:text-white"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDownloadPdf(row);
                          }}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          {actionLoadingId === row._id ? "Downloading..." : "Download PDF"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default PayrollTable;
