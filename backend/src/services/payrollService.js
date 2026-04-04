import puppeteer from "puppeteer";
import { LOGO_URL } from "../utils/logo.js";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const round2 = (value) => Number(Number(value || 0).toFixed(2));

const toPositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const normalizePayrollPeriod = (monthValue, yearValue) => {
  const now = new Date();
  const monthNumber = Number(monthValue || now.getMonth() + 1);
  const year = Number(yearValue || now.getFullYear());

  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    const error = new Error("Invalid payroll month.");
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    const error = new Error("Invalid payroll year.");
    error.statusCode = 400;
    throw error;
  }

  return {
    monthNumber,
    year,
    month: MONTH_NAMES[monthNumber - 1],
  };
};

export const getMonthRange = (monthNumber, year) => ({
  start: new Date(year, monthNumber - 1, 1),
  end: new Date(year, monthNumber, 1),
});

export const countWorkingDays = (start, end, mode = "weekdays", fixedWorkingDays = 26) => {
  if (mode === "fixed") return toPositiveNumber(fixedWorkingDays, 26);
  if (mode === "calendar") {
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }

  let total = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
};

const amountToWordsUnder1000 = (num) => {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) return `${tens[Math.floor(num / 10)]}${num % 10 ? ` ${ones[num % 10]}` : ""}`.trim();
  return `${ones[Math.floor(num / 100)]} Hundred${num % 100 ? ` ${amountToWordsUnder1000(num % 100)}` : ""}`.trim();
};

export const amountToWords = (amount) => {
  const integerAmount = Math.floor(toPositiveNumber(amount));
  if (integerAmount === 0) return "Zero Rupees Only";

  const crore = Math.floor(integerAmount / 10000000);
  const lakh = Math.floor((integerAmount % 10000000) / 100000);
  const thousand = Math.floor((integerAmount % 100000) / 1000);
  const remainder = integerAmount % 1000;

  const parts = [];
  if (crore) parts.push(`${amountToWordsUnder1000(crore)} Crore`);
  if (lakh) parts.push(`${amountToWordsUnder1000(lakh)} Lakh`);
  if (thousand) parts.push(`${amountToWordsUnder1000(thousand)} Thousand`);
  if (remainder) parts.push(amountToWordsUnder1000(remainder));

  return `${parts.join(" ").trim()} Rupees Only`;
};

const resolveComponentAmount = ({ total, baseAmount, type, value, remainderBase = 0 }) => {
  if (type === "fixed") return round2(value);
  if (type === "percentage") return round2((baseAmount || total) * (toPositiveNumber(value) / 100));
  if (type === "remainder") return round2(Math.max(0, remainderBase));
  return 0;
};

export const buildSalaryStructureSnapshot = (employee) => {
  const salaryStructure = employee?.salaryStructure || {};
  const monthlyGrossSalary = toPositiveNumber(salaryStructure.monthlyGrossSalary || employee?.salary || 0);
  const basicSalary = resolveComponentAmount({
    total: monthlyGrossSalary,
    baseAmount: monthlyGrossSalary,
    type: salaryStructure.basicSalaryType || "percentage",
    value: salaryStructure.basicSalaryValue ?? 40,
  });
  const hra = resolveComponentAmount({
    total: monthlyGrossSalary,
    baseAmount: basicSalary,
    type: salaryStructure.hraType || "percentage",
    value: salaryStructure.hraValue ?? 40,
  });
  const specialAllowance = resolveComponentAmount({
    total: monthlyGrossSalary,
    baseAmount: monthlyGrossSalary,
    type: salaryStructure.specialAllowanceType || "remainder",
    value: salaryStructure.specialAllowanceValue ?? 0,
    remainderBase: monthlyGrossSalary - basicSalary - hra,
  });
  const allowances = round2(toPositiveNumber(salaryStructure.otherAllowance));
  const bonus = round2(toPositiveNumber(salaryStructure.bonus));
  const tax = round2(toPositiveNumber(salaryStructure.tax));
  const deductions = round2(toPositiveNumber(salaryStructure.deductions));

  return {
    monthlyGrossSalary,
    basicSalary,
    hra,
    specialAllowance,
    allowances,
    bonus,
    tax,
    deductions,
    pfEnabled: Boolean(salaryStructure.pfEnabled),
    esiEnabled: Boolean(salaryStructure.esiEnabled),
    finePerAbsentDay: round2(toPositiveNumber(salaryStructure.finePerAbsentDay)),
    finePerLateMark: round2(toPositiveNumber(salaryStructure.finePerLateMark)),
    overtimeRatePerHour: round2(toPositiveNumber(salaryStructure.overtimeRatePerHour)),
    isConfigured: Boolean(salaryStructure.isConfigured),
  };
};

