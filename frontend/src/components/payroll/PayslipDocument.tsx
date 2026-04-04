import React from "react";
import type { PayrollRecord } from "@/services/api";
import companyLogo from "@/assets/logo.png";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const COMPANY_DETAILS = {
  name: "Arihant Dream Infra Project Ltd.",
  certification: "An ISO 9001:2008 Certified Company",
  address: "2nd Floor,Class of Pearl,Income Tax Colony, Tonk Road, Jaipur",
  legal: "CIN: U70101RJ2011PLC035322 | GST: 08AAJCA5226A1Z3",
  contact: "Tel.: 0141-2970900 | Email: info@arihantgroupjaipur.com | URL: www.arihantgroupjaipur.com",
  logoSrc: companyLogo,
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("en-GB") : "-");

const maskAccountNumber = (value?: string) => {
  const raw = String(value || "");
  if (!raw) return "-";
  if (raw.length <= 4) return raw;
  return `${"*".repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}`;
};

const buildBankDetailsText = (record: PayrollRecord) => {
  const parts = [
    record.bankDetails?.bankName,
    record.bankDetails?.accountHolderName,
    record.bankDetails?.accountNumber ? `A/C ${maskAccountNumber(record.bankDetails.accountNumber)}` : "",
    record.bankDetails?.ifscCode ? `IFSC ${record.bankDetails.ifscCode}` : "",
    record.bankDetails?.branchName,
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : "-";
};

const getLineItems = (record: PayrollRecord) => {
  const earnings = [
    { label: "Basic Salary", amount: record.basicSalary || 0 },
    { label: "HRA", amount: record.hra || 0 },
    { label: "Special Allowance", amount: record.specialAllowance || 0 },
    { label: "Other Allowance", amount: record.allowances || 0 },
    { label: "Bonus", amount: record.bonus || 0 },
    { label: "Overtime", amount: record.overtimePay || 0 },
  ];

  const deductions = [
    { label: "PF", amount: record.pfEmployee || 0 },
    { label: "ESI", amount: record.esiEmployee || 0 },
    { label: "Fine", amount: record.fineAmount || 0 },
    { label: "Tax", amount: record.tax || 0 },
    { label: "Other Deductions", amount: record.deductions || 0 },
  ];

  return Array.from({ length: Math.max(earnings.length, deductions.length) }, (_, index) => ({
    earning: earnings[index] || { label: "-", amount: null },
    deduction: deductions[index] || { label: "-", amount: null },
  }));
};

type PayslipDocumentProps = {
  record: PayrollRecord;
  className?: string;
};

const tableCellClass = "border border-slate-300 px-2.5 py-1.5 text-[10px] text-slate-800";
const labelCellClass = `${tableCellClass} w-[32%] bg-slate-50 font-semibold text-slate-900`;
const headingClass = "mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700";

const PayslipDocument = React.forwardRef<HTMLDivElement, PayslipDocumentProps>(({ record, className = "" }, ref) => {
  const lineItems = getLineItems(record);
  const totalEarnings =
    (record.basicSalary || 0) +
    (record.hra || 0) +
    (record.specialAllowance || 0) +
    (record.allowances || 0) +
    (record.bonus || 0) +
    (record.overtimePay || 0);

  return (
    <div
      ref={ref}
      className={`mx-auto w-full max-w-[188mm] min-h-[1050px] flex flex-col justify-between bg-white p-6 text-slate-900 ${className}`}
    >
      <div className="pb-4 mb-3 border-b border-slate-300">
  <table className="w-full border-collapse">
    <tbody>
      <tr>
        <td className="align-top pr-4">
          <div className="space-y-1 text-[9.5px] leading-[1.5] text-slate-700">
            <h1 className="mb-1 text-[18px] font-bold leading-tight text-slate-950">
              {COMPANY_DETAILS.name}
            </h1>
            <p>{COMPANY_DETAILS.certification}</p>
            <p>{COMPANY_DETAILS.address}</p>
            <p>{COMPANY_DETAILS.legal}</p>
            <p>{COMPANY_DETAILS.contact}</p>
          </div>
        </td>

        <td className="w-[96px] align-middle text-right">
          <img
            src={COMPANY_DETAILS.logoSrc}
            alt="Company Logo"
            
          />
        </td>
      </tr>
    </tbody>
  </table>
</div>

      <section className="mt-5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="w-1/2 align-top">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">Payslip For</p>
                <p className="mt-0.5 text-[12px] font-bold text-slate-950">{record.month} {record.year}</p>
              </td>
              <td className="w-1/2 align-top text-[10px] text-slate-700">
                <p><span className="font-semibold text-slate-950">Payslip ID:</span> {record.payrollId}</p>
                <p className="mt-0.5"><span className="font-semibold text-slate-950">Status:</span> {record.status || "Processed"}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <h2 className={headingClass}>Employee Details</h2>
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className="w-1/2 align-top pr-1.5">
              <table className="w-full border-collapse">
                <tbody>
                  <tr><td className={labelCellClass}>Employee Name</td><td className={tableCellClass}>{record.employeeName}</td></tr>
                  <tr><td className={labelCellClass}>Employee ID</td><td className={tableCellClass}>{record.employeeCode || "-"}</td></tr>
                  <tr><td className={labelCellClass}>Department</td><td className={tableCellClass}>{record.department || "-"}</td></tr>
                  <tr><td className={labelCellClass}>Designation</td><td className={tableCellClass}>{record.designation || "-"}</td></tr>
                </tbody>
              </table>
            </td>
            <td className="w-1/2 align-top pl-1.5">
              <table className="w-full border-collapse">
                <tbody>
                  <tr><td className={labelCellClass}>Joining Date</td><td className={tableCellClass}>{formatDate(record.joiningDate)}</td></tr>
                  <tr><td className={labelCellClass}>Location</td><td className={tableCellClass}>{record.location || "-"}</td></tr>
                  <tr><td className={labelCellClass}>Payable Days</td><td className={tableCellClass}>{record.payableDays || 0} / {record.totalWorkingDays || 0}</td></tr>
                  <tr><td className={labelCellClass}>Bank Details</td><td className={tableCellClass}>{buildBankDetailsText(record)}</td></tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <h2 className={headingClass}>Attendance Summary</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className={`${tableCellClass} text-left text-[9px] font-semibold uppercase tracking-[0.05em]`}>Present Days</th>
            <th className={`${tableCellClass} text-left text-[9px] font-semibold uppercase tracking-[0.05em]`}>Late Days</th>
            <th className={`${tableCellClass} text-left text-[9px] font-semibold uppercase tracking-[0.05em]`}>Absent Days</th>
            <th className={`${tableCellClass} text-left text-[9px] font-semibold uppercase tracking-[0.05em]`}>Leave Days</th>
            <th className={`${tableCellClass} text-left text-[9px] font-semibold uppercase tracking-[0.05em]`}>Overtime Hours</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tableCellClass}>{record.presentDays}</td>
            <td className={tableCellClass}>{record.lateDays}</td>
            <td className={tableCellClass}>{record.absentDays}</td>
            <td className={tableCellClass}>{record.leaveDays}</td>
            <td className={tableCellClass}>{record.overtimeHours || 0}</td>
          </tr>
        </tbody>
      </table>

      <h2 className={headingClass}>Earnings And Deductions</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className={`${tableCellClass} text-left text-[9px] font-semibold uppercase tracking-[0.05em]`}>Earnings</th>
            <th className={`${tableCellClass} text-left text-[9px] font-semibold uppercase tracking-[0.05em]`}>Amount</th>
            <th className={`${tableCellClass} text-left text-[9px] font-semibold uppercase tracking-[0.05em]`}>Deductions</th>
            <th className={`${tableCellClass} text-left text-[9px] font-semibold uppercase tracking-[0.05em]`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((row, index) => (
            <tr key={`${record._id}-${index}`}>
              <td className={tableCellClass}>{row.earning.label}</td>
              <td className={`${tableCellClass} text-right`}>{row.earning.amount === null ? "-" : currency.format(row.earning.amount)}</td>
              <td className={tableCellClass}>{row.deduction.label}</td>
              <td className={`${tableCellClass} text-right`}>{row.deduction.amount === null ? "-" : currency.format(row.deduction.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3">
        <table className="ml-auto w-full max-w-[64mm] border-collapse">
          <tbody>
            <tr><td className={labelCellClass}>Total Earnings</td><td className={`${tableCellClass} text-right font-semibold`}>{currency.format(totalEarnings)}</td></tr>
            <tr><td className={labelCellClass}>Total Deductions</td><td className={`${tableCellClass} text-right font-semibold`}>{currency.format(record.totalDeductions || 0)}</td></tr>
            <tr className="bg-emerald-50"><td className={`${tableCellClass} font-bold text-slate-950`}>Net Pay</td><td className={`${tableCellClass} text-right font-bold text-emerald-700`}>{currency.format(record.netSalary || 0)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-[10px] border border-slate-300 bg-slate-50 px-3 py-2 text-[10px] text-slate-700">
        <span className="font-semibold text-slate-950">Amount in Words:</span> {record.amountInWords || "-"}
      </div>
<footer className="pt-4 border-t border-slate-300 text-center text-[9px] text-slate-600">
  
  <p className="font-semibold text-slate-800 text-[10px] mb-1">
    {COMPANY_DETAILS.name}
  </p>

  <p className="mb-1">
    {COMPANY_DETAILS.address}
  </p>

  <p className="mb-1">
    Tel: {COMPANY_DETAILS.contact} | Email: {COMPANY_DETAILS.email} | URL: {COMPANY_DETAILS.website}
  </p>

  <p className="text-[8px] text-slate-500">
    {COMPANY_DETAILS.legal}
  </p>

</footer>
    </div>
  );
});

PayslipDocument.displayName = "PayslipDocument";

export default PayslipDocument;
