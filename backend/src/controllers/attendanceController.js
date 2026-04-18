import { Attendance } from "../models/Attendance.js";
import { AttendanceCorrectionRequest } from "../models/AttendanceCorrectionRequest.js";
import { Employee } from "../models/Employee.js";
import { ensureEmployeeProfileForUser } from "../services/employeeProfileService.js";
import { validateGeoFence } from "../services/officeLocationService.js";
import {
  createAdminNotifications,
  createNotificationForUser,
} from "../services/recruitmentWorkflowService.js";
import { deleteEntity } from "./crudFactory.js";

const CHECK_IN = "check-in";
const CHECK_OUT = "check-out";

const GEO_FENCE_REQUIRED_MESSAGE = "You must be inside a configured office boundary to mark attendance.";

const resolveEmployeeScope = async (user) => {
  if (!user) return null;
  if (user.role === "admin") return null;
  const employee = await ensureEmployeeProfileForUser(user);
  return employee?._id || null;
};

const normalizeAttendanceDate = (value) => {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const isSameDay = (left, right) =>
  left instanceof Date &&
  right instanceof Date &&
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const parseTimeToMinutes = (value) => {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return null;

  const twentyFourHour = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFourHour) {
    return Number(twentyFourHour[1]) * 60 + Number(twentyFourHour[2]);
  }

  const twelveHour = text.match(/^(0?\d|1[0-2]):([0-5]\d)\s?(AM|PM)$/);
  if (!twelveHour) return null;

  let hours = Number(twelveHour[1]) % 12;
  const minutes = Number(twelveHour[2]);
  if (twelveHour[3] === "PM") hours += 12;
  return hours * 60 + minutes;
};

