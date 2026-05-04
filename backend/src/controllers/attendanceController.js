import { Attendance } from "../models/Attendance.js";
import { AttendanceCorrectionRequest } from "../models/AttendanceCorrectionRequest.js";
import { Employee } from "../models/Employee.js";
import { Payroll } from "../models/Payroll.js";
import { ensureEmployeeProfileForUser } from "../services/employeeProfileService.js";
import { validateGeoFence } from "../services/officeLocationService.js";
import {
  createAdminNotifications,
  createNotificationForUser,
} from "../services/recruitmentWorkflowService.js";
import { getSystemSettings } from "../services/systemSettingsService.js";
import {
  ATTENDANCE_STATUSES,
  combineDateAndTimeToUtc,
  formatUtcTimeForDisplay,
  getDateKeyInTimeZone,
  getDatePartsInTimeZone,
  normalizeAttendanceDate,
  parseTimeStringToMinutes,
  reconcileAttendanceRecord,
  sanitizeAttendanceSettings,
} from "../services/attendancePolicyService.js";
import { deleteEntity } from "./crudFactory.js";

const CHECK_IN = "check-in";
const CHECK_OUT = "check-out";
const GEO_FENCE_REQUIRED_MESSAGE = "You must be inside a configured office boundary to mark attendance.";

const resolvePolicyContext = async () => {
  const settings = await getSystemSettings({ lean: true });
  const attendanceSettings = sanitizeAttendanceSettings(settings.attendance, settings.preferences?.timezone);
  return {
    attendanceSettings,
    timezone: attendanceSettings.timezone,
  };
};

const resolveEmployeeScope = async (user) => {
  if (!user) return null;
  if (user.role === "admin") return null;
  const employee = await ensureEmployeeProfileForUser(user);
  return employee?._id || null;
};

const formatRequestLabel = (type) => (type === CHECK_IN ? "check-in" : "check-out");

const ensureTodayForEmployee = (dateValue, timeZone) =>
  getDateKeyInTimeZone(dateValue, timeZone) === getDateKeyInTimeZone(new Date(), timeZone);

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
  } else if (action === CHECK_OUT) {
    attendance.checkOutLocation = buildGeoFencePayload(geoData.validation, geoData.latitude, geoData.longitude);
  }
};

const validateAttendanceTimes = ({ checkIn, checkOut, status, hasPunchEntries = false }) => {
  const safeStatus = String(status || "").trim().toLowerCase();
  const checkInMinutes = checkIn ? parseTimeStringToMinutes(checkIn) : null;
  const checkOutMinutes = checkOut ? parseTimeStringToMinutes(checkOut) : null;

  if (checkIn && checkInMinutes === null) {
    return "Please provide a valid check-in time.";
  }
  if (checkOut && checkOutMinutes === null) {
    return "Please provide a valid check-out time.";
  }
  if (checkInMinutes !== null && checkOutMinutes !== null && checkOutMinutes <= checkInMinutes) {
    return "Check-out time must be after check-in time.";
  }
  if (
    !hasPunchEntries &&
    !checkIn &&
    !checkOut &&
    safeStatus &&
    ![ATTENDANCE_STATUSES.ABSENT, ATTENDANCE_STATUSES.LEAVE].includes(safeStatus)
  ) {
    return "A manual status without punches must be absent or leave.";
  }

  return "";
};

const normalizePunchEntriesInput = (punchEntries, dateKey, timeZone) => {
  if (!Array.isArray(punchEntries)) return { entries: [], error: "" };

  const normalized = [];
  for (const [index, entry] of punchEntries.entries()) {
    if (typeof entry === "string") {
      const minutes = parseTimeStringToMinutes(entry);
      if (minutes === null) {
        return { entries: [], error: `Punch entry ${index + 1} must contain a valid time.` };
      }
      normalized.push({
        type: "punch",
        timestamp: combineDateAndTimeToUtc(dateKey, entry, timeZone),
        source: "manual",
      });
      continue;
    }

    if (!entry || typeof entry !== "object") {
      return { entries: [], error: `Punch entry ${index + 1} is invalid.` };
    }

    const timeText = String(entry.time || "").trim();
    const minutes = parseTimeStringToMinutes(timeText);
    if (!timeText || minutes === null) {
      return { entries: [], error: `Punch entry ${index + 1} must contain a valid time.` };
    }

    normalized.push({
      type: String(entry.type || "punch"),
      timestamp: combineDateAndTimeToUtc(dateKey, timeText, timeZone),
      source: String(entry.source || "manual"),
      location: entry.location && typeof entry.location === "object" ? entry.location : undefined,
      note: entry.note ? String(entry.note) : undefined,
    });
  }

  normalized.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

  return { entries: normalized, error: "" };
};

