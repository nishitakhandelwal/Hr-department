import { Employee } from "../models/Employee.js";

const toString = (value) => String(value ?? "").trim();
const toLowerEmail = (value) => String(value ?? "").toLowerCase().trim();

const generateEmployeeId = async () => {
  const year = new Date().getFullYear();
  const total = await Employee.countDocuments();

  for (let i = 0; i < 8; i += 1) {
    const code = `EMP-${year}-${String(total + i + 1).padStart(4, "0")}`;
    const exists = await Employee.exists({ employeeId: code });
    if (!exists) return code;
  }

  return `EMP-${year}-${Date.now()}`;
};

const buildDefaultEmployeePayload = async (user) => ({
  userId: user._id,
  employeeId: await generateEmployeeId(),
  fullName: toString(user.name) || "Employee",
  email: toLowerEmail(user.email),
  phone: toString(user.phone || user.phoneNumber),
  department: toString(user.department) || "Unassigned",
  designation: "Employee",
  salary: 0,
  joiningDate: new Date(),
  departmentName: toString(user.department) || "Unassigned",
  joiningFormCompleted: Boolean(user.joiningFormCompleted),
  status: user.joiningFormCompleted ? "active_employee" : "pending_form",
});

const syncEmployeeFromUser = async (employee, user) => {
  const nextFullName = toString(user.name);
  const nextEmail = toLowerEmail(user.email);
  const nextPhone = toString(user.phone || user.phoneNumber);
  const nextDepartment = toString(user.department) || "Unassigned";

  employee.userId = user._id;
  if (!employee.fullName && nextFullName) employee.fullName = nextFullName;
  if (!employee.email && nextEmail) employee.email = nextEmail;
  if (!employee.phone && nextPhone) employee.phone = nextPhone;
  if (!employee.department && nextDepartment) employee.department = nextDepartment;
  if (!employee.departmentName && nextDepartment) employee.departmentName = nextDepartment;
  if (!employee.designation) employee.designation = "Employee";
  if (employee.salary === undefined || employee.salary === null) employee.salary = 0;
  if (!employee.joiningDate) employee.joiningDate = new Date();
  if (!employee.employeeId) employee.employeeId = await generateEmployeeId();
  employee.joiningFormCompleted = Boolean(user.joiningFormCompleted);
  employee.status = user.joiningFormCompleted ? "active_employee" : "pending_form";
};

export const ensureEmployeeProfileForUser = async (user, { populate = "" } = {}) => {
  if (!user || user.role !== "employee") return null;

  let employee = await Employee.findOne({ userId: user._id });

  if (!employee) {
    const payload = await buildDefaultEmployeePayload(user);
    try {
      employee = await Employee.create(payload);
    } catch (error) {
      if (error?.code === 11000) {
        employee = await Employee.findOne({ userId: user._id });
      } else {
        throw error;
      }
    }
  } else {
    await syncEmployeeFromUser(employee, user);
    await employee.save();
  }

  if (!employee) {
    const lookupError = new Error("Employee profile could not be linked to this account.");
    lookupError.statusCode = 500;
    throw lookupError;
  }

  if (populate) {
    employee = await Employee.findById(employee._id).populate(populate);
  }

  return employee;
};
