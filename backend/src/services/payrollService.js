import { LOGO_URL } from "../utils/logo.js";
import { renderPdfBufferFromHtml } from "../utils/pdfBrowser.js";
import { env } from "../config/env.js";
import { ATTENDANCE_STATUSES, sanitizeAttendanceSettings } from "./attendancePolicyService.js";

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
  const salaryType = ["monthly", "daily", "hourly"].includes(String(salaryStructure.salaryType))
    ? String(salaryStructure.salaryType)
    : "monthly";
  const monthlyGrossSalary = round2(toPositiveNumber(salaryStructure.monthlyGrossSalary || employee?.salary || 0));
  const dailyWage = round2(toPositiveNumber(salaryStructure.dailyWage));
  const hourlyWage = round2(toPositiveNumber(salaryStructure.hourlyWage));
  const standardDailyHours = Math.max(1, round2(toPositiveNumber(salaryStructure.standardDailyHours, 8)));

  return {
    salaryType,
    monthlyGrossSalary,
    dailyWage,
    hourlyWage,
    standardDailyHours,
    basicSalaryType: salaryStructure.basicSalaryType || "percentage",
    basicSalaryValue: round2(toPositiveNumber(salaryStructure.basicSalaryValue ?? 40)),
    hraType: salaryStructure.hraType || "percentage",
    hraValue: round2(toPositiveNumber(salaryStructure.hraValue ?? 40)),
    specialAllowanceType: salaryStructure.specialAllowanceType || "remainder",
    specialAllowanceValue: round2(toPositiveNumber(salaryStructure.specialAllowanceValue ?? 0)),
    allowances: round2(toPositiveNumber(salaryStructure.otherAllowance)),
    bonus: round2(toPositiveNumber(salaryStructure.bonus)),
    tax: round2(toPositiveNumber(salaryStructure.tax)),
    deductions: round2(toPositiveNumber(salaryStructure.deductions)),
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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const resolveSalaryBasisForPeriod = ({ salary, totalWorkingDays, standardDailyHours }) => {
  const safeWorkingDays = Math.max(totalWorkingDays, 1);
  const safeDailyHours = Math.max(standardDailyHours, 1);
  const monthlyReference =
    salary.salaryType === "daily"
      ? round2(salary.dailyWage * safeWorkingDays)
      : salary.salaryType === "hourly"
        ? round2(salary.hourlyWage * safeDailyHours * safeWorkingDays)
        : round2(salary.monthlyGrossSalary);
  const perDaySalary =
    salary.salaryType === "daily"
      ? round2(salary.dailyWage)
      : salary.salaryType === "hourly"
        ? round2(salary.hourlyWage * safeDailyHours)
        : round2(monthlyReference / safeWorkingDays);
  const perHourSalary =
    salary.salaryType === "hourly"
      ? round2(salary.hourlyWage)
      : round2(perDaySalary / safeDailyHours);

  return {
    monthlyReference,
    perDaySalary,
    perHourSalary,
    salaryBasisAmount:
      salary.salaryType === "daily"
        ? round2(salary.dailyWage)
        : salary.salaryType === "hourly"
          ? round2(salary.hourlyWage)
          : round2(salary.monthlyGrossSalary),
  };
};

const buildAttendanceMetrics = ({
  attendanceRows,
  totalWorkingDays,
  standardDailyHours,
  includePaidLeaveInWages,
  halfDayPayableFraction,
  incompleteDayPayableFraction,
  lateToHalfDayEnabled,
  lateToHalfDayThreshold,
}) => {
  let presentDays = 0;
  let lateDays = 0;
  let halfDays = 0;
  let leaveDays = 0;
  let incompleteDays = 0;
  let attendanceUnits = 0;
  let payableHours = 0;
  let overtimeHours = 0;

  for (const row of attendanceRows) {
    const rawHoursWorked = toPositiveNumber(row?.hoursWorked);
    const status = String(row?.status || "").trim().toLowerCase();
    const isIncomplete = Boolean(row?.isIncomplete);

    let attendanceFraction = 0;
    let creditedHours = 0;

    if (status === ATTENDANCE_STATUSES.HALF_DAY) {
      attendanceFraction = halfDayPayableFraction;
      halfDays = round2(halfDays + 1);
      creditedHours = round2(standardDailyHours * halfDayPayableFraction);
    } else if (status === ATTENDANCE_STATUSES.PRESENT) {
      presentDays = round2(presentDays + 1);
      attendanceFraction = isIncomplete ? incompleteDayPayableFraction : 1;
      creditedHours = isIncomplete
        ? round2(standardDailyHours * incompleteDayPayableFraction)
        : rawHoursWorked > 0
          ? Math.min(rawHoursWorked, standardDailyHours)
          : standardDailyHours;
    } else if (status === ATTENDANCE_STATUSES.LATE) {
      lateDays = round2(lateDays + 1);
      attendanceFraction = isIncomplete ? incompleteDayPayableFraction : 1;
      creditedHours = isIncomplete
        ? round2(standardDailyHours * incompleteDayPayableFraction)
        : rawHoursWorked > 0
          ? Math.min(rawHoursWorked, standardDailyHours)
          : standardDailyHours;
    } else if (status === ATTENDANCE_STATUSES.LEAVE) {
      leaveDays = round2(leaveDays + 1);
      if (includePaidLeaveInWages) {
        attendanceFraction = 1;
        creditedHours = standardDailyHours;
      }
    }

    if (isIncomplete) {
      incompleteDays = round2(incompleteDays + 1);
    }

    attendanceUnits = round2(attendanceUnits + attendanceFraction);
    payableHours = round2(payableHours + creditedHours);

    const extraHours = rawHoursWorked - standardDailyHours;
    if (extraHours > 0) {
      overtimeHours = round2(overtimeHours + extraHours);
    }
  }

  const latePenaltyDays =
    lateToHalfDayEnabled && lateToHalfDayThreshold > 0
      ? round2(Math.floor(lateDays / lateToHalfDayThreshold) * halfDayPayableFraction)
      : 0;
  const adjustedAttendanceUnits = round2(Math.max(attendanceUnits - latePenaltyDays, 0));
  const adjustedPayableHours = round2(Math.max(payableHours - latePenaltyDays * standardDailyHours, 0));
  const absentDays = round2(Math.max(totalWorkingDays - attendanceUnits, 0));

  return {
    presentDays,
    lateDays,
    halfDays,
    leaveDays,
    incompleteDays,
    latePenaltyDays,
    attendanceUnits,
    adjustedAttendanceUnits,
    payableHours,
    adjustedPayableHours,
    overtimeHours,
    absentDays,
  };
};

export const calculatePayrollRecord = ({ employee, attendanceRows, payrollSettings, attendanceSettings, period }) => {
  const salary = buildSalaryStructureSnapshot(employee);
  const { start, end } = getMonthRange(period.monthNumber, period.year);
  const totalWorkingDays = countWorkingDays(
    start,
    end,
    payrollSettings?.workingDaysMode,
    payrollSettings?.fixedWorkingDays
  );
  const standardDailyHours = Math.max(
    1,
    round2(toPositiveNumber(salary.standardDailyHours || payrollSettings?.standardDailyHours, 8))
  );
  const { monthlyReference, perDaySalary, perHourSalary, salaryBasisAmount } = resolveSalaryBasisForPeriod({
    salary,
    totalWorkingDays,
    standardDailyHours,
  });
  const attendanceMetrics = buildAttendanceMetrics({
    attendanceRows,
    totalWorkingDays,
    standardDailyHours,
    includePaidLeaveInWages: payrollSettings?.includePaidLeaveInWages !== false,
    halfDayPayableFraction: clamp(toPositiveNumber(payrollSettings?.halfDayPayableFraction, 0.5), 0, 1),
    incompleteDayPayableFraction: clamp(toPositiveNumber(payrollSettings?.incompleteDayPayableFraction, 0), 0, 1),
    lateToHalfDayEnabled: payrollSettings?.lateToHalfDayEnabled === true,
    lateToHalfDayThreshold: Math.max(0, Number(payrollSettings?.lateToHalfDayThreshold || 0)),
  });

  const grossReferenceAmount = monthlyReference;
  const fullBasicSalary = resolveComponentAmount({
    total: grossReferenceAmount,
    baseAmount: grossReferenceAmount,
    type: salary.basicSalaryType,
    value: salary.basicSalaryValue,
  });
  const fullHra = resolveComponentAmount({
    total: grossReferenceAmount,
    baseAmount: fullBasicSalary,
    type: salary.hraType,
    value: salary.hraValue,
  });
  const fullSpecialAllowance = resolveComponentAmount({
    total: grossReferenceAmount,
    baseAmount: grossReferenceAmount,
    type: salary.specialAllowanceType,
    value: salary.specialAllowanceValue,
    remainderBase: grossReferenceAmount - fullBasicSalary - fullHra,
  });
  const fullWages = round2(fullBasicSalary + fullHra + fullSpecialAllowance + salary.allowances);

  const payableDays =
    salary.salaryType === "hourly"
      ? round2(attendanceMetrics.adjustedPayableHours / standardDailyHours)
      : round2(attendanceMetrics.adjustedAttendanceUnits);
  const payableRatio =
    salary.salaryType === "hourly"
      ? (totalWorkingDays * standardDailyHours > 0 ? attendanceMetrics.adjustedPayableHours / (totalWorkingDays * standardDailyHours) : 0)
      : totalWorkingDays > 0
        ? payableDays / totalWorkingDays
        : 0;

  const earnedBasicSalary = round2(fullBasicSalary * payableRatio);
  const earnedHra = round2(fullHra * payableRatio);
  const earnedSpecialAllowance = round2(fullSpecialAllowance * payableRatio);
  const earnedAllowances = round2(salary.allowances * payableRatio);
  const earnedWages = round2(earnedBasicSalary + earnedHra + earnedSpecialAllowance + earnedAllowances);
  const overtimeRate =
    salary.overtimeRatePerHour > 0
      ? salary.overtimeRatePerHour
      : round2(perHourSalary);
  const overtimePay = round2(
    attendanceMetrics.overtimeHours * overtimeRate * Math.max(toPositiveNumber(payrollSettings?.overtimeMultiplier, 1), 0)
  );

  const finePerAbsentDay = salary.finePerAbsentDay || round2(toPositiveNumber(payrollSettings?.absentPenaltyAmount));
  const finePerLateMark = salary.finePerLateMark || round2(toPositiveNumber(payrollSettings?.latePenaltyAmount));
  const fineAmount = round2(attendanceMetrics.absentDays * finePerAbsentDay + attendanceMetrics.lateDays * finePerLateMark);

  const pfBaseWage = payrollSettings?.pf?.wageLimit > 0
    ? Math.min(earnedBasicSalary, toPositiveNumber(payrollSettings.pf.wageLimit))
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
  const grossSalary = round2(earnedWages + overtimePay + salary.bonus);
  const netSalary = round2(Math.max(0, earnedWages + overtimePay + salary.bonus - totalDeductions));
  const attendanceDeductionAmount = round2(Math.max(0, fullWages - earnedWages));
  const latePenaltyDeductionAmount = round2(perDaySalary * attendanceMetrics.latePenaltyDays);
  const halfDayDeductionAmount = round2(
    perDaySalary *
      attendanceMetrics.halfDays *
      Math.max(0, 1 - clamp(toPositiveNumber(payrollSettings?.halfDayPayableFraction, 0.5), 0, 1))
  );
  const incompleteDeductionAmount = round2(
    perDaySalary *
      attendanceMetrics.incompleteDays *
      Math.max(0, 1 - clamp(toPositiveNumber(payrollSettings?.incompleteDayPayableFraction, 0), 0, 1))
  );

  const earnings = [
    { label: "Basic Salary", amount: earnedBasicSalary },
    { label: "HRA", amount: earnedHra },
    { label: "Special Allowance", amount: earnedSpecialAllowance },
    { label: "Other Allowance", amount: earnedAllowances },
    { label: "Bonus", amount: salary.bonus },
    { label: "Overtime", amount: overtimePay },
  ];

  const deductionBreakdown = [
    { label: "Attendance Deduction", amount: attendanceDeductionAmount },
    { label: "Late Penalty Deduction", amount: latePenaltyDeductionAmount },
    { label: "Half Day Deduction", amount: halfDayDeductionAmount },
    { label: "Incomplete Attendance Deduction", amount: incompleteDeductionAmount },
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
    presentDays: attendanceMetrics.presentDays,
    lateDays: attendanceMetrics.lateDays,
    halfDays: attendanceMetrics.halfDays,
    absentDays: attendanceMetrics.absentDays,
    leaveDays: attendanceMetrics.leaveDays,
    incompleteDays: attendanceMetrics.incompleteDays,
    latePenaltyDays: attendanceMetrics.latePenaltyDays,
    attendanceUnits: attendanceMetrics.attendanceUnits,
    payableHours: attendanceMetrics.adjustedPayableHours,
    overtimeHours: attendanceMetrics.overtimeHours,
    totalWorkingDays,
    payableDays,
    salaryType: salary.salaryType,
    salaryBasisAmount,
    perDaySalary,
    perHourSalary,
    fullWages,
    earnedWages,
    earnedSalary: earnedWages,
    basicSalary: earnedBasicSalary,
    hra: earnedHra,
    allowances: earnedAllowances,
    specialAllowance: earnedSpecialAllowance,
    bonus: salary.bonus,
    grossSalary,
    overtimePay,
    employerPf,
    employerEsi,
    deductions: salary.deductions,
    tax: salary.tax,
    fineAmount,
    attendanceDeductionAmount,
    latePenaltyDeductionAmount,
    halfDayDeductionAmount,
    incompleteDeductionAmount,
    pfEmployee,
    esiEmployee,
    totalDeductions,
    attendanceSalary: earnedWages,
    netSalary,
    earnings: earnings.filter((item) => item.amount > 0),
    deductionBreakdown: deductionBreakdown.filter((item) => item.amount > 0),
    amountInWords: amountToWords(netSalary),
    status: "processed",
    payrollLocked: Boolean(payrollSettings?.freezePayrollOnGenerate),
    lockedAt: payrollSettings?.freezePayrollOnGenerate ? new Date() : null,
    processedAt: new Date(),
    policySnapshot: {
      attendance: sanitizeAttendanceSettings(attendanceSettings),
      payroll: {
        ...payrollSettings,
      },
    },
    paymentStatus: "unpaid",
    paidAmount: 0,
    unpaidAmount: netSalary,
    paymentHistory: [],
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
  const earnings = payroll.earnings?.length
    ? payroll.earnings
    : [
        { label: "Basic", amount: payroll.basicSalary || 0 },
        { label: "HRA", amount: payroll.hra || 0 },
        {
          label: "Allowance",
          amount:
            (payroll.specialAllowance || 0) +
            (payroll.allowances || 0) +
            (payroll.bonus || 0) +
            (payroll.overtimePay || 0),
        },
      ];

  const deductions = payroll.deductionBreakdown?.length
    ? payroll.deductionBreakdown
    : [
        { label: "PF", amount: payroll.pfEmployee || 0 },
        { label: "ESI", amount: payroll.esiEmployee || 0 },
        { label: "Fine / Tax / Other", amount: (payroll.fineAmount || 0) + (payroll.tax || 0) + (payroll.deductions || 0) + (payroll.advanceDeduction || 0) },
      ];

  return Array.from({ length: Math.max(earnings.length, deductions.length) }, (_, index) => ({
    earningLabel: earnings[index]?.label || "",
    earningAmount: earnings[index]?.amount || 0,
    deductionLabel: deductions[index]?.label || "",
    deductionAmount: deductions[index]?.amount || 0,
  }));
};

export const buildPayslipHtml = ({ payroll, company }) => {
  const companyName = company?.companyName || env.company?.name || "Company";
  const companyAddress = company?.address || "-";
  const companyEmail = company?.contactEmail || env.company?.supportEmail || "-";
  const companyPhone = company?.contactPhone || "-";
  const companyWebsite = company?.website || "-";
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
                <h1>${escapeHtml(companyName)}</h1>
                <p>${escapeHtml(companyAddress)}</p>
                <p>Tel.: ${escapeHtml(companyPhone)} | Email: ${escapeHtml(companyEmail)} | URL: ${escapeHtml(companyWebsite)}</p>
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
              <th>Half Days</th>
              <th>Absent Days</th>
              <th>Incomplete Days</th>
              <th>Leave Days</th>
              <th>Overtime Hours</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="amount">${payroll.presentDays}</td>
              <td class="amount">${payroll.lateDays || 0}</td>
              <td class="amount">${payroll.halfDays || 0}</td>
              <td class="amount">${payroll.absentDays}</td>
              <td class="amount">${payroll.incompleteDays || 0}</td>
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
            <p class="title">${escapeHtml(companyName)}</p>
            <p>${escapeHtml(companyAddress)}</p>
            <p>Tel.: ${escapeHtml(companyPhone)} | Email: ${escapeHtml(companyEmail)} | URL: ${escapeHtml(companyWebsite)}</p>
          </div>
        </div>
      </div>
    </body>
  </html>`;
};

export const generatePayslipPdfBuffer = async ({ payroll, company }) => {
  return renderPdfBufferFromHtml(buildPayslipHtml({ payroll, company }), {
    waitUntil: "domcontentloaded",
    pdfOptions: {
      format: "A4",
      scale: 0.86,
      printBackground: true,
      margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
    },
  });
};
