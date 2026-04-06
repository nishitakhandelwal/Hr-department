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
  "h-10 min-w-[126px] justify-between rounded-xl border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] px-3.5 text-sm font-medium text-[#E6C7A3] shadow-none transition-all duration-200 hover:border-[rgba(230,199,163,0.22)] hover:bg-[rgba(230,199,163,0.12)] hover:text-[#E6C7A3]";

const statusClassName = (status: string) => {
  const normalized = status.toLowerCase();

  if (normalized === "processed") {
    return "border border-[rgba(230,199,163,0.18)] bg-[rgba(230,199,163,0.12)] text-[#E6C7A3]";
  }

  if (normalized === "pending") {
    return "border border-[rgba(166,124,82,0.22)] bg-[rgba(166,124,82,0.16)] text-[#E6C7A3]";
  }

  return "border border-[#2A2623] bg-[rgba(35,32,29,0.72)] text-[#A1A1AA]";
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
      <div className="rounded-2xl border border-dashed border-[#2A2623] bg-[linear-gradient(135deg,#181513,#211d1a)] px-6 py-10 text-center">
        <p className="text-base font-medium text-[#F5F5F5]">No payroll records found</p>
        <p className="mt-1 text-sm text-[#A1A1AA]">Try another month or adjust your payroll filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#2A2623] bg-[linear-gradient(135deg,#181513,#211d1a)]">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-[#2A2623] bg-[rgba(230,199,163,0.08)] hover:bg-[rgba(230,199,163,0.08)]">
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
              <TableRow key={row._id} className="border-b border-[#2A2623] hover:bg-[rgba(230,199,163,0.08)]">
                <TableCell className="min-w-[180px]">
                  <div className="font-medium text-[#F5F5F5]">{row.monthLabel}</div>
                  <div className="mt-1 text-xs text-[#A1A1AA]">{row.employeeName}</div>
                </TableCell>
                <TableCell className="text-[#D4D4D8]">{row.presentDays}</TableCell>
                <TableCell className="text-[#D4D4D8]">{row.absentDays}</TableCell>
                <TableCell className="font-medium text-[#F5F5F5]">{row.grossSalaryFormatted}</TableCell>
                <TableCell className="text-[#D4D4D8]">{row.deductionsFormatted}</TableCell>
                <TableCell className="font-semibold text-[#F5F5F5]">{row.netSalaryFormatted}</TableCell>
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
                            <FileText className="h-4 w-4 text-[#E6C7A3]" />
                            Actions
                          </span>
                          <ChevronDown className="h-4 w-4 text-[#A1A1AA]" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 rounded-xl border-[#2A2623] bg-[linear-gradient(135deg,#1A1816,#23201D)] p-2 shadow-[0_18px_40px_rgba(166,124,82,0.22)]">
                        <DropdownMenuLabel className="px-2.5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#A1A1AA]">
                          Payslip Actions
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="rounded-lg px-2.5 py-2 text-sm font-medium text-[#E6C7A3] focus:bg-[rgba(230,199,163,0.12)] focus:text-[#F5F5F5]"
                          onClick={(event) => {
                            event.stopPropagation();
                            onGeneratePayslip(row);
                          }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {isGenerated ? "Regenerate Payslip" : "Generate Payslip"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="rounded-lg px-2.5 py-2 text-sm font-medium text-[#E6C7A3] focus:bg-[rgba(230,199,163,0.12)] focus:text-[#F5F5F5]"
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
                          className="rounded-lg px-2.5 py-2 text-sm font-medium text-[#E6C7A3] focus:bg-[rgba(230,199,163,0.12)] focus:text-[#F5F5F5]"
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
