import React from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PayrollRecord } from "@/services/api";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

type SalarySlipCardProps = {
  companyName?: string;
  companyAddress?: string;
  record: PayrollRecord;
  downloading?: boolean;
  onDownload?: () => void;
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("en-GB") : "-");

const formatTimestamp = (value = new Date()) =>
  new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const maskAccountNumber = (value?: string) => {
  const raw = String(value || "");
  if (!raw) return "";
  if (raw.length <= 4) return raw;
  return `${"*".repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}`;
};

const buildBankDetailsText = (record: PayrollRecord) => {
  const parts = [
    record.bankDetails?.bankName,
    record.bankDetails?.accountHolderName,
    record.bankDetails?.accountNumber ? `A/C ${maskAccountNumber(record.bankDetails.accountNumber)}` : "",
    record.bankDetails?.ifscCode ? `IFSC ${record.bankDetails.ifscCode}` : "",
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : "-";
};

const buildRows = (record: PayrollRecord) => {
  const earnings = [
    { label: "Basic", amount: record.basicSalary || 0 },
    { label: "HRA", amount: record.hra || 0 },
    { label: "Allowance", amount: (record.specialAllowance || 0) + (record.allowances || 0) + (record.bonus || 0) + (record.overtimePay || 0) },
  ];

  const deductions = [
    { label: "PF", amount: record.pfEmployee || 0 },
    { label: "ESI", amount: record.esiEmployee || 0 },
    { label: "Fine / Tax / Other", amount: (record.fineAmount || 0) + (record.tax || 0) + (record.deductions || 0) },
  ];

  return Array.from({ length: Math.max(earnings.length, deductions.length) }, (_, index) => ({
    earningLabel: earnings[index]?.label || "-",
    earningAmount: earnings[index]?.amount ?? null,
    deductionLabel: deductions[index]?.label || "-",
    deductionAmount: deductions[index]?.amount ?? null,
  }));
};

export const SalarySlipCard: React.FC<SalarySlipCardProps> = ({
  companyName = "HR Harmony Hub",
  companyAddress = "",
  record,
  downloading = false,
  onDownload,
}) => {
  const payPeriod = `${record.month} ${record.year}`;
  const lineRows = buildRows(record);
  const totalEarnings =
    (record.basicSalary || 0) +
    (record.hra || 0) +
    (record.specialAllowance || 0) +
    (record.allowances || 0) +
    (record.bonus || 0) +
    (record.overtimePay || 0);

  return (
    <div className="space-y-4">
      {onDownload ? (
        <div className="flex justify-end">
          <Button className="gap-2" onClick={onDownload} disabled={downloading}>
            <Download className="h-4 w-4" />
            {downloading ? "Generating PDF..." : "Download Salary Slip"}
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md bg-slate-100 p-4">
        <div className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[12mm] text-slate-900 shadow-sm">
          <div className="flex items-start justify-between gap-6 border-b border-slate-900 pb-3">
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-wide">{companyName}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{companyAddress || "-"}</p>
            </div>
            <div className="min-w-[11rem] text-right">
              <p className="text-lg font-bold">{payPeriod}</p>
              <p className="mt-1 text-xs text-slate-600">Payslip ID: {record.payrollId}</p>
            </div>
          </div>

          <section className="mt-5">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-700">Employee Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr>
                    <td className="border border-slate-900 bg-slate-50 px-3 py-2 font-semibold">Name</td>
                    <td className="border border-slate-900 px-3 py-2">{record.employeeName}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 bg-slate-50 px-3 py-2 font-semibold">Department</td>
                    <td className="border border-slate-900 px-3 py-2">{record.department || "-"}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 bg-slate-50 px-3 py-2 font-semibold">Joining Date</td>
                    <td className="border border-slate-900 px-3 py-2">{formatDate(record.joiningDate)}</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr>
                    <td className="border border-slate-900 bg-slate-50 px-3 py-2 font-semibold">Employee ID</td>
                    <td className="border border-slate-900 px-3 py-2">{record.employeeCode || "-"}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 bg-slate-50 px-3 py-2 font-semibold">Designation</td>
                    <td className="border border-slate-900 px-3 py-2">{record.designation || "-"}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 bg-slate-50 px-3 py-2 font-semibold">Location</td>
                    <td className="border border-slate-900 px-3 py-2">{record.location || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <table className="mt-3 w-full border-collapse text-sm">
              <tbody>
                <tr>
                  <td className="w-[22%] border border-slate-900 bg-slate-50 px-3 py-2 font-semibold">Bank Details</td>
                  <td className="border border-slate-900 px-3 py-2">{buildBankDetailsText(record)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mt-5">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-700">Attendance</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-200">
                  <th className="border border-slate-900 px-3 py-2 text-left font-semibold">Present Days</th>
                  <th className="border border-slate-900 px-3 py-2 text-left font-semibold">Absent Days</th>
                  <th className="border border-slate-900 px-3 py-2 text-left font-semibold">Leaves</th>
                  <th className="border border-slate-900 px-3 py-2 text-left font-semibold">OT Hours</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-900 px-3 py-2 text-right">{record.presentDays}</td>
                  <td className="border border-slate-900 px-3 py-2 text-right">{record.absentDays}</td>
                  <td className="border border-slate-900 px-3 py-2 text-right">{record.leaveDays}</td>
                  <td className="border border-slate-900 px-3 py-2 text-right">{record.overtimeHours || 0}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mt-5">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-700">Earnings & Deductions</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-200">
                  <th className="border border-slate-900 px-3 py-2 text-left font-semibold">Earnings</th>
                  <th className="border border-slate-900 px-3 py-2 text-left font-semibold">Amount</th>
                  <th className="border border-slate-900 px-3 py-2 text-left font-semibold">Deductions</th>
                  <th className="border border-slate-900 px-3 py-2 text-left font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineRows.map((row) => (
                  <tr key={`${row.earningLabel}-${row.deductionLabel}`}>
                    <td className="border border-slate-900 px-3 py-2">{row.earningLabel}</td>
                    <td className="border border-slate-900 px-3 py-2 text-right">
                      {row.earningAmount === null ? "-" : currency.format(row.earningAmount)}
                    </td>
                    <td className="border border-slate-900 px-3 py-2">{row.deductionLabel}</td>
                    <td className="border border-slate-900 px-3 py-2 text-right">
                      {row.deductionAmount === null ? "-" : currency.format(row.deductionAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-5 flex justify-end">
            <table className="w-[18rem] border-collapse text-sm">
              <tbody>
                <tr>
                  <td className="border border-slate-900 bg-slate-50 px-3 py-2 font-semibold">Total Earnings</td>
                  <td className="border border-slate-900 px-3 py-2 text-right font-semibold">{currency.format(totalEarnings)}</td>
                </tr>
                <tr>
                  <td className="border border-slate-900 bg-slate-50 px-3 py-2 font-semibold">Total Deductions</td>
                  <td className="border border-slate-900 px-3 py-2 text-right font-semibold">{currency.format(record.totalDeductions || 0)}</td>
                </tr>
                <tr className="bg-blue-100">
                  <td className="border border-slate-900 px-3 py-2 font-bold">Net Pay</td>
                  <td className="border border-slate-900 px-3 py-2 text-right font-bold">{currency.format(record.netSalary || 0)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mt-5 border border-slate-900 px-3 py-2 text-sm">
            <span className="font-semibold">Amount in Words:</span> {record.amountInWords || "-"}
          </section>

          <footer className="mt-5 flex items-center justify-between gap-4 border-t border-slate-300 pt-3 text-xs text-slate-600">
            <p>This is a digitally generated document and does not require a signature.</p>
            <p>Generated on {formatTimestamp()}</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default SalarySlipCard;
