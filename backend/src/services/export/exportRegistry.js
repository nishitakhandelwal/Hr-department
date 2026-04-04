import fs from "fs/promises";
import path from "path";
import { Candidate } from "../../models/Candidate.js";
import { Attendance } from "../../models/Attendance.js";
import { Employee } from "../../models/Employee.js";
import { Payroll } from "../../models/Payroll.js";
import { Leave } from "../../models/Leave.js";
import { Department } from "../../models/Department.js";
import { Offboarding } from "../../models/Offboarding.js";
import { serverRoot } from "../../utils/paths.js";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const capitalize = (value) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "";
};

const formatDate = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
};

const formatShortDate = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateInputValue = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const includesSearch = (values, term) => {
  if (!term) return true;
  return values.some((value) => normalizeText(value).includes(term));
};

const calculateLeaveDays = (fromDate, toDate) => {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
};

const parseMonthFilter = (value) => {
  const [yearRaw, monthRaw] = String(value || "").split("-");
  const year = Number(yearRaw);
  const monthNumber = Number(monthRaw);
  if (!year || !monthNumber) return null;
  return { year, monthNumber };
};

let cachedLogoDataUri = "";
let logoLoadPromise = null;

const resolveLogoFile = async () => {
  const candidatePaths = [
    path.join(serverRoot, "..", "frontend", "public", "logo.png"),
    path.join(serverRoot, "..", "frontend", "public", "company-logo.png"),
    path.join(serverRoot, "..", "frontend", "src", "assets", "logo.png"),
  ];

  for (const logoPath of candidatePaths) {
    try {
      const data = await fs.readFile(logoPath);
      const extension = path.extname(logoPath).toLowerCase();
      const mimeType = extension === ".png" ? "image/png" : "image/jpeg";
      return `data:${mimeType};base64,${data.toString("base64")}`;
    } catch {
      continue;
    }
  }

  return "";
};

const loadLogoFileOnce = async () => {
  if (cachedLogoDataUri) return cachedLogoDataUri;
  if (!logoLoadPromise) {
    logoLoadPromise = resolveLogoFile()
      .then((value) => {
        cachedLogoDataUri = value;
        return cachedLogoDataUri;
      })
      .finally(() => {
        logoLoadPromise = null;
      });
  }
  return logoLoadPromise;
};

const buildAttendanceRows = async (filters = {}) => {
  const query = {};
  if (filters.date) query.date = new Date(filters.date);

  const records = await Attendance.find(query)
    .populate({
      path: "employeeId",
      select: "employeeId userId",
      populate: { path: "userId", select: "name email" },
    })
    .sort({ date: -1, createdAt: -1 })
    .lean();

  const searchTerm = normalizeText(filters.search);
  const statusFilter = normalizeText(filters.status);

  return records
    .map((record) => ({
      employeeName: record.employeeId?.userId?.name || "",
      employeeCode: record.employeeId?.employeeId || "",
      employeeEmail: record.employeeId?.userId?.email || "",
      date: record.date,
      checkIn: record.checkIn || "-",
      checkOut: record.checkOut || "-",
      hoursWorked: record.hoursWorked ? `${record.hoursWorked}h` : "-",
      status: capitalize(record.status || "present"),
      createdAt: record.createdAt,
    }))
    .filter((record) => {
      const matchesSearch = includesSearch(
        [record.employeeName, record.employeeCode, record.employeeEmail, formatShortDate(record.date), formatDate(record.date)],
        searchTerm
      );
      const matchesStatus = !statusFilter || normalizeText(record.status) === statusFilter;
      const matchesDate = !filters.date || formatDateInputValue(record.date) === filters.date;
      return matchesSearch && matchesStatus && matchesDate;
    })
    .map((record) => ({
      "Employee Name": record.employeeName,
      "Employee ID": record.employeeCode,
      Email: record.employeeEmail,
      Date: formatDate(record.date),
      "Check In": record.checkIn,
      "Check Out": record.checkOut,
      "Working Hours": record.hoursWorked,
      Status: record.status,
      "Captured At": formatDateTime(record.createdAt),
    }));
};

