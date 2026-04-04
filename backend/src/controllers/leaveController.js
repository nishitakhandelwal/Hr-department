import { Leave } from "../models/Leave.js";
import { deleteEntity } from "./crudFactory.js";
import { createSystemNotification } from "../services/runtimeBehaviorService.js";
import { ensureEmployeeProfileForUser } from "../services/employeeProfileService.js";

const resolveEmployeeScope = async (user) => {
  if (!user) return null;
  if (user.role === "admin") return null;
  const employee = await ensureEmployeeProfileForUser(user);
  return employee?._id || null;
};

export const getLeave = async (req, res) => {
  const employeeScope = await resolveEmployeeScope(req.user);
  const data = await Leave.find(employeeScope ? { employeeId: employeeScope } : {}).populate({
    path: "employeeId",
    populate: { path: "userId", select: "name email" },
  }).sort({ createdAt: -1 });
  res.json({ success: true, message: "Fetched leaves", data });
};

export const createLeave = async (req, res) => {
  const payload = { ...(req.body || {}) };
  if (req.user?.role === "employee") {
    const employee = await ensureEmployeeProfileForUser(req.user);
    payload.employeeId = employee._id;
  }

  const created = await Leave.create(payload);

  let employeeName = "An employee";
  if (created.employeeId) {
    const employee = await created.populate({
      path: "employeeId",
      populate: {
        path: "userId",
        select: "name",
      },
    });
    employeeName = employee?.employeeId?.userId?.name || employeeName;
  }

  await createSystemNotification({
    title: "New Leave Request",
    message: `${employeeName} submitted a ${created.leaveType} leave request.`,
    type: "leave",
    settingKey: "systemAnnouncements",
  });

  res.status(201).json({ success: true, message: "Created successfully", data: created });
};
export const updateLeave = async (req, res) => {
  const leave = await Leave.findById(req.params.id);
  if (!leave) {
    const error = new Error("Resource not found");
    error.statusCode = 404;
    throw error;
  }

  if (req.user?.role === "employee") {
    const employee = await ensureEmployeeProfileForUser(req.user);
    if (!employee || String(leave.employeeId) !== String(employee._id)) {
      return res.status(403).json({ success: false, message: "Forbidden", data: null });
    }
  }

  const payload = { ...(req.body || {}) };
  delete payload.employeeId;
  Object.assign(leave, payload);
  await leave.save();
  return res.json({ success: true, message: "Updated successfully", data: leave });
};
export const deleteLeave = deleteEntity(Leave);
