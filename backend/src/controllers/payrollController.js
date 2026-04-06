import { Attendance } from "../models/Attendance.js";
import { Employee } from "../models/Employee.js";
import { Payroll } from "../models/Payroll.js";
import { ensureEmployeeProfileForUser } from "../services/employeeProfileService.js";
import { getSystemSettings, refreshSystemSettingsCache } from "../services/systemSettingsService.js";
import {
  calculatePayrollRecord,
  generatePayslipPdfBuffer,
  getEmployeeDisplayName,
  isSalaryConfigured,
  normalizePayrollPeriod,
} from "../services/payrollService.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const resolveEmployeeScope = async (user) => {
  if (!user || user.role !== "employee") return null;
  const employee = await ensureEmployeeProfileForUser(user);
  return employee?._id || null;
};

const buildPayrollQuery = async (user, query = {}) => {
  const employeeScope = await resolveEmployeeScope(user);
  return employeeScope ? { ...query, employeeId: employeeScope } : query;
};

const loadPayrollRecords = async (query) =>
  Payroll.find(query)
    .populate({
      path: "employeeId",
      populate: { path: "userId", select: "name email department" },
    })
    .sort({ year: -1, monthNumber: -1, createdAt: -1 });

const summarizePayroll = (records, activeEmployees) => {
  const processedEmployeeIds = new Set(records.map((record) => String(record.employeeId?._id || record.employeeId)));
  return {
    totalPayroll: records.reduce((sum, record) => sum + Number(record.netSalary || 0), 0),
    processedEmployees: processedEmployeeIds.size,
    pendingEmployees: activeEmployees.filter((employee) => !processedEmployeeIds.has(String(employee._id))).length,
  };
};

const sanitizePayrollSettings = (settings) => ({
  workingDaysMode: settings?.workingDaysMode || "weekdays",
  fixedWorkingDays: Number(settings?.fixedWorkingDays || 26),
  standardDailyHours: Number(settings?.standardDailyHours || 8),
  includePaidLeaveInWages: settings?.includePaidLeaveInWages !== false,
  latePenaltyAmount: Number(settings?.latePenaltyAmount || 0),
  absentPenaltyAmount: Number(settings?.absentPenaltyAmount || 0),
  overtimeMultiplier: Number(settings?.overtimeMultiplier || 1),
  pf: {
    enabled: settings?.pf?.enabled !== false,
    employeeRate: Number(settings?.pf?.employeeRate || 0),
    employerRate: Number(settings?.pf?.employerRate || 0),
    wageLimit: Number(settings?.pf?.wageLimit || 0),
  },
  esi: {
    enabled: Boolean(settings?.esi?.enabled),
    employeeRate: Number(settings?.esi?.employeeRate || 0),
    employerRate: Number(settings?.esi?.employerRate || 0),
    wageLimit: Number(settings?.esi?.wageLimit || 0),
  },
});

export const getPayroll = async (req, res) => {
  const period = normalizePayrollPeriod(req.query.month, req.query.year);
  const query = await buildPayrollQuery(req.user, {
    monthNumber: period.monthNumber,
    year: period.year,
  });
  const data = await loadPayrollRecords(query);
  res.json({ success: true, message: "Fetched payroll", data });
};

export const getPayrollSummary = async (req, res) => {
  const period = normalizePayrollPeriod(req.query.month, req.query.year);
  const employeeScope = await resolveEmployeeScope(req.user);
  const employeeFilter = employeeScope ? { _id: employeeScope, status: "active" } : { status: "active" };

  const [activeEmployees, records] = await Promise.all([
    Employee.find(employeeFilter).select("_id salaryStructure"),
    loadPayrollRecords(await buildPayrollQuery(req.user, { monthNumber: period.monthNumber, year: period.year })),
  ]);

  const summary = summarizePayroll(records, activeEmployees);
  res.json({
    success: true,
    message: "Fetched payroll summary",
    data: {
      ...summary,
      month: period.month,
      monthNumber: period.monthNumber,
      year: period.year,
      employeesMissingSalary: activeEmployees.filter((employee) => !isSalaryConfigured(employee)).length,
    },
  });
};

export const getPayrollConfig = async (_req, res) => {
  const settings = await getSystemSettings({ lean: true });
  res.json({
    success: true,
    message: "Fetched payroll configuration",
    data: sanitizePayrollSettings(settings.payroll),
  });
};

