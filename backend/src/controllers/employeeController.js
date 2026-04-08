import bcrypt from "bcryptjs";
import { Employee } from "../models/Employee.js";
import { User } from "../models/User.js";
import { Attendance } from "../models/Attendance.js";
import { Leave } from "../models/Leave.js";
import { Payroll } from "../models/Payroll.js";
import { ensureEmployeeProfileForUser } from "../services/employeeProfileService.js";
import { createDefaultPermissions } from "../utils/permissions.js";
import { deleteEntity, updateEntity } from "./crudFactory.js";
import { secureUploadUrls } from "../utils/uploadAccess.js";
import { buildUploadsPublicPath } from "../utils/uploadUrls.js";
import { clearUserProfileImage, setUserProfileImage } from "../services/profileImageService.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const populateEmployeeRecord = (employeeId) =>
  Employee.findById(employeeId).populate("userId", "name email role department isActive");

export const getMyEmployeeProfile = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized", data: null });
  }

  const employee =
    req.user.role === "employee"
      ? await ensureEmployeeProfileForUser(req.user, {
          populate: { path: "userId", select: "name email role department isActive" },
        })
      : await Employee.findOne({ userId: req.user._id }).populate("userId", "name email role department isActive");

  if (!employee) return res.status(404).json({ success: false, message: "Employee profile not found", data: null });

  return res.json({ success: true, message: "Fetched employee profile", data: secureUploadUrls(employee, req, req.user) });
};

export const getEmployees = async (_req, res) => {
  const data = await Employee.find().populate("userId", "name email role department isActive").sort({ createdAt: -1 });
  res.json({ success: true, message: "Fetched employees", data });
};

export const getEmployeeById = async (req, res) => {
  const employee = await Employee.findById(req.params.id).populate("userId", "name email role department isActive");
  if (!employee) {
    return res.status(404).json({ success: false, message: "Employee not found", data: null });
  }

  return res.json({
    success: true,
    message: "Fetched employee",
    data: secureUploadUrls(employee, req, req.user),
  });
};