const isPayrollLockedForDate = async (employeeId, dateValue, timeZone) => {
  const { year, month } = getDatePartsInTimeZone(dateValue, timeZone);
  return Payroll.exists({
    employeeId,
    monthNumber: month,
    year,
    payrollLocked: true,
  });
};

const loadAttendanceRecord = async (employeeId, dateValue, timeZone) => {
  const normalizedDate = normalizeAttendanceDate(dateValue, timeZone);
  return Attendance.findOne({ employeeId, date: normalizedDate });
};

const applyAttendancePayload = ({
  attendance,
  payload = {},
  attendanceSettings,
  timeZone,
  source = "manual",
}) => {
  const nextDate = normalizeAttendanceDate(payload.date || attendance.date || new Date(), timeZone);
  const nextDateKey = getDateKeyInTimeZone(nextDate, timeZone);
  const explicitStatus = String(payload.status || attendance.status || "").trim().toLowerCase();

  const checkInText =
    payload.checkIn !== undefined
      ? payload.checkIn
      : attendance.checkInAt
        ? formatUtcTimeForDisplay(attendance.checkInAt, timeZone)
        : "";
  const checkOutText =
    payload.checkOut !== undefined
      ? payload.checkOut
      : attendance.checkOutAt
        ? formatUtcTimeForDisplay(attendance.checkOutAt, timeZone)
        : "";

  const validationError = validateAttendanceTimes({
    checkIn: checkInText,
    checkOut: checkOutText,
    status: explicitStatus,
    hasPunchEntries: Array.isArray(payload.punchEntries) && payload.punchEntries.length > 0,
  });
  if (validationError) {
    return validationError;
  }

  attendance.date = nextDate;
  attendance.dateKey = nextDateKey;
  attendance.isManual = source === "manual";

  if (Array.isArray(payload.punchEntries) && payload.punchEntries.length) {
    const { entries, error } = normalizePunchEntriesInput(payload.punchEntries, nextDateKey, timeZone);
    if (error) {
      return error;
    }

    attendance.punchEntries = entries;
    attendance.checkInAt = entries[0]?.timestamp || null;
    attendance.checkOutAt = entries.length > 1 ? entries[entries.length - 1].timestamp : null;
  } else {
    attendance.checkInAt = checkInText ? combineDateAndTimeToUtc(nextDateKey, checkInText, timeZone) : null;
    attendance.checkOutAt = checkOutText ? combineDateAndTimeToUtc(nextDateKey, checkOutText, timeZone) : null;
  }

  reconcileAttendanceRecord({
    attendance,
    attendanceSettings,
    timeZone,
    explicitStatus,
  });

  return "";
};

const reconcileAttendanceCollection = async (rows, attendanceSettings, timeZone) => {
  for (const attendance of rows) {
    const before = JSON.stringify({
      status: attendance.status,
      isIncomplete: attendance.isIncomplete,
      checkOut: attendance.checkOut,
      hoursWorked: attendance.hoursWorked,
      overtimeHours: attendance.overtimeHours,
    });

    reconcileAttendanceRecord({
      attendance,
      attendanceSettings,
      timeZone,
      explicitStatus: attendance.status,
    });

    const after = JSON.stringify({
      status: attendance.status,
      isIncomplete: attendance.isIncomplete,
      checkOut: attendance.checkOut,
      hoursWorked: attendance.hoursWorked,
      overtimeHours: attendance.overtimeHours,
    });

    if (before !== after) {
      await attendance.save();
    }
  }
};

export const getAttendance = async (req, res) => {
  const employeeScope = await resolveEmployeeScope(req.user);
  const { attendanceSettings, timezone } = await resolvePolicyContext();
  const rows = await Attendance.find(employeeScope ? { employeeId: employeeScope } : {})
    .populate({
      path: "employeeId",
      populate: { path: "userId", select: "name email" },
    })
    .populate("updatedBy", "name email")
    .sort({ date: -1 });

  await reconcileAttendanceCollection(rows, attendanceSettings, timezone);
  res.json({ success: true, message: "Fetched attendance", data: rows });
};