export const updatePayrollConfig = async (req, res) => {
  const settings = await getSystemSettings();
  settings.payroll = {
    ...sanitizePayrollSettings(settings.payroll),
    ...sanitizePayrollSettings(req.body || {}),
    pf: {
      ...sanitizePayrollSettings(settings.payroll).pf,
      ...sanitizePayrollSettings(req.body || {}).pf,
    },
    esi: {
      ...sanitizePayrollSettings(settings.payroll).esi,
      ...sanitizePayrollSettings(req.body || {}).esi,
    },
  };
  await settings.save();
  await refreshSystemSettingsCache();

  res.json({
    success: true,
    message: "Payroll configuration updated successfully.",
    data: sanitizePayrollSettings(settings.payroll),
  });
};

export const runPayroll = async (req, res) => {
  const period = normalizePayrollPeriod(req.body?.month, req.body?.year);
  const settings = await getSystemSettings({ lean: true });
  const payrollSettings = sanitizePayrollSettings(settings.payroll);

  const activeEmployees = await Employee.find({ status: "active" })
    .populate("userId", "name email department")
    .sort({ createdAt: -1 });

  if (!activeEmployees.length) {
    throw createError("No active employees found.", 400);
  }

  const employeeIds = activeEmployees.map((employee) => employee._id);
  const monthStart = new Date(period.year, period.monthNumber - 1, 1);
  const monthEnd = new Date(period.year, period.monthNumber, 1);

  const [existingPayroll, attendanceRows] = await Promise.all([
    Payroll.find({ employeeId: { $in: employeeIds }, monthNumber: period.monthNumber, year: period.year }),
    Attendance.find({
      employeeId: { $in: employeeIds },
      date: { $gte: monthStart, $lt: monthEnd },
    }).sort({ date: 1 }),
  ]);

  const payrollByEmployeeId = new Map(existingPayroll.map((record) => [String(record.employeeId), record]));
  const attendanceByEmployeeId = new Map();
  for (const row of attendanceRows) {
    const key = String(row.employeeId);
    const current = attendanceByEmployeeId.get(key) || [];
    current.push(row);
    attendanceByEmployeeId.set(key, current);
  }

  const payrollDocuments = [];
  const skipped = [];

  for (const employee of activeEmployees) {
    const employeeKey = String(employee._id);

    if (payrollByEmployeeId.has(employeeKey)) {
      skipped.push({
        employeeId: employee.employeeId,
        employeeName: getEmployeeDisplayName(employee),
        reason: "Payroll already processed for this month.",
      });
      continue;
    }

    if (!isSalaryConfigured(employee)) {
      skipped.push({
        employeeId: employee.employeeId,
        employeeName: getEmployeeDisplayName(employee),
        reason: "Salary structure not configured.",
      });
      continue;
    }

    const monthlyAttendance = attendanceByEmployeeId.get(employeeKey) || [];
    payrollDocuments.push(
      calculatePayrollRecord({
        employee,
        attendanceRows: monthlyAttendance,
        payrollSettings,
        period,
      })
    );
  }

  if (payrollDocuments.length) {
    await Payroll.insertMany(payrollDocuments, { ordered: false });
  }

  const [records, activeEmployeesForSummary] = await Promise.all([
    loadPayrollRecords({ monthNumber: period.monthNumber, year: period.year }),
    Employee.find({ status: "active" }).select("_id salaryStructure"),
  ]);

  const processedCount = payrollDocuments.length;
  const skippedMissingSalaryCount = skipped.filter((entry) => entry.reason === "Salary structure not configured.").length;

  res.json({
    success: true,
    message:
      processedCount > 0
        ? `Payroll processed for ${processedCount} employee${processedCount === 1 ? "" : "s"}.`
        : "No payroll records were processed. Review skipped employees for details.",
    data: {
      processed: processedCount,
      records,
      summary: {
        ...summarizePayroll(records, activeEmployeesForSummary),
        month: period.month,
        monthNumber: period.monthNumber,
        year: period.year,
        employeesMissingSalary: activeEmployeesForSummary.filter((employee) => !isSalaryConfigured(employee)).length,
      },
      skippedCount: skipped.length,
      skippedMissingSalary: skippedMissingSalaryCount,
      skippedEmployees: skipped,
      skipped,
    },
  });
};

export const downloadPayslipPdf = async (req, res) => {
  const record = await Payroll.findById(req.params.id).lean();
  if (!record) {
    return res.status(404).json({ success: false, message: "Payroll record not found." });
  }

  if (req.user?.role === "employee") {
    const employee = await ensureEmployeeProfileForUser(req.user);
    if (!employee || String(employee._id) !== String(record.employeeId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
  }

  const settings = await getSystemSettings({ lean: true });
  const pdfBuffer = await generatePayslipPdfBuffer({ payroll: record, company: settings.company });
  const fileName = `${record.employeeCode || record.employeeName}-${record.month}-${record.year}-salary-slip.pdf`
    .replace(/[^a-zA-Z0-9._-]+/g, "-");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Length", String(pdfBuffer.length));
  return res.status(200).send(pdfBuffer);
};
