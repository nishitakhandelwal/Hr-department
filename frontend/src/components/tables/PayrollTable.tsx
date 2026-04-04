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
  absentDays: number;
  grossSalaryFormatted: string;
  deductionsFormatted: string;
  netSalaryFormatted: string;
  status: string;
}

export const payrollExportColumns: ExportColumn<PayrollRow>[] = [
  { key: "employeeName", label: "Employee" },
  { key: "monthLabel", label: "Month" },
  { key: "presentDays", label: "Present Days" },
  { key: "absentDays", label: "Absent Days" },
  { key: "grossSalaryFormatted", label: "Gross Salary" },
  { key: "deductionsFormatted", label: "Deductions" },
  { key: "netSalaryFormatted", label: "Net Salary" },
  { key: "status", label: "Status" },
];

interface PayrollTableProps {
  data: PayrollRow[];
  onGeneratePayslip: (row: PayrollRow) => void;
  onViewPayslip: (row: PayrollRow) => void;
  onDownloadPdf: (row: PayrollRow) => void;
  actionLoadingId?: string;
  generatedPayrollIds?: string[];
}

const actionTriggerClass =
  "h-10 min-w-[126px] justify-between rounded-xl border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-none transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900";

const statusClassName = (status: string) => {
  const normalized = status.toLowerCase();

  if (normalized === "processed") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "pending") {
    return "border border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border border-slate-200 bg-slate-100 text-slate-700";
};

const PayrollTable: React.FC<PayrollTableProps> = ({
  data,
  onGeneratePayslip,
  onViewPayslip,
  onDownloadPdf,
  actionLoadingId,
  generatedPayrollIds = [],
}) => {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
        <p className="text-base font-medium text-slate-900">No payroll records found</p>
        <p className="mt-1 text-sm text-slate-500">Try another month or adjust your payroll filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-slate-200 bg-slate-50 hover:bg-slate-50">
            <TableHead>Month</TableHead>
            <TableHead>Present Days</TableHead>
            <TableHead>Absent Days</TableHead>
            <TableHead>Gross Salary</TableHead>
            <TableHead>Deductions</TableHead>
            <TableHead>Net Salary</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const isGenerated = generatedPayrollIds.includes(row._id);

            return (
              <TableRow key={row._id} className="border-b border-slate-200 hover:bg-slate-50/80">
                <TableCell className="min-w-[180px]">
                  <div className="font-medium text-slate-900">{row.monthLabel}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.employeeName}</div>
                </TableCell>
                <TableCell className="text-slate-700">{row.presentDays}</TableCell>
                <TableCell className="text-slate-700">{row.absentDays}</TableCell>
                <TableCell className="font-medium text-slate-900">{row.grossSalaryFormatted}</TableCell>
                <TableCell className="text-slate-700">{row.deductionsFormatted}</TableCell>
                <TableCell className="font-semibold text-slate-950">{row.netSalaryFormatted}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(row.status)}`}>
                    {row.status}
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
                            <FileText className="h-4 w-4 text-slate-500" />
                            Actions
                          </span>
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 rounded-xl border-slate-200 p-2 shadow-lg">
                        <DropdownMenuLabel className="px-2.5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Payslip Actions
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 focus:bg-slate-50 focus:text-slate-900"
                          onClick={(event) => {
                            event.stopPropagation();
                            onGeneratePayslip(row);
                          }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {isGenerated ? "Regenerate Payslip" : "Generate Payslip"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 focus:bg-slate-50 focus:text-slate-900"
                          onClick={(event) => {
                            event.stopPropagation();
                            onViewPayslip(row);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Payslip
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={actionLoadingId === row._id}
                          className="rounded-lg px-2.5 py-2 text-sm font-medium text-[#4338ca] focus:bg-indigo-50 focus:text-[#4338ca]"
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