const buildEmployeeRows = async (filters = {}) => {
  const records = await Employee.find()
    .populate({ path: "userId", select: "name email department" })
    .sort({ createdAt: -1 })
    .lean();

  const searchTerm = normalizeText(filters.search);
  const departmentFilter = normalizeText(filters.department);
  const statusFilter = normalizeText(filters.status);

  return records
    .map((record) => {
      const status = record.status === "active" ? "Active" : "Inactive";
      return {
        employeeId: record.employeeId || "",
        name: record.userId?.name || record.fullName || "",
        email: record.userId?.email || record.email || "",
        department: record.userId?.department || record.departmentName || record.department || "",
        designation: record.designation || "",
        joined: record.joiningDate,
        compensationStatus: record.salaryStructure?.isConfigured ? "Configured" : "Pending",
        status,
        salary: record.salary || 0,
      };
    })
    .filter((record) => {
      const matchesSearch = includesSearch(
        [record.employeeId, record.name, record.email, record.department, record.designation],
        searchTerm
      );
      const matchesDepartment = !departmentFilter || normalizeText(record.department) === departmentFilter;
      const matchesStatus = !statusFilter || normalizeText(record.status) === statusFilter;
      return matchesSearch && matchesDepartment && matchesStatus;
    })
    .map((record) => ({
      "Employee ID": record.employeeId,
      "Employee Name": record.name,
      Email: record.email,
      Department: record.department,
      Designation: record.designation,
      "Joining Date": formatDate(record.joined),
      Salary: currencyFormatter.format(record.salary || 0),
      Compensation: record.compensationStatus,
      Status: record.status,
    }));
};

