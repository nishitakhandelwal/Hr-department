import { Attendance } from "../models/Attendance.js";
import { Advance } from "../models/Advance.js";
import { Employee } from "../models/Employee.js";
import { Payroll } from "../models/Payroll.js";
import { ensureEmployeeProfileForUser } from "../services/employeeProfileService.js";
import { getSystemSettings, refreshSystemSettingsCache } from "../services/systemSettingsService.js";
import {
  amountToWords,
  buildSalaryStructureSnapshot,
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

const PAYROLL_ACTIVE_STATUSES = ["active", "active_employee"];
const ADVANCE_MAX_DEDUCTION_RATIO = 0.3;
const roundCurrency = (value) => Number(Number(value || 0).toFixed(2));

const getPayrollEligibleEmployeeFilter = (employeeScope = null) =>
  employeeScope ? { _id: employeeScope, status: { $in: PAYROLL_ACTIVE_STATUSES } } : { status: { $in: PAYROLL_ACTIVE_STATUSES } };

const hasSalaryAmount = (employee) => {
  const salarySnapshot = buildSalaryStructureSnapshot(employee);
  return Number(salarySnapshot.monthlyGrossSalary || 0) > 0;
};

const isPayrollReadyEmployee = (employee) => isSalaryConfigured(employee) && hasSalaryAmount(employee);
const syncAdvanceStatus = (advance) => {
  if (advance.status === "cancelled") {
    advance.remainingAmount = 0;
    return advance;
  }

  const remainingAmount = roundCurrency(advance.remainingAmount || 0);
  advance.remainingAmount = remainingAmount;

  if (remainingAmount <= 0) {
    advance.status = "completed";
    advance.remainingAmount = 0;
  } else if (remainingAmount < Number(advance.amount || 0)) {
    advance.status = "partially_deducted";
  } else {
    advance.status = "pending";
  }

  return advance;
};

const serializeAdvance = (advance) => ({
  _id: String(advance._id),
  employeeId: advance.employeeId?._id ? String(advance.employeeId._id) : String(advance.employeeId),
  employee: advance.employeeId
    ? {
        _id: String(advance.employeeId._id || advance.employeeId),
        employeeId: advance.employeeId.employeeId || "",
        fullName: advance.employeeId.fullName || advance.employeeId.userId?.name || "",
        designation: advance.employeeId.designation || "",
        department: advance.employeeId.departmentName || advance.employeeId.department || "",
      }
    : null,
  amount: Number(advance.amount || 0),
  remainingAmount: Number(advance.remainingAmount || 0),
  recoveredAmount: roundCurrency(Number(advance.amount || 0) - Number(advance.remainingAmount || 0)),
  status: advance.status || "pending",
  notes: advance.notes || "",
  deductions: Array.isArray(advance.deductions)
    ? advance.deductions.map((entry) => ({
        payrollId: entry.payrollId ? String(entry.payrollId) : "",
        monthNumber: Number(entry.monthNumber || 0),
        year: Number(entry.year || 0),
        amount: Number(entry.amount || 0),
        deductedAt: entry.deductedAt || null,
      }))
    : [],
  createdAt: advance.createdAt || null,
  updatedAt: advance.updatedAt || null,
});

const buildAdvanceQuery = async (user, query = {}) => {
  const employeeScope = await resolveEmployeeScope(user);
  return employeeScope ? { ...query, employeeId: employeeScope } : query;
};

const loadAdvances = async (query) =>
  Advance.find(query)
    .populate({
      path: "employeeId",
      select: "employeeId fullName designation department departmentName userId",
      populate: { path: "userId", select: "name email department" },
    })
    .sort({ createdAt: -1 });

const restoreAdvanceBalancesForPeriod = (existingPayroll, advanceMap, period) => {
  for (const record of existingPayroll) {
    const currentDeductions = Array.isArray(record.advanceDeductions) ? record.advanceDeductions : [];
    for (const deduction of currentDeductions) {
      const advance = advanceMap.get(String(deduction.advanceId));
      if (!advance) continue;

      advance.remainingAmount = roundCurrency(Number(advance.remainingAmount || 0) + Number(deduction.amount || 0));
      advance.deductions = (advance.deductions || []).filter((entry) => {
        const samePeriod = Number(entry.monthNumber) === period.monthNumber && Number(entry.year) === period.year;
        const sameAmount = roundCurrency(entry.amount) === roundCurrency(deduction.amount);
        return !(samePeriod && sameAmount);
      });
      syncAdvanceStatus(advance);
    }
  }
};

const applyAdvanceDeductionsToPayrollRecord = ({ payrollRecord, employeeAdvances, period, existingPayrollId }) => {
  const deductionCap = roundCurrency(Number(payrollRecord.netSalary || 0) * ADVANCE_MAX_DEDUCTION_RATIO);
  if (deductionCap <= 0 || !employeeAdvances.length) {
    return {
      payrollRecord: {
        ...payrollRecord,
        advanceDeduction: 0,
        advanceDeductions: [],
      },
      appliedDeductions: [],
    };
  }

  let remainingCap = deductionCap;
  const appliedDeductions = [];

  for (const advance of employeeAdvances) {
    if (remainingCap <= 0) break;
    if (advance.status === "cancelled") continue;

    const availableAmount = roundCurrency(advance.remainingAmount || 0);
    if (availableAmount <= 0) continue;

    const deductionAmount = roundCurrency(Math.min(availableAmount, remainingCap));
    if (deductionAmount <= 0) continue;

    advance.remainingAmount = roundCurrency(availableAmount - deductionAmount);
    advance.deductions = [
      ...(advance.deductions || []),
      {
        payrollId: existingPayrollId || null,
        monthNumber: period.monthNumber,
        year: period.year,
        amount: deductionAmount,
        deductedAt: new Date(),
      },
    ];
    syncAdvanceStatus(advance);

    appliedDeductions.push({
      advanceId: advance._id,
      amount: deductionAmount,
    });
    remainingCap = roundCurrency(remainingCap - deductionAmount);
  }

  const totalAdvanceDeduction = roundCurrency(
    appliedDeductions.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );
  const deductionBreakdown = [...(payrollRecord.deductionBreakdown || [])];
  if (totalAdvanceDeduction > 0) {
    deductionBreakdown.push({ label: "Advance Salary Recovery", amount: totalAdvanceDeduction });
  }

  const updatedNetSalary = roundCurrency(Math.max(0, Number(payrollRecord.netSalary || 0) - totalAdvanceDeduction));
  return {
    payrollRecord: {
      ...payrollRecord,
      advanceDeduction: totalAdvanceDeduction,
      advanceDeductions: appliedDeductions,
      totalDeductions: roundCurrency(Number(payrollRecord.totalDeductions || 0) + totalAdvanceDeduction),
      netSalary: updatedNetSalary,
      deductionBreakdown: deductionBreakdown.filter((item) => Number(item.amount || 0) > 0),
      amountInWords: amountToWords(updatedNetSalary),
    },
    appliedDeductions,
  };
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
  const employeeFilter = getPayrollEligibleEmployeeFilter(employeeScope);

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
      employeesMissingSalary: activeEmployees.filter((employee) => !isPayrollReadyEmployee(employee)).length,
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

export const listAdvances = async (req, res) => {
  const statusFilter = String(req.query.status || "").trim();
  const query = await buildAdvanceQuery(req.user, {});
  if (statusFilter) {
    query.status = statusFilter;
  }

  const advances = await loadAdvances(query);
  res.json({
    success: true,
    message: "Fetched salary advances",
    data: advances.map(serializeAdvance),
  });
};

export const createAdvance = async (req, res) => {
  const employee = await Employee.findById(req.body.employeeId).select("_id employeeId fullName userId designation department departmentName");
  if (!employee) {
    throw createError("Employee not found.", 404);
  }

  const amount = roundCurrency(req.body.amount);
  if (amount <= 0) {
    throw createError("Advance amount must be greater than zero.", 400);
  }

  const advance = await Advance.create({
    employeeId: employee._id,
    amount,
    remainingAmount: amount,
    notes: String(req.body.notes || "").trim(),
    status: "pending",
  });

  const savedAdvance = await loadAdvances({ _id: advance._id });
  res.status(201).json({
    success: true,
    message: "Advance salary created successfully.",
    data: serializeAdvance(savedAdvance[0]),
  });
};

export const updateAdvance = async (req, res) => {
  const advance = await Advance.findById(req.params.id);
  if (!advance) {
    throw createError("Advance not found.", 404);
  }

  if (typeof req.body.notes === "string") {
    advance.notes = req.body.notes.trim();
  }

  if (typeof req.body.status === "string") {
    advance.status = req.body.status;
    if (req.body.status === "cancelled" || req.body.status === "completed") {
      advance.remainingAmount = 0;
    }
  }

  if (req.body.remainingAmount !== undefined) {
    const remainingAmount = roundCurrency(req.body.remainingAmount);
    if (remainingAmount < 0 || remainingAmount > Number(advance.amount || 0)) {
      throw createError("Remaining amount must be between zero and the original advance amount.", 400);
    }
    advance.remainingAmount = remainingAmount;
  }

  syncAdvanceStatus(advance);
  await advance.save();

  const savedAdvance = await loadAdvances({ _id: advance._id });
  res.json({
    success: true,
    message: "Advance updated successfully.",
    data: serializeAdvance(savedAdvance[0]),
  });
};

export const runPayroll = async (req, res) => {
  const period = normalizePayrollPeriod(req.body?.month, req.body?.year);
  const settings = await getSystemSettings({ lean: true });
  const payrollSettings = sanitizePayrollSettings(settings.payroll);

  console.info("[Payroll] Starting payroll run", {
    monthNumber: period.monthNumber,
    year: period.year,
  });

  const activeEmployees = await Employee.find(getPayrollEligibleEmployeeFilter())
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
  const advances = await Advance.find({
    employeeId: { $in: employeeIds },
    $or: [
      { remainingAmount: { $gt: 0 } },
      { deductions: { $elemMatch: { monthNumber: period.monthNumber, year: period.year } } },
    ],
  }).sort({ createdAt: 1 });

  const payrollByEmployeeId = new Map(existingPayroll.map((record) => [String(record.employeeId), record]));
  const attendanceByEmployeeId = new Map();
  const advanceById = new Map(advances.map((advance) => [String(advance._id), advance]));
  const advancesByEmployeeId = new Map();
  for (const row of attendanceRows) {
    const key = String(row.employeeId);
    const current = attendanceByEmployeeId.get(key) || [];
    current.push(row);
    attendanceByEmployeeId.set(key, current);
  }
  for (const advance of advances) {
    const key = String(advance.employeeId);
    const current = advancesByEmployeeId.get(key) || [];
    current.push(advance);
    advancesByEmployeeId.set(key, current);
  }

  restoreAdvanceBalancesForPeriod(existingPayroll, advanceById, period);

  const payrollOperations = [];
  const skipped = [];
  let createdCount = 0;
  let updatedCount = 0;

    console.info("[Payroll] Loaded payroll context", {
      employeeCount: activeEmployees.length,
      existingRecords: existingPayroll.length,
      attendanceRows: attendanceRows.length,
      advances: advances.length,
      monthNumber: period.monthNumber,
      year: period.year,
    });

  for (const employee of activeEmployees) {
    const employeeKey = String(employee._id);

    if (!isSalaryConfigured(employee)) {
      skipped.push({
        employeeId: employee.employeeId,
        employeeName: getEmployeeDisplayName(employee),
        reason: "Salary structure not configured.",
      });
      console.info("[Payroll] Skipping employee without configured salary structure", {
        employeeId: employee.employeeId,
        employeeName: getEmployeeDisplayName(employee),
      });
      continue;
    }

    if (!hasSalaryAmount(employee)) {
      skipped.push({
        employeeId: employee.employeeId,
        employeeName: getEmployeeDisplayName(employee),
        reason: "Monthly salary amount is missing.",
      });
      console.info("[Payroll] Skipping employee without salary amount", {
        employeeId: employee.employeeId,
        employeeName: getEmployeeDisplayName(employee),
      });
      continue;
    }

    const monthlyAttendance = attendanceByEmployeeId.get(employeeKey) || [];
    const payrollRecordBase = calculatePayrollRecord({
      employee,
      attendanceRows: monthlyAttendance,
      payrollSettings,
      period,
    });
    const existingRecord = payrollByEmployeeId.get(employeeKey);
    const employeeAdvances = (advancesByEmployeeId.get(employeeKey) || []).filter(
      (advance) => advance.status !== "cancelled" && Number(advance.remainingAmount || 0) > 0
    );
    const { payrollRecord } = applyAdvanceDeductionsToPayrollRecord({
      payrollRecord: payrollRecordBase,
      employeeAdvances,
      period,
      existingPayrollId: existingRecord?._id || null,
    });

    if (existingRecord) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }

    payrollOperations.push({
      updateOne: {
        filter: {
          employeeId: employee._id,
          monthNumber: period.monthNumber,
          year: period.year,
        },
        update: {
          $set: payrollRecord,
        },
        upsert: true,
      },
    });
  }

  if (payrollOperations.length) {
    const writeResult = await Payroll.bulkWrite(payrollOperations, { ordered: false });
    console.info("[Payroll] Payroll bulk write completed", {
      monthNumber: period.monthNumber,
      year: period.year,
      matchedCount: writeResult.matchedCount,
      modifiedCount: writeResult.modifiedCount,
      upsertedCount: writeResult.upsertedCount,
      insertedCount: createdCount,
      updatedCount,
    });
  } else {
    console.info("[Payroll] No payroll operations generated", {
      monthNumber: period.monthNumber,
      year: period.year,
      skippedCount: skipped.length,
    });
  }

  if (advances.length) {
    await Promise.all(advances.map((advance) => {
      syncAdvanceStatus(advance);
      return advance.save();
    }));
  }

  const [records, activeEmployeesForSummary, updatedAdvances] = await Promise.all([
    loadPayrollRecords({ monthNumber: period.monthNumber, year: period.year }),
    Employee.find(getPayrollEligibleEmployeeFilter()).select("_id salaryStructure salary"),
    loadAdvances(await buildAdvanceQuery(req.user, {})),
  ]);

  const processedCount = payrollOperations.length;
  const skippedMissingSalaryCount = skipped.filter(
    (entry) => entry.reason === "Salary structure not configured." || entry.reason === "Monthly salary amount is missing."
  ).length;
  const verifiedRecordCount = records.length;

  console.info("[Payroll] Payroll verification complete", {
    monthNumber: period.monthNumber,
    year: period.year,
    processedCount,
    createdCount,
    updatedCount,
    skippedCount: skipped.length,
    verifiedRecordCount,
  });

  res.json({
    success: true,
    message:
      processedCount > 0
        ? `Payroll created/updated for ${processedCount} employee${processedCount === 1 ? "" : "s"}.`
        : "No payroll records were processed. Review skipped employees for details.",
    data: {
      processed: processedCount,
      created: createdCount,
      updated: updatedCount,
      verifiedRecordCount,
      advances: updatedAdvances.map(serializeAdvance),
      records,
      summary: {
        ...summarizePayroll(records, activeEmployeesForSummary),
        month: period.month,
        monthNumber: period.monthNumber,
        year: period.year,
        employeesMissingSalary: activeEmployeesForSummary.filter((employee) => !isPayrollReadyEmployee(employee)).length,
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