const buildEmployeeId = () => `EMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

export const createEmployee = async (req, res) => {
  try {
    const payload = { ...req.body };

    if (!payload.userId) {
      const name = String(payload.name || payload.fullName || "").trim();
      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");
      const department = String(payload.department || payload.departmentName || "").trim();
      const accountStatus = String(payload.accountStatus || "").trim().toLowerCase() === "disabled" ? "disabled" : "active";

      if (!name || !email || !password) {
        return res.status(422).json({
          success: false,
          message: "Name, email, and password are required to create an employee.",
        });
      }

      if (password.length < 6) {
        return res.status(422).json({
          success: false,
          message: "Password must be at least 6 characters.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const createdUser = await User.create({
        name,
        email,
        password: hashedPassword,
        role: "employee",
        accessRole: "employee",
        department,
        accountStatus,
        isVerified: true,
        status: "pending_form",
        joiningFormCompleted: false,
        permissions: createDefaultPermissions("employee"),
        isActive: accountStatus !== "disabled",
      });

      payload.userId = createdUser._id;
      payload.fullName = payload.fullName || name;
      payload.email = payload.email || email;
      payload.department = payload.department || department;
      payload.departmentName = payload.departmentName || department;
    }

    // Never require candidateId for regular employee creation.
    if (!payload.candidateId) {
      delete payload.candidateId;
    }
    if (!payload.employeeId) {
      payload.employeeId = buildEmployeeId();
    }
    payload.joiningFormCompleted = false;
    payload.status = "pending_form";

    const created = await Employee.create(payload);
    return res.status(201).json({ success: true, message: "Created successfully", data: created });
  } catch (error) {
    if (error?.code !== 11000 && req.body?.userId == null && error?.statusCode == null) {
      try {
        const createdEmail = String(req.body?.email || "").trim().toLowerCase();
        if (createdEmail) {
          await User.findOneAndDelete({ email: createdEmail, role: "employee" });
        }
      } catch {
        // no-op cleanup
      }
    }
    if (error?.code === 11000) {
      const duplicateField = Object.keys(error?.keyPattern || {})[0] || "";
      if (duplicateField === "candidateId") {
        return res.status(409).json({
          success: false,
          message: "This candidate has already been converted to an employee.",
        });
      }
      if (duplicateField === "email" || duplicateField === "userId") {
        return res.status(409).json({
          success: false,
          message: "Employee already exists with this email.",
        });
      }
      if (duplicateField === "employeeId") {
        return res.status(409).json({
          success: false,
          message: "Generated employee ID already exists. Please try again.",
        });
      }
    }
    throw error;
  }
};
export const updateEmployee = updateEntity(Employee);
export const deleteEmployee = deleteEntity(Employee);

export const uploadEmployeePhoto = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Please upload an employee photo." });
  }

  const employee = await populateEmployeeRecord(req.params.id);
  if (!employee) {
    return res.status(404).json({ success: false, message: "Employee not found.", data: null });
  }

  const imageUrl = buildUploadsPublicPath("profile", req.file.filename);

  if (employee.userId?._id) {
    await setUserProfileImage({ userId: employee.userId._id, imageUrl });
  } else {
    employee.profileImage = imageUrl;
    employee.photoUrl = imageUrl;
    await employee.save();
  }

  const refreshedEmployee = await populateEmployeeRecord(employee._id);

  return res.json({
    success: true,
    message: "Employee photo updated successfully.",
    data: secureUploadUrls(refreshedEmployee, req, req.user),
  });
};

export const removeEmployeePhoto = async (req, res) => {
  const employee = await populateEmployeeRecord(req.params.id);
  if (!employee) {
    return res.status(404).json({ success: false, message: "Employee not found.", data: null });
  }

  if (employee.userId?._id) {
    await clearUserProfileImage({ userId: employee.userId._id });
  } else {
    employee.profileImage = "";
    employee.photoUrl = "";
    await employee.save();
  }

  const refreshedEmployee = await populateEmployeeRecord(employee._id);

  return res.json({
    success: true,
    message: "Employee photo removed successfully.",
    data: secureUploadUrls(refreshedEmployee, req, req.user),
  });
};

export const updateEmployeeSalaryStructure = async (req, res) => {
  const employee = await Employee.findById(req.params.id).populate("userId", "name email role department isActive");
  if (!employee) throw createError("Employee not found.", 404);

  const salaryStructure = {
    employeeId: employee.employeeId,
    monthlyGrossSalary: toPositiveNumber(req.body?.monthlyGrossSalary || req.body?.grossSalary || employee.salary || 0),
    basicSalaryType: ["fixed", "percentage"].includes(String(req.body?.basicSalaryType)) ? String(req.body.basicSalaryType) : "percentage",
    basicSalaryValue: toPositiveNumber(req.body?.basicSalaryValue ?? req.body?.basicSalary),
    hraType: ["fixed", "percentage"].includes(String(req.body?.hraType)) ? String(req.body.hraType) : "percentage",
    hraValue: toPositiveNumber(req.body?.hraValue ?? req.body?.hra),
    specialAllowanceType: ["fixed", "percentage", "remainder"].includes(String(req.body?.specialAllowanceType))
      ? String(req.body.specialAllowanceType)
      : "remainder",
    specialAllowanceValue: toPositiveNumber(req.body?.specialAllowanceValue ?? req.body?.specialAllowance),
    otherAllowance: toPositiveNumber(req.body?.otherAllowance ?? req.body?.allowances),
    basicSalary: toPositiveNumber(req.body?.basicSalary),
    hra: toPositiveNumber(req.body?.hra),
    allowances: toPositiveNumber(req.body?.allowances),
    specialAllowance: toPositiveNumber(req.body?.specialAllowance),
    bonus: toPositiveNumber(req.body?.bonus),
    deductions: toPositiveNumber(req.body?.deductions),
    tax: toPositiveNumber(req.body?.tax),
    pfEnabled: Boolean(req.body?.pfEnabled),
    esiEnabled: Boolean(req.body?.esiEnabled),
    finePerAbsentDay: toPositiveNumber(req.body?.finePerAbsentDay),
    finePerLateMark: toPositiveNumber(req.body?.finePerLateMark),
    overtimeRatePerHour: toPositiveNumber(req.body?.overtimeRatePerHour),
    isConfigured: true,
    configuredAt: new Date(),
  };

  employee.salaryStructure = salaryStructure;
  employee.salary = salaryStructure.monthlyGrossSalary;
  await employee.save();

  res.json({
    success: true,
    message: "Salary structure updated successfully.",
    data: employee,
  });
};

export const getEmployeeDashboardSummary = async (req, res) => {
  const employee = await ensureEmployeeProfileForUser(req.user);
  if (!employee) {
    return res.status(404).json({ success: false, message: "Employee profile not found." });
  }

  const [attendanceRows, leaveRows, payrollRows] = await Promise.all([
    Attendance.find({ employeeId: employee._id }).sort({ date: -1 }).limit(60),
    Leave.find({ employeeId: employee._id }).sort({ createdAt: -1 }).limit(20),
    Payroll.find({ employeeId: employee._id }).sort({ year: -1, monthNumber: -1, createdAt: -1 }).limit(12),
  ]);

  const approvedLeaveDays = leaveRows
    .filter((row) => row.status === "approved")
    .reduce((sum, row) => {
      if (!row.fromDate || !row.toDate) return sum;
      return sum + (Math.ceil((new Date(row.toDate).getTime() - new Date(row.fromDate).getTime()) / (1000 * 3600 * 24)) + 1);
    }, 0);

  return res.json({
    success: true,
    message: "Fetched employee dashboard summary",
    data: {
      attendanceRows,
      leaveRows,
      payrollRows,
      approvedLeaveDays,
    },
  });
};