const buildPayrollRows = async (filters = {}) => {
  const query = {};
  const monthFilter = parseMonthFilter(filters.month);
  if (monthFilter) {
    query.monthNumber = monthFilter.monthNumber;
    query.year = monthFilter.year;
  }

  const records = await Payroll.find(query).sort({ year: -1, monthNumber: -1, createdAt: -1 }).lean();
  const searchTerm = normalizeText(filters.search);
  const statusFilter = normalizeText(filters.status);

  return records
    .map((record) => ({
      employeeName: record.employeeName || "",
      payrollId: record.payrollId || "",
      monthLabel: `${record.month} ${record.year}`,
      presentDays: record.presentDays || 0,
      absentDays: record.absentDays || 0,
      leaveDays: record.leaveDays || 0,
      grossSalary: record.grossSalary || 0,
      deductions: (record.deductions || 0) + (record.tax || 0),
      netSalary: record.netSalary || 0,
      status: capitalize(record.status || "processed"),
      createdAt: record.createdAt,
    }))
    .filter((record) => {
      const matchesSearch = includesSearch([record.employeeName, record.payrollId, record.monthLabel], searchTerm);
      const matchesStatus = !statusFilter || normalizeText(record.status) === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .map((record) => ({
      "Payroll ID": record.payrollId,
      "Employee Name": record.employeeName,
      Month: record.monthLabel,
      "Present Days": record.presentDays,
      "Absent Days": record.absentDays,
      "Leave Days": record.leaveDays,
      "Gross Salary": currencyFormatter.format(record.grossSalary),
      Deductions: currencyFormatter.format(record.deductions),
      "Net Salary": currencyFormatter.format(record.netSalary),
      Status: record.status,
      "Processed At": formatDateTime(record.createdAt),
    }));
};

const buildLeaveRows = async (filters = {}) => {
  const query = {};
  if (filters.fromDate) query.fromDate = new Date(filters.fromDate);

  const records = await Leave.find(query)
    .populate({
      path: "employeeId",
      select: "employeeId userId",
      populate: { path: "userId", select: "name email" },
    })
    .sort({ fromDate: -1, createdAt: -1 })
    .lean();

  const searchTerm = normalizeText(filters.search);
  const statusFilter = normalizeText(filters.status);
  const typeFilter = normalizeText(filters.type);

  return records
    .map((record) => ({
      employeeName: record.employeeId?.userId?.name || "",
      employeeId: record.employeeId?.employeeId || "",
      email: record.employeeId?.userId?.email || "",
      type: record.leaveType || "",
      fromDate: record.fromDate,
      toDate: record.toDate,
      days: calculateLeaveDays(record.fromDate, record.toDate),
      reason: record.reason || "",
      status: capitalize(record.status || "pending"),
      createdAt: record.createdAt,
    }))
    .filter((record) => {
      const matchesSearch = includesSearch(
        [record.employeeName, record.employeeId, record.email, record.type, formatShortDate(record.fromDate), formatShortDate(record.toDate)],
        searchTerm
      );
      const matchesStatus = !statusFilter || normalizeText(record.status) === statusFilter;
      const matchesType = !typeFilter || normalizeText(record.type) === typeFilter;
      const matchesFromDate = !filters.fromDate || formatDateInputValue(record.fromDate) === filters.fromDate;
      return matchesSearch && matchesStatus && matchesType && matchesFromDate;
    })
    .map((record) => ({
      "Employee Name": record.employeeName,
      "Employee ID": record.employeeId,
      Email: record.email,
      "Leave Type": record.type,
      From: formatDate(record.fromDate),
      To: formatDate(record.toDate),
      Days: record.days,
      Reason: record.reason,
      Status: record.status,
      "Requested At": formatDateTime(record.createdAt),
    }));
};

const buildDepartmentRows = async () => {
  const records = await Department.find().sort({ name: 1 }).lean();
  return records.map((record) => ({
    "Department Name": record.name || "",
    Description: record.description || "",
    "Created At": formatDateTime(record.createdAt),
  }));
};

const buildOffboardingRows = async () => {
  const records = await Offboarding.find().sort({ createdAt: -1 }).lean();
  return records.map((record) => ({
    Employee: record.name || "",
    Department: record.department || "",
    Reason: record.reason || "",
    "Last Working Day": formatDate(record.lastDay),
    Status: capitalize(record.status || "pending"),
    "Created At": formatDateTime(record.createdAt),
  }));
};

const buildCandidateRows = async (filters = {}) => {
  const records = await Candidate.find().sort({ createdAt: -1 }).lean();
  const searchTerm = normalizeText(filters.search);
  const statusFilter = normalizeText(filters.status);

  return records
    .map((record) => ({
      name: record.fullName || "",
      email: record.email || "",
      phone: record.phone || "",
      position: record.positionApplied || "",
      status: record.status || "",
      stageCompleted: record.stageCompleted || 0,
      submittedAt: record.submittedAt || record.createdAt,
    }))
    .filter((record) => {
      const matchesSearch = includesSearch([record.name, record.email, record.phone, record.position], searchTerm);
      const matchesStatus = !statusFilter || normalizeText(record.status) === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .map((record) => ({
      "Candidate Name": record.name,
      Email: record.email,
      Phone: record.phone,
      Position: record.position,
      Status: record.status,
      "Stage Completed": record.stageCompleted,
      "Submitted At": formatDateTime(record.submittedAt),
    }));
};

export const exportModuleRegistry = {
  attendance: {
    reportTitle: "Attendance Report",
    sheetName: "Attendance",
    columns: ["Employee Name", "Employee ID", "Email", "Date", "Check In", "Check Out", "Working Hours", "Status", "Captured At"],
    getRows: buildAttendanceRows,
  },
  employees: {
    reportTitle: "Employee Report",
    sheetName: "Employees",
    columns: ["Employee ID", "Employee Name", "Email", "Department", "Designation", "Joining Date", "Salary", "Compensation", "Status"],
    getRows: buildEmployeeRows,
  },
  payroll: {
    reportTitle: "Payroll Report",
    sheetName: "Payroll",
    columns: ["Payroll ID", "Employee Name", "Month", "Present Days", "Absent Days", "Leave Days", "Gross Salary", "Deductions", "Net Salary", "Status", "Processed At"],
    getRows: buildPayrollRows,
  },
  leave: {
    reportTitle: "Leave Report",
    sheetName: "Leaves",
    columns: ["Employee Name", "Employee ID", "Email", "Leave Type", "From", "To", "Days", "Reason", "Status", "Requested At"],
    getRows: buildLeaveRows,
  },
  departments: {
    reportTitle: "Department Report",
    sheetName: "Departments",
    columns: ["Department Name", "Description", "Created At"],
    getRows: buildDepartmentRows,
  },
  offboarding: {
    reportTitle: "Offboarding Report",
    sheetName: "Offboarding",
    columns: ["Employee", "Department", "Reason", "Last Working Day", "Status", "Created At"],
    getRows: buildOffboardingRows,
  },
  candidates: {
    reportTitle: "Candidate Report",
    sheetName: "Candidates",
    columns: ["Candidate Name", "Email", "Phone", "Position", "Status", "Stage Completed", "Submitted At"],
    getRows: buildCandidateRows,
  },
};

export const getExportModuleDefinition = (moduleName) => exportModuleRegistry[moduleName] || null;

export const getExportLogoDataUri = loadLogoFileOnce;