export const createAttendance = async (req, res) => {
  const payload = { ...(req.body || {}) };
  const { attendanceSettings, timezone } = await resolvePolicyContext();
  let geoFenceResult = null;

  if (req.user?.role === "employee") {
    const employee = await ensureEmployeeProfileForUser(req.user);
    payload.employeeId = employee?._id;
  }

  if (!payload.employeeId) {
    return res.status(400).json({ success: false, message: "Employee is required.", data: null });
  }

  const normalizedDate = normalizeAttendanceDate(payload.date, timezone);
  payload.date = normalizedDate;

  if (await isPayrollLockedForDate(payload.employeeId, normalizedDate, timezone)) {
    return res.status(409).json({
      success: false,
      message: "Attendance cannot be changed because payroll is already locked for this month.",
      data: null,
    });
  }

  if (req.user?.role === "employee" && !ensureTodayForEmployee(normalizedDate, timezone)) {
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

  const existing = await loadAttendanceRecord(payload.employeeId, normalizedDate, timezone);
  if (existing) {
    const errorMessage = applyAttendancePayload({
      attendance: existing,
      payload,
      attendanceSettings,
      timeZone: timezone,
      source: req.user?.role === "employee" ? "geo" : "manual",
    });
    if (errorMessage) {
      return res.status(400).json({ success: false, message: errorMessage, data: null });
    }
    if (payload.checkIn) applyGeoFenceToAttendance(existing, CHECK_IN, geoFenceResult?.data);
    if (payload.checkOut) applyGeoFenceToAttendance(existing, CHECK_OUT, geoFenceResult?.data);
    existing.updatedBy = req.user?._id || null;
    await existing.save();
    return res.json({ success: true, message: "Attendance updated successfully", data: existing });
  }

  const created = new Attendance({
    employeeId: payload.employeeId,
    date: normalizedDate,
    dateKey: getDateKeyInTimeZone(normalizedDate, timezone),
    status: payload.status || ATTENDANCE_STATUSES.PRESENT,
    updatedBy: req.user?._id || null,
    isManual: req.user?.role !== "employee",
  });

  const errorMessage = applyAttendancePayload({
    attendance: created,
    payload,
    attendanceSettings,
    timeZone: timezone,
    source: req.user?.role === "employee" ? "geo" : "manual",
  });
  if (errorMessage) {
    return res.status(400).json({ success: false, message: errorMessage, data: null });
  }
  if (payload.checkIn) applyGeoFenceToAttendance(created, CHECK_IN, geoFenceResult?.data);
  if (payload.checkOut) applyGeoFenceToAttendance(created, CHECK_OUT, geoFenceResult?.data);
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

  const { attendanceSettings, timezone } = await resolvePolicyContext();

  if (await isPayrollLockedForDate(attendance.employeeId, attendance.date, timezone)) {
    return res.status(409).json({
      success: false,
      message: "Attendance cannot be changed because payroll is already locked for this month.",
      data: null,
    });
  }

  if (req.user?.role === "employee") {
    const employee = await ensureEmployeeProfileForUser(req.user);
    if (!employee || String(attendance.employeeId) !== String(employee._id)) {
      return res.status(403).json({ success: false, message: "Forbidden", data: null });
    }
    if (!ensureTodayForEmployee(attendance.date, timezone)) {
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

  const errorMessage = applyAttendancePayload({
    attendance,
    payload,
    attendanceSettings,
    timeZone: timezone,
    source: req.user?.role === "employee" ? "geo" : "manual",
  });
  if (errorMessage) {
    return res.status(400).json({ success: false, message: errorMessage, data: null });
  }

  if (payload.checkIn !== undefined) applyGeoFenceToAttendance(attendance, CHECK_IN, geoFenceResult?.data);
  if (payload.checkOut !== undefined) applyGeoFenceToAttendance(attendance, CHECK_OUT, geoFenceResult?.data);
  attendance.updatedBy = req.user?._id || null;
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

  const { attendanceSettings, timezone } = await resolvePolicyContext();
  const todayDate = normalizeAttendanceDate(new Date(), timezone);

  if (await isPayrollLockedForDate(employee._id, todayDate, timezone)) {
    return res.status(409).json({
      success: false,
      message: "Attendance cannot be changed because payroll is already locked for this month.",
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
  const timeText = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  let attendance = await loadAttendanceRecord(employee._id, todayDate, timezone);
  if (!attendance) {
    attendance = new Attendance({
      employeeId: employee._id,
      date: todayDate,
      dateKey: getDateKeyInTimeZone(todayDate, timezone),
      updatedBy: req.user?._id || null,
    });
  }

  if (action === CHECK_IN && attendance.checkInAt) {
    return res.status(409).json({
      success: false,
      message: "Check-in has already been recorded for today.",
      data: {
        attendance,
        validation: geoFenceResult.data.validation,
      },
    });
  }

  if (action === CHECK_OUT && attendance.checkOutAt) {
    return res.status(409).json({
      success: false,
      message: "Check-out has already been recorded for today.",
      data: {
        attendance,
        validation: geoFenceResult.data.validation,
      },
    });
  }

  if (action === CHECK_OUT && !attendance.checkInAt) {
    return res.status(400).json({
      success: false,
      message: "You must check in before checking out.",
      data: null,
    });
  }

  const payload = {
    date: todayDate,
    checkIn: action === CHECK_IN ? timeText : undefined,
    checkOut: action === CHECK_OUT ? timeText : undefined,
    status: attendance.status,
  };
  const errorMessage = applyAttendancePayload({
    attendance,
    payload,
    attendanceSettings,
    timeZone: timezone,
    source: "geo",
  });
  if (errorMessage) {
    return res.status(400).json({ success: false, message: errorMessage, data: null });
  }

  applyGeoFenceToAttendance(attendance, action, geoFenceResult.data);
  attendance.updatedBy = req.user?._id || null;
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

  const { attendanceSettings, timezone } = await resolvePolicyContext();
  const date = normalizeAttendanceDate(req.body?.date, timezone);
  if (await isPayrollLockedForDate(employeeId, date, timezone)) {
    return res.status(409).json({
      success: false,
      message: "Attendance cannot be changed because payroll is already locked for this month.",
      data: null,
    });
  }

  const existing = await loadAttendanceRecord(employeeId, date, timezone);
  const attendance =
    existing ||
    new Attendance({
      employeeId,
      date,
      dateKey: getDateKeyInTimeZone(date, timezone),
      updatedBy: req.user?._id || null,
      isManual: true,
    });

  const payload = {
    date,
    checkIn: req.body?.checkIn,
    checkOut: req.body?.checkOut,
    status: req.body?.status,
  };

  const errorMessage = applyAttendancePayload({
    attendance,
    payload,
    attendanceSettings,
    timeZone: timezone,
    source: "manual",
  });
  if (errorMessage) {
    return res.status(400).json({ success: false, message: errorMessage, data: null });
  }

  attendance.employeeId = employee._id;
  attendance.updatedBy = req.user?._id || null;
  attendance.isManual = true;
  await attendance.save();

  const populatedAttendance = await Attendance.findById(attendance._id)
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

  const { timezone } = await resolvePolicyContext();
  const date = normalizeAttendanceDate(req.body?.date, timezone);
  const today = normalizeAttendanceDate(new Date(), timezone);

  if (date > today) {
    return res.status(400).json({ success: false, message: "Future dates are not allowed.", data: null });
  }

  const type = req.body?.type;
  const time = String(req.body?.time || "").trim();
  const reason = String(req.body?.reason || "").trim();

  if (parseTimeStringToMinutes(time) === null) {
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

  const attendance = await loadAttendanceRecord(employee._id, date, timezone);
  if ((type === CHECK_IN && attendance?.checkInAt) || (type === CHECK_OUT && attendance?.checkOutAt)) {
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
    time: formatUtcTimeForDisplay(combineDateAndTimeToUtc(date, time, timezone), timezone),
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
    const { attendanceSettings, timezone } = await resolvePolicyContext();
    if (await isPayrollLockedForDate(request.employeeId, request.date, timezone)) {
      return res.status(409).json({
        success: false,
        message: "Attendance cannot be changed because payroll is already locked for this month.",
        data: null,
      });
    }

    let attendance = await loadAttendanceRecord(request.employeeId, request.date, timezone);
    if (!attendance) {
      attendance = new Attendance({
        employeeId: request.employeeId,
        date: normalizeAttendanceDate(request.date, timezone),
        dateKey: getDateKeyInTimeZone(request.date, timezone),
        updatedBy: req.user?._id || null,
        isManual: true,
      });
    }

    const payload =
      request.type === CHECK_IN
        ? { date: request.date, checkIn: request.time, status: attendance.status }
        : { date: request.date, checkOut: request.time, status: attendance.status };
    const errorMessage = applyAttendancePayload({
      attendance,
      payload,
      attendanceSettings,
      timeZone: timezone,
      source: "manual",
    });
    if (errorMessage) {
      return res.status(400).json({ success: false, message: errorMessage, data: null });
    }
    attendance.updatedBy = req.user?._id || null;
    attendance.isManual = true;
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
