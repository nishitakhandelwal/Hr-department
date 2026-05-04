const DEFAULT_TIMEZONE = "Asia/Kolkata";

export const ATTENDANCE_STATUSES = {
  PRESENT: "present",
  LATE: "late",
  HALF_DAY: "half_day",
  ABSENT: "absent",
  LEAVE: "leave",
};

const round2 = (value) => Number(Number(value || 0).toFixed(2));

export const parseTimeStringToMinutes = (value) => {
  const match = String(value || "").trim().toUpperCase().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (match) {
    return Number(match[1]) * 60 + Number(match[2]);
  }

  const twelveHour = String(value || "").trim().toUpperCase().match(/^(0?\d|1[0-2]):([0-5]\d)\s?(AM|PM)$/);
  if (!twelveHour) return null;

  let hours = Number(twelveHour[1]) % 12;
  if (twelveHour[3] === "PM") hours += 12;
  return hours * 60 + Number(twelveHour[2]);
};

export const formatMinutesAs12Hour = (minutes) => {
  if (!Number.isFinite(minutes)) return "";
  const normalized = Math.max(0, Number(minutes));
  const hours24 = Math.floor(normalized / 60) % 24;
  const mins = String(Math.floor(normalized % 60)).padStart(2, "0");
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, "0")}:${mins} ${period}`;
};

export const sanitizeAttendanceSettings = (settings = {}, fallbackTimezone = DEFAULT_TIMEZONE) => ({
  standardPunchInTime: String(settings?.standardPunchInTime || "10:00").trim() || "10:00",
  gracePeriodMinutes: Math.max(0, Number(settings?.gracePeriodMinutes || 15)),
  halfDayCutoffTime: String(settings?.halfDayCutoffTime || "14:00").trim() || "14:00",
  minimumWorkingHours: Math.min(24, Math.max(1, Number(settings?.minimumWorkingHours || 8))),
  missingPunchOutHandling:
    settings?.missingPunchOutHandling === "auto_close" ? "auto_close" : "mark_incomplete",
  autoCloseTime: String(settings?.autoCloseTime || "18:00").trim() || "18:00",
  timezone: String(settings?.timezone || fallbackTimezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE,
});

const zonedFormatterCache = new Map();

const getFormatter = (timeZone, options) => {
  const key = JSON.stringify({ timeZone, ...options });
  if (!zonedFormatterCache.has(key)) {
    zonedFormatterCache.set(
      key,
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        ...options,
      })
    );
  }
  return zonedFormatterCache.get(key);
};

export const getDatePartsInTimeZone = (value, timeZone = DEFAULT_TIMEZONE) => {
  const date = value instanceof Date ? value : new Date(value);
  const parts = getFormatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const read = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
  };
};

const getDateTimePartsInTimeZone = (value, timeZone = DEFAULT_TIMEZONE) => {
  const date = value instanceof Date ? value : new Date(value);
  const parts = getFormatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
};

const getTimeZoneOffset = (date, timeZone = DEFAULT_TIMEZONE) => {
  const parts = getDateTimePartsInTimeZone(date, timeZone);
  const utcTime = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return utcTime - date.getTime();
};

export const zonedDateTimeToUtc = ({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone = DEFAULT_TIMEZONE) => {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getTimeZoneOffset(guess, timeZone);
  return new Date(guess.getTime() - offset);
};

export const getDateKeyInTimeZone = (value, timeZone = DEFAULT_TIMEZONE) => {
  const { year, month, day } = getDatePartsInTimeZone(value, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export const getUtcDateForDateKey = (dateKey, timeZone = DEFAULT_TIMEZONE) => {
  const [yearRaw, monthRaw, dayRaw] = String(dateKey || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!year || !month || !day) {
    return zonedDateTimeToUtc(getDatePartsInTimeZone(new Date(), timeZone), timeZone);
  }
  return zonedDateTimeToUtc({ year, month, day, hour: 0, minute: 0, second: 0 }, timeZone);
};

export const normalizeAttendanceDate = (value, timeZone = DEFAULT_TIMEZONE) => {
  if (!value) {
    return getUtcDateForDateKey(getDateKeyInTimeZone(new Date(), timeZone), timeZone);
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return getUtcDateForDateKey(value.trim(), timeZone);
  }

  return getUtcDateForDateKey(getDateKeyInTimeZone(value, timeZone), timeZone);
};

export const combineDateAndTimeToUtc = (dateValue, timeValue, timeZone = DEFAULT_TIMEZONE) => {
  const minutes = parseTimeStringToMinutes(timeValue);
  if (minutes === null) return null;

  const dateKey =
    typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())
      ? dateValue.trim()
      : getDateKeyInTimeZone(dateValue, timeZone);

  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  return zonedDateTimeToUtc(
    {
      year,
      month,
      day,
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
      second: 0,
    },
    timeZone
  );
};

export const formatUtcTimeForDisplay = (value, timeZone = DEFAULT_TIMEZONE) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

export const calculateWorkingHours = (checkInAt, checkOutAt) => {
  if (!checkInAt || !checkOutAt) return 0;
  const start = new Date(checkInAt);
  const end = new Date(checkOutAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 0;
  return round2((end.getTime() - start.getTime()) / (1000 * 60 * 60));
};

export const resolveAttendanceStatus = ({
  checkInAt,
  explicitStatus = "",
  attendanceSettings,
  timeZone = DEFAULT_TIMEZONE,
}) => {
  const normalizedExplicit = String(explicitStatus || "").trim().toLowerCase();
  if ([ATTENDANCE_STATUSES.LEAVE, ATTENDANCE_STATUSES.ABSENT].includes(normalizedExplicit)) {
    return normalizedExplicit;
  }

  if (!checkInAt) {
    return normalizedExplicit || ATTENDANCE_STATUSES.ABSENT;
  }

  const localParts = getDateTimePartsInTimeZone(checkInAt, timeZone);
  const punchInMinutes = localParts.hour * 60 + localParts.minute;
  const standardPunchIn = parseTimeStringToMinutes(attendanceSettings.standardPunchInTime);
  const halfDayCutoff = parseTimeStringToMinutes(attendanceSettings.halfDayCutoffTime);
  const graceThreshold = (standardPunchIn ?? 0) + Number(attendanceSettings.gracePeriodMinutes || 0);

  if (halfDayCutoff !== null && punchInMinutes > halfDayCutoff) {
    return ATTENDANCE_STATUSES.HALF_DAY;
  }

  if (punchInMinutes > graceThreshold) {
    return ATTENDANCE_STATUSES.LATE;
  }

  return ATTENDANCE_STATUSES.PRESENT;
};

export const buildPolicyStatusReason = ({ status, attendanceSettings }) => {
  if (status === ATTENDANCE_STATUSES.HALF_DAY) {
    return `Punch-in exceeded half-day cutoff (${attendanceSettings.halfDayCutoffTime}).`;
  }
  if (status === ATTENDANCE_STATUSES.LATE) {
    return `Punch-in exceeded grace period after ${attendanceSettings.standardPunchInTime}.`;
  }
  if (status === ATTENDANCE_STATUSES.PRESENT) {
    return `Punch-in was within the configured grace period after ${attendanceSettings.standardPunchInTime}.`;
  }
  if (status === ATTENDANCE_STATUSES.LEAVE) {
    return "Attendance marked as leave.";
  }
  if (status === ATTENDANCE_STATUSES.ABSENT) {
    return "Attendance marked as absent.";
  }
  return "";
};

export const buildAttendancePunchEntries = ({
  checkInAt,
  checkOutAt,
  existingEntries = [],
  checkInLocation,
  checkOutLocation,
  source = "manual",
}) => {
  const retained = Array.isArray(existingEntries)
    ? existingEntries.filter((entry) => !["check-in", "check-out", "system-auto-close"].includes(String(entry?.type || "")))
    : [];

  const nextEntries = [...retained];
  if (checkInAt) {
    nextEntries.push({
      type: "check-in",
      timestamp: new Date(checkInAt),
      source,
      location: checkInLocation || undefined,
    });
  }
  if (checkOutAt) {
    nextEntries.push({
      type: checkOutLocation ? "check-out" : "system-auto-close",
      timestamp: new Date(checkOutAt),
      source: checkOutLocation ? source : "system",
      location: checkOutLocation || undefined,
    });
  }

  return nextEntries.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
};

export const reconcileAttendanceRecord = ({
  attendance,
  attendanceSettings,
  timeZone = DEFAULT_TIMEZONE,
  explicitStatus = "",
  now = new Date(),
}) => {
  const next = attendance;
  const todayKey = getDateKeyInTimeZone(now, timeZone);
  const recordKey = next.dateKey || getDateKeyInTimeZone(next.date || now, timeZone);

  next.dateKey = recordKey;
  next.date = normalizeAttendanceDate(recordKey, timeZone);

  let checkInAt = next.checkInAt ? new Date(next.checkInAt) : null;
  let checkOutAt = next.checkOutAt ? new Date(next.checkOutAt) : null;

  if (
    checkInAt &&
    !checkOutAt &&
    recordKey !== todayKey &&
    attendanceSettings.missingPunchOutHandling === "auto_close"
  ) {
    checkOutAt = combineDateAndTimeToUtc(recordKey, attendanceSettings.autoCloseTime, timeZone);
    next.autoClosedAt = checkOutAt;
  }

  const status = resolveAttendanceStatus({
    checkInAt,
    explicitStatus,
    attendanceSettings,
    timeZone,
  });
  const hoursWorked = calculateWorkingHours(checkInAt, checkOutAt);
  const overtimeHours =
    checkInAt && checkOutAt
      ? round2(Math.max(0, hoursWorked - Number(attendanceSettings.minimumWorkingHours || 0)))
      : 0;

  next.checkInAt = checkInAt || null;
  next.checkOutAt = checkOutAt || null;
  next.checkIn = formatUtcTimeForDisplay(checkInAt, timeZone);
  next.checkOut = formatUtcTimeForDisplay(checkOutAt, timeZone);
  next.hoursWorked = hoursWorked;
  next.workingMinutes = Math.max(0, Math.round(hoursWorked * 60));
  next.overtimeHours = overtimeHours;
  next.isIncomplete = Boolean(checkInAt && !checkOutAt && attendanceSettings.missingPunchOutHandling === "mark_incomplete");
  next.status = status;
  next.statusReason = buildPolicyStatusReason({ status, attendanceSettings });
  next.policySnapshot = {
    standardPunchInTime: attendanceSettings.standardPunchInTime,
    gracePeriodMinutes: attendanceSettings.gracePeriodMinutes,
    halfDayCutoffTime: attendanceSettings.halfDayCutoffTime,
    minimumWorkingHours: attendanceSettings.minimumWorkingHours,
    missingPunchOutHandling: attendanceSettings.missingPunchOutHandling,
    autoCloseTime: attendanceSettings.autoCloseTime,
    timezone: timeZone,
  };
  next.punchEntries = buildAttendancePunchEntries({
    checkInAt,
    checkOutAt,
    existingEntries: next.punchEntries,
    checkInLocation: next.checkInLocation,
    checkOutLocation: next.checkOutLocation,
    source: next.isManual ? "manual" : "geo",
  });

  return next;
};

export const getAttendanceMonthRange = (monthNumber, year, timeZone = DEFAULT_TIMEZONE) => {
  const start = getUtcDateForDateKey(`${year}-${String(monthNumber).padStart(2, "0")}-01`, timeZone);
  const nextMonth = monthNumber === 12 ? { year: year + 1, month: 1 } : { year, month: monthNumber + 1 };
  const end = getUtcDateForDateKey(
    `${nextMonth.year}-${String(nextMonth.month).padStart(2, "0")}-01`,
    timeZone
  );
  return { start, end };
};