export const isSalaryConfigured = (employee) => Boolean(buildSalaryStructureSnapshot(employee).isConfigured);

export const getEmployeeDisplayName = (employee) => employee?.userId?.name || employee?.fullName || employee?.employeeId || "Employee";

export const buildPayrollId = (employeeCode, monthNumber, year) =>
  `PAY-${year}${String(monthNumber).padStart(2, "0")}-${employeeCode}`;

export const calculatePayrollRecord = ({ employee, attendanceRows, payrollSettings, period }) => {
  const salary = buildSalaryStructureSnapshot(employee);
  const presentDays = attendanceRows.filter((row) => row.status === "present").length;
  const lateDays = attendanceRows.filter((row) => row.status === "late").length;
  const absentDays = attendanceRows.filter((row) => row.status === "absent").length;
  const leaveDays = attendanceRows.filter((row) => row.status === "leave").length;
  const overtimeHours = round2(
    attendanceRows.reduce((sum, row) => {
      const extra = Number(row.hoursWorked || 0) - toPositiveNumber(payrollSettings?.standardDailyHours, 8);
      return sum + (extra > 0 ? extra : 0);
    }, 0)
  );

  const { start, end } = getMonthRange(period.monthNumber, period.year);
  const totalWorkingDays = countWorkingDays(
    start,
    end,
    payrollSettings?.workingDaysMode,
    payrollSettings?.fixedWorkingDays
  );
  const payableDays = Math.min(
    totalWorkingDays,
    presentDays + lateDays + (payrollSettings?.includePaidLeaveInWages !== false ? leaveDays : 0)
  );

  const fullWages = round2(salary.basicSalary + salary.hra + salary.specialAllowance + salary.allowances);
  const earnedWages = totalWorkingDays > 0 ? round2((fullWages / totalWorkingDays) * payableDays) : 0;
  const overtimeRate =
    salary.overtimeRatePerHour > 0
      ? salary.overtimeRatePerHour
      : round2((fullWages / Math.max(totalWorkingDays, 1)) / Math.max(toPositiveNumber(payrollSettings?.standardDailyHours, 8), 1));
  const overtimePay = round2(overtimeHours * overtimeRate * Math.max(toPositiveNumber(payrollSettings?.overtimeMultiplier, 1), 0));

  const finePerAbsentDay = salary.finePerAbsentDay || round2(toPositiveNumber(payrollSettings?.absentPenaltyAmount));
  const finePerLateMark = salary.finePerLateMark || round2(toPositiveNumber(payrollSettings?.latePenaltyAmount));
  const fineAmount = round2(absentDays * finePerAbsentDay + lateDays * finePerLateMark);

  const pfBaseWage = payrollSettings?.pf?.wageLimit > 0
    ? Math.min(earnedWages, toPositiveNumber(payrollSettings.pf.wageLimit))
    : earnedWages;
  const pfEmployee = salary.pfEnabled && payrollSettings?.pf?.enabled
    ? round2(pfBaseWage * (toPositiveNumber(payrollSettings.pf.employeeRate) / 100))
    : 0;
  const employerPf = salary.pfEnabled && payrollSettings?.pf?.enabled
    ? round2(pfBaseWage * (toPositiveNumber(payrollSettings.pf.employerRate) / 100))
    : 0;

  const esiEligibleWage = payrollSettings?.esi?.wageLimit > 0
    ? earnedWages <= toPositiveNumber(payrollSettings.esi.wageLimit)
    : true;
  const esiEmployee = salary.esiEnabled && payrollSettings?.esi?.enabled && esiEligibleWage
    ? round2(earnedWages * (toPositiveNumber(payrollSettings.esi.employeeRate) / 100))
    : 0;
  const employerEsi = salary.esiEnabled && payrollSettings?.esi?.enabled && esiEligibleWage
    ? round2(earnedWages * (toPositiveNumber(payrollSettings.esi.employerRate) / 100))
    : 0;

  const totalDeductions = round2(salary.deductions + salary.tax + fineAmount + pfEmployee + esiEmployee);
  const grossSalary = round2(fullWages + salary.bonus);
  const netSalary = round2(Math.max(0, earnedWages + overtimePay + salary.bonus - totalDeductions));

  const earnings = [
    { label: "Basic Salary", amount: salary.basicSalary },
    { label: "HRA", amount: salary.hra },
    { label: "Special Allowance", amount: salary.specialAllowance },
    { label: "Other Allowance", amount: salary.allowances },
    { label: "Bonus", amount: salary.bonus },
    { label: "Overtime", amount: overtimePay },
  ];

  const deductionBreakdown = [
    { label: "PF", amount: pfEmployee },
    { label: "ESI", amount: esiEmployee },
    { label: "Fine / Penalty", amount: fineAmount },
    { label: "Other Deductions", amount: salary.deductions },
    { label: "Tax", amount: salary.tax },
  ];

  return {
    payrollId: buildPayrollId(employee.employeeId, period.monthNumber, period.year),
    employeeId: employee._id,
    employeeName: getEmployeeDisplayName(employee),
    employeeCode: employee.employeeId || "",
    department: employee.departmentName || employee.department || employee.userId?.department || "",
    designation: employee.designation || "",
    joiningDate: employee.joiningDate || null,
    location: employee.address?.presentAddress || employee.address?.permanentAddress || "",
    bankDetails: employee.bankDetails || {},
    month: period.month,
    monthNumber: period.monthNumber,
    year: period.year,
    presentDays,
    lateDays,
    absentDays,
    leaveDays,
    overtimeHours,
    totalWorkingDays,
    payableDays,
    fullWages,
    earnedWages,
    basicSalary: salary.basicSalary,
    hra: salary.hra,
    allowances: salary.allowances,
    specialAllowance: salary.specialAllowance,
    bonus: salary.bonus,
    grossSalary,
    overtimePay,
    employerPf,
    employerEsi,
    deductions: salary.deductions,
    tax: salary.tax,
    fineAmount,
    pfEmployee,
    esiEmployee,
    totalDeductions,
    attendanceSalary: earnedWages,
    netSalary,
    earnings: earnings.filter((item) => item.amount > 0),
    deductionBreakdown: deductionBreakdown.filter((item) => item.amount > 0),
    amountInWords: amountToWords(netSalary),
    status: "processed",
  };
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const maskAccountNumber = (value) => {
  const raw = String(value || "");
  if (!raw) return "-";
  if (raw.length <= 4) return raw;
  return `${"*".repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}`;
};

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-GB") : "-");

const formatTimestamp = (value = new Date()) =>
  new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const buildBankDetailsText = (bankDetails = {}) => {
  const parts = [
    bankDetails.bankName,
    bankDetails.accountHolderName,
    bankDetails.accountNumber ? `A/C ${maskAccountNumber(bankDetails.accountNumber)}` : "",
    bankDetails.ifscCode ? `IFSC ${bankDetails.ifscCode}` : "",
  ].filter(Boolean);

  return parts.length ? parts.join(" | ") : "-";
};

const buildEarningDeductionRows = (payroll) => {
  const earnings = [
    { label: "Basic", amount: payroll.basicSalary || 0 },
    { label: "HRA", amount: payroll.hra || 0 },
    { label: "Allowance", amount: (payroll.specialAllowance || 0) + (payroll.allowances || 0) + (payroll.bonus || 0) + (payroll.overtimePay || 0) },
  ];

  const deductions = [
    { label: "PF", amount: payroll.pfEmployee || 0 },
    { label: "ESI", amount: payroll.esiEmployee || 0 },
    { label: "Fine / Tax / Other", amount: (payroll.fineAmount || 0) + (payroll.tax || 0) + (payroll.deductions || 0) },
  ];

  return Array.from({ length: Math.max(earnings.length, deductions.length) }, (_, index) => ({
    earningLabel: earnings[index]?.label || "",
    earningAmount: earnings[index]?.amount || 0,
    deductionLabel: deductions[index]?.label || "",
    deductionAmount: deductions[index]?.amount || 0,
  }));
};

export const buildPayslipHtml = ({ payroll, company }) => {
  const payPeriod = `${payroll.month} ${payroll.year}`;
  const earningsDeductionsRows = buildEarningDeductionRows(payroll)
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.earningLabel || "-")}</td>
          <td class="amount">${row.earningLabel ? currency.format(row.earningAmount || 0) : "-"}</td>
          <td>${escapeHtml(row.deductionLabel || "-")}</td>
          <td class="amount">${row.deductionLabel ? currency.format(row.deductionAmount || 0) : "-"}</td>
        </tr>
      `
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Salary Slip ${escapeHtml(payroll.employeeCode)}</title>
      <style>
        @page { size: A4; margin: 10mm; }
        body {
          margin: 0;
          color: #0f172a;
          background: #ffffff;
          font-family: Arial, Helvetica, sans-serif;
        }
        .sheet {
          background: white;
          width: 188mm;
          margin: 0 auto;
          padding: 6mm 7mm 5mm;
          box-sizing: border-box;
        }
        .header-table,
        .meta-table,
        .details-layout,
        .details-table,
        .main-table,
        .summary-table {
          width: 100%;
          border-collapse: collapse;
        }
        .header-table {
          table-layout: fixed;
          border-bottom: 1px solid #cbd5e1;
        }
        .header-table td {
          vertical-align: top;
          padding-bottom: 12px;
        }
        .company-cell {
          padding-right: 12px;
        }
        .logo-cell {
          width: 96px;
          text-align: right;
        }
        .logo {
          width: 80px;
          height: 80px;
          display: block;
          margin: 2px 0 0 auto;
          object-fit: contain;
        }
        .company h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }
        .company p {
          margin: 1px 0 0;
          font-size: 9.5px;
          color: #334155;
          line-height: 1.35;
        }
        .meta {
          margin-top: 16px;
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          border-radius: 12px;
        }
        .meta-table td {
          width: 50%;
          vertical-align: top;
        }
        .meta-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #64748b;
        }
        .meta-value {
          margin-top: 2px;
          font-size: 12px;
          font-weight: 700;
        }
        .section-title {
          margin: 10px 0 6px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .details-layout td {
          width: 50%;
          vertical-align: top;
        }
        .details-layout td:first-child {
          padding-right: 5px;
        }
        .details-layout td:last-child {
          padding-left: 5px;
        }
        .details-table td, .main-table th, .main-table td, .summary-table td {
          border: 1px solid #cbd5e1;
          padding: 4px 5px;
          font-size: 10px;
        }
        .details-table td.label {
          width: 32%;
          font-weight: 700;
          background: #f8fafc;
        }
        .details-table td.value {
          width: 68%;
        }
        .main-table th {
          background: #e2e8f0;
          text-transform: uppercase;
          font-size: 9px;
          letter-spacing: 0.05em;
          text-align: left;
        }
        .amount {
          text-align: right;
          font-weight: 600;
          white-space: nowrap;
        }
        .summary {
          margin-top: 8px;
        }
        .summary-table {
          width: 64mm;
          margin-left: auto;
        }
        .summary-table td.label {
          font-weight: 700;
          background: #f8fafc;
        }
        .summary-table tr.net-pay td {
          font-weight: 700;
          background: #ecfdf5;
          color: #047857;
        }
        .words {
          margin-top: 8px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          padding: 7px 8px;
          font-size: 10px;
          border-radius: 10px;
        }
        .footer {
          margin-top: 16px;
          font-size: 8.8px;
          color: #475569;
          border-top: 1px solid #cbd5e1;
          padding-top: 6px;
          text-align: center;
          line-height: 1.3;
        }
        .footer p {
          margin: 1px 0;
        }
        .footer .title {
          font-weight: 700;
          color: #334155;
        }
        .bottom-section {
          page-break-inside: avoid;
        }
        .main-table tr {
          page-break-inside: avoid;
        }
        .footer, .words, .summary {
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <table class="header-table">
          <tr>
            <td class="company-cell">
              <div class="company">
                <h1>Arihant Dream Infra Project Ltd.</h1>
                <p>An ISO 9001:2008 Certified Company</p>
                <p>2nd Floor,Class of Pearl,Income Tax Colony, Tonk Road, Jaipur</p>
                <p>CIN: U70101RJ2011PLC035322 | GST: 08AAJCA5226A1Z3</p>
                <p>Tel.: 0141-2970900 | Email: info@arihantgroupjaipur.com | URL: www.arihantgroupjaipur.com</p>
              </div>
            </td>
            <td class="logo-cell">
              <img src="${LOGO_URL}" alt="Company Logo" class="logo" />
            </td>
          </tr>
        </table>

        <div class="meta">
          <table class="meta-table">
            <tr>
              <td>
                <div class="meta-label">Payslip For</div>
                <div class="meta-value">${escapeHtml(payPeriod)}</div>
              </td>
              <td>
                <div class="meta-label">Payslip ID</div>
                <div class="meta-value">${escapeHtml(payroll.payrollId)}</div>
              </td>
            </tr>
          </table>
        </div>

        <div class="section-title">Employee Details</div>
        <table class="details-layout">
          <tr>
            <td>
              <table class="details-table">
                <tr><td class="label">Employee Name</td><td class="value">${escapeHtml(payroll.employeeName)}</td></tr>
                <tr><td class="label">Employee ID</td><td class="value">${escapeHtml(payroll.employeeCode || "-")}</td></tr>
                <tr><td class="label">Department</td><td class="value">${escapeHtml(payroll.department || "-")}</td></tr>
                <tr><td class="label">Designation</td><td class="value">${escapeHtml(payroll.designation || "-")}</td></tr>
              </table>
            </td>
            <td>
              <table class="details-table">
                <tr><td class="label">Joining Date</td><td class="value">${escapeHtml(formatDate(payroll.joiningDate))}</td></tr>
                <tr><td class="label">Location</td><td class="value">${escapeHtml(payroll.location || "-")}</td></tr>
                <tr><td class="label">Payable Days</td><td class="value">${escapeHtml(`${payroll.payableDays || 0} / ${payroll.totalWorkingDays || 0}`)}</td></tr>
                <tr><td class="label">Bank Details</td><td class="value">${escapeHtml(buildBankDetailsText(payroll.bankDetails))}</td></tr>
              </table>
            </td>
          </tr>
        </table>

        <div class="section-title">Attendance Summary</div>
        <table class="main-table">
          <thead>
            <tr>
              <th>Present Days</th>
              <th>Late Days</th>
              <th>Absent Days</th>
              <th>Leave Days</th>
              <th>Overtime Hours</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="amount">${payroll.presentDays}</td>
              <td class="amount">${payroll.lateDays || 0}</td>
              <td class="amount">${payroll.absentDays}</td>
              <td class="amount">${payroll.leaveDays}</td>
              <td class="amount">${payroll.overtimeHours || 0}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">Earnings And Deductions</div>
        <table class="main-table">
          <thead>
            <tr>
              <th>Earnings</th>
              <th>Amount</th>
              <th>Deductions</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${earningsDeductionsRows}
          </tbody>
        </table>

        <div class="bottom-section">
          <div class="summary">
            <table class="summary-table">
              <tr>
                <td class="label">Total Earnings</td>
                <td class="amount">${currency.format((payroll.basicSalary || 0) + (payroll.hra || 0) + (payroll.specialAllowance || 0) + (payroll.allowances || 0) + (payroll.bonus || 0) + (payroll.overtimePay || 0))}</td>
              </tr>
              <tr>
                <td class="label">Total Deductions</td>
                <td class="amount">${currency.format(payroll.totalDeductions || 0)}</td>
              </tr>
              <tr class="net-pay">
                <td class="label">Net Pay</td>
                <td class="amount">${currency.format(payroll.netSalary || 0)}</td>
              </tr>
            </table>
          </div>

          <div class="words">
            <strong>Amount in Words:</strong> ${escapeHtml(payroll.amountInWords || amountToWords(payroll.netSalary || 0))}
          </div>

          <div class="footer">
            <p class="title">Arihant Dream Infra Project Ltd.</p>
            <p>2nd Floor,Class of Pearl,Income Tax Colony, Tonk Road, Jaipur</p>
            <p>Tel.: 0141-2970900 | Email: info@arihantgroupjaipur.com | URL: www.arihantgroupjaipur.com</p>
            <p>CIN: U70101RJ2011PLC035322 | GST: 08AAJCA5226A1Z3</p>
          </div>
        </div>
      </div>
    </body>
  </html>`;
};

export const generatePayslipPdfBuffer = async ({ payroll, company }) => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildPayslipHtml({ payroll, company }), { waitUntil: "networkidle0" });
    const pdfRaw = await page.pdf({
      format: "A4",
      scale: 0.86,
      printBackground: true,
      margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
    });
    return Buffer.isBuffer(pdfRaw) ? pdfRaw : Buffer.from(pdfRaw);
  } finally {
    await browser.close();
  }
};