const formatStoredTime = (value) => {
  const minutes = parseTimeToMinutes(value);
  if (minutes === null) return "";
  const hours24 = Math.floor(minutes / 60);
  const mins = String(minutes % 60).padStart(2, "0");
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, "0")}:${mins} ${period}`;
};

const calculateHoursWorked = (checkIn, checkOut) => {
  const checkInMinutes = parseTimeToMinutes(checkIn);
  const checkOutMinutes = parseTimeToMinutes(checkOut);
  if (checkInMinutes === null || checkOutMinutes === null || checkOutMinutes <= checkInMinutes) {
    return 0;
  }
  return Number(((checkOutMinutes - checkInMinutes) / 60).toFixed(2));
};

const inferAttendanceStatus = (attendance) => {
  if (attendance.status === "leave") return "leave";
  if (attendance.checkIn || attendance.checkOut) return "present";
  return attendance.status || "present";
};

const ensureTodayForEmployee = (date) => {
  const today = normalizeAttendanceDate();
  return isSameDay(date, today);
};

const formatRequestLabel = (type) => (type === CHECK_IN ? "check-in" : "check-out");

const buildAttendanceState = (source = {}) => ({
  checkIn: source.checkIn || "",
  checkOut: source.checkOut || "",
  status: source.status || "",
  hoursWorked: source.hoursWorked,
});

const applyAttendanceState = (attendance, state = {}, payload = {}) => {
  attendance.checkIn = state.checkIn || "";
  attendance.checkOut = state.checkOut || "";
  attendance.status = state.status || inferAttendanceStatus(attendance);
  attendance.hoursWorked =
    payload.hoursWorked !== undefined
      ? Number(payload.hoursWorked || 0)
      : calculateHoursWorked(attendance.checkIn, attendance.checkOut);
};

const parseCoordinate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildGeoFencePayload = (validation, latitude, longitude) => ({
  latitude,
  longitude,
  officeLocationId: validation?.matchedLocation?._id || null,
  officeName: validation?.matchedLocation?.name || "",
  distanceMeters: Number(validation?.matchedLocation?.distanceMeters || 0),
  radiusMeters: Number(validation?.matchedLocation?.radiusMeters || 0),
  capturedAt: new Date(),
});

const validateEmployeeGeoFence = async (payload = {}) => {
  const latitude = parseCoordinate(payload.latitude);
  const longitude = parseCoordinate(payload.longitude);

  if (latitude === null || longitude === null) {
    return {
      ok: false,
      statusCode: 400,
      message: "Latitude and longitude are required for geo-fenced attendance.",
      data: null,
    };
  }

  const validation = await validateGeoFence({ latitude, longitude });
  if (!validation.matched) {
    return {
      ok: false,
      statusCode: validation.evaluatedLocations?.length ? 403 : 503,
      message: GEO_FENCE_REQUIRED_MESSAGE,
      data: {
        validation,
      },
    };
  }

  return {
    ok: true,
    statusCode: 200,
    message: "",
    data: {
      latitude,
      longitude,
      validation,
    },
  };
};

const applyGeoFenceToAttendance = (attendance, action, geoData) => {
  if (!geoData?.validation?.matchedLocation) return;

  if (action === CHECK_IN) {
    attendance.checkInLocation = buildGeoFencePayload(geoData.validation, geoData.latitude, geoData.longitude);
    return;
  }

  if (action === CHECK_OUT) {
    attendance.checkOutLocation = buildGeoFencePayload(geoData.validation, geoData.latitude, geoData.longitude);
  }
};

const mergeAttendancePayload = (baseAttendance = {}, payload = {}) => {
  const nextState = buildAttendanceState(baseAttendance);

  if (payload.checkIn !== undefined) {
    nextState.checkIn = payload.checkIn ? formatStoredTime(payload.checkIn) : "";
  }

  if (payload.checkOut !== undefined) {
    nextState.checkOut = payload.checkOut ? formatStoredTime(payload.checkOut) : "";
  }

  if (payload.status !== undefined) {
    nextState.status = payload.status || "";
  } else {
    nextState.status = inferAttendanceStatus(nextState);
  }

  nextState.hoursWorked =
    payload.hoursWorked !== undefined
      ? Number(payload.hoursWorked || 0)
      : calculateHoursWorked(nextState.checkIn, nextState.checkOut);

  return nextState;
};

const validateAttendanceTimes = (state) => {
  if (state.checkIn && !parseTimeToMinutes(state.checkIn)) {
    return "Please provide a valid check-in time.";
  }

  if (state.checkOut && !parseTimeToMinutes(state.checkOut)) {
    return "Please provide a valid check-out time.";
  }

  if (state.checkIn && state.checkOut) {
    const checkInMinutes = parseTimeToMinutes(state.checkIn);
    const checkOutMinutes = parseTimeToMinutes(state.checkOut);
    if (checkInMinutes === null || checkOutMinutes === null) {
      return "Please provide valid attendance times.";
    }
    if (checkOutMinutes <= checkInMinutes) {
      return "Check-out time must be after check-in time.";
    }
  }

  return "";
};

export const getAttendance = async (req, res) => {
  const employeeScope = await resolveEmployeeScope(req.user);
  const data = await Attendance.find(employeeScope ? { employeeId: employeeScope } : {})
    .populate({
      path: "employeeId",
      populate: { path: "userId", select: "name email" },
    })
    .populate("updatedBy", "name email")
    .sort({ date: -1 });
  res.json({ success: true, message: "Fetched attendance", data });
};

export const createAttendance = async (req, res) => {
  const payload = { ...(req.body || {}) };
  let geoFenceResult = null;

  if (req.user?.role === "employee") {
    const employee = await ensureEmployeeProfileForUser(req.user);
    payload.employeeId = employee?._id;
  }

  if (!payload.employeeId) {
    return res.status(400).json({ success: false, message: "Employee is required.", data: null });
  }

  payload.date = normalizeAttendanceDate(payload.date);

  if (req.user?.role === "employee" && !ensureTodayForEmployee(payload.date)) {
    return res.status(403).json({
      success: false,
      message: "Employees can only mark attendance for today. Use a correction request for past dates.",
      data: null,
    });
  }

  if (req.user?.role === "employee" && (payload.checkIn || payload.checkOut)) {
    geoFenceResult = await validateEmployeeGeoFence(payload);
    if (!geoFenceResult.ok) {
      return res.status(geoFenceResult.statusCode).json({
        success: false,
        message: geoFenceResult.message,
        data: geoFenceResult.data,
      });
    }
  }

  const existing = await Attendance.findOne({ employeeId: payload.employeeId, date: payload.date });
  if (existing) {
    const mergedState = mergeAttendancePayload(
      {
        ...existing.toObject(),
        checkIn: !existing.checkIn && payload.checkIn ? payload.checkIn : existing.checkIn,
        checkOut: payload.checkOut || existing.checkOut,
      },
      { status: payload.status, hoursWorked: payload.hoursWorked }
    );
    const validationError = validateAttendanceTimes(mergedState);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError, data: null });
    }
    applyAttendanceState(existing, mergedState, { hoursWorked: payload.hoursWorked });
    if (payload.checkIn && !existing.checkInLocation) {
      applyGeoFenceToAttendance(existing, CHECK_IN, geoFenceResult);
    }
    if (payload.checkOut) {
      applyGeoFenceToAttendance(existing, CHECK_OUT, geoFenceResult);
    }
    await existing.save();
    return res.json({ success: true, message: "Attendance updated successfully", data: existing });
  }

  const created = new Attendance({
    employeeId: payload.employeeId,
    date: payload.date,
    checkIn: "",
    checkOut: "",
    status: payload.status || "present",
    hoursWorked: 0,
  });
  const createdState = mergeAttendancePayload(created.toObject(), payload);
  const validationError = validateAttendanceTimes(createdState);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError, data: null });
  }
  applyAttendanceState(created, createdState, payload);
  if (payload.checkIn) {
    applyGeoFenceToAttendance(created, CHECK_IN, geoFenceResult);
  }
  if (payload.checkOut) {
    applyGeoFenceToAttendance(created, CHECK_OUT, geoFenceResult);
  }
  await created.save();
  return res.status(201).json({ success: true, message: "Created successfully", data: created });
};

export const updateAttendance = async (req, res) => {
  const attendance = await Attendance.findById(req.params.id);
  if (!attendance) {
    const error = new Error("Resource not found");
    error.statusCode = 404;
    throw error;
  }

  if (req.user?.role === "employee") {
    const employee = await ensureEmployeeProfileForUser(req.user);
    if (!employee || String(attendance.employeeId) !== String(employee._id)) {
      return res.status(403).json({ success: false, message: "Forbidden", data: null });
    }
    if (!ensureTodayForEmployee(normalizeAttendanceDate(attendance.date))) {
      return res.status(403).json({
        success: false,
        message: "Employees cannot edit past attendance directly. Submit a correction request instead.",
        data: null,
      });
    }
  }

  const payload = { ...(req.body || {}) };
  delete payload.employeeId;
  delete payload.date;
  let geoFenceResult = null;

  if (req.user?.role === "employee" && (payload.checkIn !== undefined || payload.checkOut !== undefined)) {
    geoFenceResult = await validateEmployeeGeoFence(payload);
    if (!geoFenceResult.ok) {
      return res.status(geoFenceResult.statusCode).json({
        success: false,
        message: geoFenceResult.message,
        data: geoFenceResult.data,
      });
    }
  }

  const nextState = mergeAttendancePayload(attendance.toObject(), payload);
  const validationError = validateAttendanceTimes(nextState);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError, data: null });
  }

  applyAttendanceState(attendance, nextState, payload);
  if (payload.checkIn !== undefined) {
    applyGeoFenceToAttendance(attendance, CHECK_IN, geoFenceResult);
  }
  if (payload.checkOut !== undefined) {
    applyGeoFenceToAttendance(attendance, CHECK_OUT, geoFenceResult);
  }
  await attendance.save();
  return res.json({ success: true, message: "Updated successfully", data: attendance });
};

export const validateAttendanceLocation = async (req, res) => {
  const geoFenceResult = await validateEmployeeGeoFence(req.body || {});
  if (!geoFenceResult.ok) {
    if (geoFenceResult.data?.validation) {
      return res.json({
        success: true,
        message: geoFenceResult.data.validation.message,
        data: geoFenceResult.data.validation,
      });
    }

    return res.status(geoFenceResult.statusCode).json({
      success: false,
      message: geoFenceResult.message,
      data: geoFenceResult.data,
    });
  }

  return res.json({
    success: true,
    message: geoFenceResult.data.validation.message,
    data: geoFenceResult.data.validation,
  });
};

export const markGeoAttendance = async (req, res) => {
  if (req.user?.role !== "employee") {
    return res.status(403).json({
      success: false,
      message: "Only employees can use geo attendance.",
      data: null,
    });
  }

  const employee = await ensureEmployeeProfileForUser(req.user);
  if (!employee?._id) {
    return res.status(400).json({
      success: false,
      message: "Employee profile not found.",
      data: null,
    });
  }

  const action = String(req.body?.action || "").trim().toLowerCase();
  if (![CHECK_IN, CHECK_OUT].includes(action)) {
    return res.status(400).json({
      success: false,
      message: "Attendance action must be check-in or check-out.",
      data: null,
    });
  }

  const geoFenceResult = await validateEmployeeGeoFence(req.body || {});
  if (!geoFenceResult.ok) {
    return res.status(geoFenceResult.statusCode).json({
      success: false,
      message: geoFenceResult.message,
      data: geoFenceResult.data,
    });
  }

  const now = new Date();
  const date = normalizeAttendanceDate(now);
  const timeText = formatStoredTime(
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  );

  let attendance = await Attendance.findOne({ employeeId: employee._id, date });
  if (!attendance) {
    attendance = new Attendance({
      employeeId: employee._id,
      date,
      status: "present",
      checkIn: "",
      checkOut: "",
      hoursWorked: 0,
    });
  }

  if (action === CHECK_IN) {
    if (attendance.checkIn) {
      return res.status(409).json({
        success: false,
        message: "Check-in has already been recorded for today.",
        data: {
          attendance,
          validation: geoFenceResult.data.validation,
        },
      });
    }

    attendance.checkIn = timeText;
    attendance.status = "present";
    applyGeoFenceToAttendance(attendance, CHECK_IN, geoFenceResult.data);
  }

  if (action === CHECK_OUT) {
    if (!attendance.checkIn) {
      return res.status(400).json({
        success: false,
        message: "You must check in before checking out.",
        data: null,
      });
    }
    if (attendance.checkOut) {
      return res.status(409).json({
        success: false,
        message: "Check-out has already been recorded for today.",
        data: {
          attendance,
          validation: geoFenceResult.data.validation,
        },
      });
    }

    attendance.checkOut = timeText;
    attendance.status = "present";
    applyGeoFenceToAttendance(attendance, CHECK_OUT, geoFenceResult.data);
  }

  attendance.hoursWorked = calculateHoursWorked(attendance.checkIn, attendance.checkOut);
  await attendance.save();

  const populatedAttendance = await Attendance.findById(attendance._id)
    .populate({
      path: "employeeId",
      populate: { path: "userId", select: "name email" },
    })
    .populate("updatedBy", "name email");

  return res.json({
    success: true,
    message:
      action === CHECK_IN
        ? `Checked in successfully at ${geoFenceResult.data.validation.matchedLocation.name}.`
        : `Checked out successfully from ${geoFenceResult.data.validation.matchedLocation.name}.`,
    data: {
      attendance: populatedAttendance,
      validation: geoFenceResult.data.validation,
    },
  });
};

export const adminOverrideAttendance = async (req, res) => {
  const employeeId = String(req.body?.employeeId || "").trim();
  if (!employeeId) {
    return res.status(400).json({ success: false, message: "Employee is required.", data: null });
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    return res.status(404).json({ success: false, message: "Employee not found.", data: null });
  }

  const date = normalizeAttendanceDate(req.body?.date);
  const existing = await Attendance.findOne({ employeeId, date });
  const baseAttendance =
    existing ||
    new Attendance({
      employeeId,
      date,
      checkIn: "",
      checkOut: "",
      status: "present",
      hoursWorked: 0,
      isManual: true,
      updatedBy: req.user?._id || null,
    });

  const payload = {
    checkIn: req.body?.checkIn,
    checkOut: req.body?.checkOut,
    status: req.body?.status,
    hoursWorked: req.body?.hoursWorked,
  };

  const nextState = mergeAttendancePayload(baseAttendance.toObject(), payload);
  const validationError = validateAttendanceTimes(nextState);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError, data: null });
  }

  applyAttendanceState(baseAttendance, nextState, payload);
  baseAttendance.employeeId = employee._id;
  baseAttendance.date = date;
  baseAttendance.isManual = true;
  baseAttendance.updatedBy = req.user?._id || null;

  await baseAttendance.save();

  const populatedAttendance = await Attendance.findById(baseAttendance._id)
    .populate({
      path: "employeeId",
      populate: { path: "userId", select: "name email" },
    })
    .populate("updatedBy", "name email");

  return res.json({
    success: true,
    message: existing ? "Attendance overridden successfully." : "Attendance created successfully.",
    data: populatedAttendance,
  });
};

export const requestAttendanceCorrection = async (req, res) => {
  const employee = await ensureEmployeeProfileForUser(req.user);
  if (!employee) {
    return res.status(400).json({ success: false, message: "Employee profile not found.", data: null });
  }

  const date = normalizeAttendanceDate(req.body?.date);
  const today = normalizeAttendanceDate();

  if (date > today) {
    return res.status(400).json({ success: false, message: "Future dates are not allowed.", data: null });
  }

  const type = req.body?.type;
  const time = formatStoredTime(req.body?.time);
  const reason = String(req.body?.reason || "").trim();

  if (!time) {
    return res.status(400).json({ success: false, message: "Please provide a valid time.", data: null });
  }

  const existingPending = await AttendanceCorrectionRequest.findOne({
    employeeId: employee._id,
    date,
    type,
    status: "pending",
  });
  if (existingPending) {
    return res.status(409).json({
      success: false,
      message: "A pending correction request already exists for this date and type.",
      data: null,
    });
  }

  const attendance = await Attendance.findOne({ employeeId: employee._id, date });
  if ((type === CHECK_IN && attendance?.checkIn) || (type === CHECK_OUT && attendance?.checkOut)) {
    return res.status(400).json({
      success: false,
      message: `A ${formatRequestLabel(type)} entry already exists for this date.`,
      data: null,
    });
  }

  const created = await AttendanceCorrectionRequest.create({
    userId: req.user._id,
    employeeId: employee._id,
    date,
    type,
    time,
    reason,
    status: "pending",
  });

  await createAdminNotifications({
    title: "Attendance correction request",
    message: `${employee.fullName || req.user.name} requested a missed ${formatRequestLabel(type)} correction.`,
    type: "attendance",
  });

  const populated = await AttendanceCorrectionRequest.findById(created._id)
    .populate("userId", "name email")
    .populate({
      path: "employeeId",
      populate: { path: "userId", select: "name email" },
    });

  return res.status(201).json({
    success: true,
    message: "Correction request submitted successfully.",
    data: populated,
  });
};

export const getAttendanceCorrectionRequests = async (req, res) => {
  const query =
    req.user?.role === "admin"
      ? {}
      : {
          userId: req.user?._id,
        };

  const data = await AttendanceCorrectionRequest.find(query)
    .populate("userId", "name email")
    .populate({
      path: "employeeId",
      populate: { path: "userId", select: "name email" },
    })
    .populate("reviewedBy", "name email")
    .sort({ createdAt: -1 });

  return res.json({
    success: true,
    message: "Fetched correction requests successfully.",
    data,
  });
};

export const reviewAttendanceCorrection = async (req, res) => {
  const request = await AttendanceCorrectionRequest.findById(req.params.id).populate("userId", "name email");
  if (!request) {
    return res.status(404).json({ success: false, message: "Correction request not found.", data: null });
  }

  if (request.status !== "pending") {
    return res.status(400).json({ success: false, message: "This request has already been reviewed.", data: null });
  }

  const action = String(req.body?.action || "").trim().toLowerCase();
  const adminRemarks = String(req.body?.adminRemarks || "").trim();

  if (!["approved", "rejected"].includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid action.", data: null });
  }

  request.status = action;
  request.adminRemarks = adminRemarks;
  request.reviewedBy = req.user?._id || null;
  request.reviewedAt = new Date();

  if (action === "approved") {
    let attendance = await Attendance.findOne({ employeeId: request.employeeId, date: request.date });
    if (!attendance) {
      attendance = new Attendance({
        employeeId: request.employeeId,
        date: request.date,
        checkIn: "",
        checkOut: "",
        hoursWorked: 0,
        status: "present",
      });
    }

    if (request.type === CHECK_IN) {
      if (attendance.checkIn) {
        return res.status(400).json({ success: false, message: "Attendance already has a check-in entry.", data: null });
      }
      attendance.checkIn = request.time;
    }

    if (request.type === CHECK_OUT) {
      if (attendance.checkOut) {
        return res.status(400).json({ success: false, message: "Attendance already has a check-out entry.", data: null });
      }
      attendance.checkOut = request.time;
    }

    const nextState = mergeAttendancePayload(attendance.toObject(), {});
    applyAttendanceState(attendance, nextState, {});
    await attendance.save();
  }

  await request.save();

  await createNotificationForUser({
    userId: request.userId?._id || request.userId,
    title: `Attendance correction ${action}`,
    message:
      action === "approved"
        ? `Your missed ${formatRequestLabel(request.type)} request for ${request.time} was approved.`
        : `Your missed ${formatRequestLabel(request.type)} request was rejected${adminRemarks ? `: ${adminRemarks}` : "."}`,
    type: "attendance",
  });

  const populated = await AttendanceCorrectionRequest.findById(request._id)
    .populate("userId", "name email")
    .populate({
      path: "employeeId",
      populate: { path: "userId", select: "name email" },
    })
    .populate("reviewedBy", "name email");

  return res.json({
    success: true,
    message: `Correction request ${action} successfully.`,
    data: populated,
  });
};

export const deleteAttendance = deleteEntity(Attendance);
