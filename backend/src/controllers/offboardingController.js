import { Offboarding } from "../models/Offboarding.js";
import { Employee } from "../models/Employee.js";

const STATUS_VALUES = new Set(["pending", "approved", "completed", "rejected"]);
const EXIT_TYPES = new Set(["resignation", "termination", "absconding"]);
const REHIRE_VALUES = new Set(["eligible", "not_eligible", "under_review"]);
const REQUEST_STATUS_VALUES = new Set(["pending", "approved", "rejected"]);

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeStatus = (value, fallback = "pending") => {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  return STATUS_VALUES.has(normalized) ? normalized : fallback;
};

const normalizeExitType = (value, fallback = "resignation") => {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  return EXIT_TYPES.has(normalized) ? normalized : fallback;
};

const normalizeRehireEligibility = (value, fallback = "under_review") => {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  return REHIRE_VALUES.has(normalized) ? normalized : fallback;
};

const normalizeRequestStatus = (value, fallback = "pending") => {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  return REQUEST_STATUS_VALUES.has(normalized) ? normalized : fallback;
};

const toNullableDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const trimText = (value) => String(value || "").trim();

const normalizeDocument = (value = {}) => ({
  key: trimText(value.key),
  url: trimText(value.url),
  originalName: trimText(value.originalName || value.fileName),
  mimeType: trimText(value.mimeType),
  size: Number(value.size || 0),
  uploadedAt: toNullableDate(value.uploadedAt) || (value.url ? new Date() : null),
});

const buildOffboardingPayload = ({ body = {}, employee = null, existing = null }) => {
  const current = existing ? (typeof existing.toObject === "function" ? existing.toObject() : existing) : {};
  const employeeName =
    trimText(body.employeeName || body.name) ||
    trimText(employee?.fullName) ||
    trimText(current.employeeName || current.name);
  const department =
    trimText(body.department) ||
    trimText(employee?.department || employee?.departmentName) ||
    trimText(current.department);

  return {
    employeeRef: employee?._id || current.employeeRef || null,
    employeeCode: trimText(body.employeeCode || body.employeeId) || trimText(employee?.employeeId) || trimText(current.employeeCode),
    employeeName,
    employeeEmail: trimText(body.employeeEmail) || trimText(employee?.email) || trimText(current.employeeEmail),
    department,
    managerName: trimText(body.managerName || body.reportingPerson) || trimText(current.managerName),
    joiningDate: toNullableDate(body.joiningDate) || employee?.joiningDate || current.joiningDate || null,
    exitType: normalizeExitType(body.exitType || body.reason, current.exitType || "resignation"),
    noticePeriod: trimText(body.noticePeriod) || trimText(current.noticePeriod),
    lastWorkingDay: toNullableDate(body.lastWorkingDay || body.lastDay) || current.lastWorkingDay || current.lastDay || null,
    actualLastWorkingDay: toNullableDate(body.actualLastWorkingDay) || current.actualLastWorkingDay || null,
    exitInterviewStatus: normalizeStatus(body.exitInterviewStatus, current.exitInterviewStatus || "pending"),
    clearanceStatus: {
      hr: normalizeStatus(body.clearanceStatus?.hr, current.clearanceStatus?.hr || "pending"),
      it: normalizeStatus(body.clearanceStatus?.it, current.clearanceStatus?.it || "pending"),
      finance: normalizeStatus(body.clearanceStatus?.finance, current.clearanceStatus?.finance || "pending"),
    },
    assetsReturnStatus: normalizeStatus(body.assetsReturnStatus, current.assetsReturnStatus || "pending"),
    fnfStatus: normalizeStatus(body.fnfStatus, current.fnfStatus || "pending"),
    rehireEligibility: normalizeRehireEligibility(body.rehireEligibility, current.rehireEligibility || "under_review"),
    status: normalizeStatus(body.status, current.status || "pending"),
    remarks: trimText(body.remarks) || trimText(current.remarks),
    employeeRemarks: trimText(body.employeeRemarks) || trimText(current.employeeRemarks),
    documents: {
      relievingLetter: normalizeDocument(body.documents?.relievingLetter || current.documents?.relievingLetter),
      experienceLetter: normalizeDocument(body.documents?.experienceLetter || current.documents?.experienceLetter),
      clearanceForm: normalizeDocument(body.documents?.clearanceForm || current.documents?.clearanceForm),
      exitForm: normalizeDocument(body.documents?.exitForm || current.documents?.exitForm),
    },
    employeeChecklist: {
      exitFormSubmitted:
        typeof body.employeeChecklist?.exitFormSubmitted === "boolean"
          ? body.employeeChecklist.exitFormSubmitted
          : Boolean(current.employeeChecklist?.exitFormSubmitted),
      exitInterviewCompleted:
        typeof body.employeeChecklist?.exitInterviewCompleted === "boolean"
          ? body.employeeChecklist.exitInterviewCompleted
          : Boolean(current.employeeChecklist?.exitInterviewCompleted),
      assetsReturned:
        typeof body.employeeChecklist?.assetsReturned === "boolean"
          ? body.employeeChecklist.assetsReturned
          : Boolean(current.employeeChecklist?.assetsReturned),
      documentsAcknowledged:
        typeof body.employeeChecklist?.documentsAcknowledged === "boolean"
          ? body.employeeChecklist.documentsAcknowledged
          : Boolean(current.employeeChecklist?.documentsAcknowledged),
    },
    resignationRequest:
      body.resignationRequest || current.resignationRequest
        ? {
            status: normalizeRequestStatus(body.resignationRequest?.status, current.resignationRequest?.status || "pending"),
            reason: trimText(body.resignationRequest?.reason) || trimText(current.resignationRequest?.reason),
            comments: trimText(body.resignationRequest?.comments) || trimText(current.resignationRequest?.comments),
            noticePeriod: trimText(body.resignationRequest?.noticePeriod) || trimText(current.resignationRequest?.noticePeriod),
            lastWorkingDay:
              toNullableDate(body.resignationRequest?.lastWorkingDay) ||
              current.resignationRequest?.lastWorkingDay ||
              null,
            submittedAt:
              toNullableDate(body.resignationRequest?.submittedAt) ||
              current.resignationRequest?.submittedAt ||
              null,
            reviewedAt:
              toNullableDate(body.resignationRequest?.reviewedAt) ||
              current.resignationRequest?.reviewedAt ||
              null,
            reviewedByName:
              trimText(body.resignationRequest?.reviewedByName) || trimText(current.resignationRequest?.reviewedByName),
            reviewComments:
              trimText(body.resignationRequest?.reviewComments) || trimText(current.resignationRequest?.reviewComments),
          }
        : null,
    offboardingStartedAt: toNullableDate(body.offboardingStartedAt) || current.offboardingStartedAt || null,
    // legacy mirrors
    name: employeeName,
    reason: normalizeExitType(body.exitType || body.reason, current.exitType || "resignation"),
    lastDay: toNullableDate(body.lastWorkingDay || body.lastDay) || current.lastWorkingDay || current.lastDay || null,
  };
};

const serializeOffboarding = (record) => {
  const doc = typeof record?.toObject === "function" ? record.toObject() : record;
  if (!doc) return null;

  return {
    ...doc,
    employeeId: doc.employeeCode || "",
    reportingPerson: doc.managerName || "",
    name: doc.employeeName || doc.name || "",
    reason: doc.exitType || doc.reason || "",
    lastDay: doc.lastWorkingDay || doc.lastDay || null,
  };
};

const findEmployeeForRequest = async (body) => {
  const rawId = String(body.employeeRef || body.employeeRecordId || body.employeeMongoId || "").trim();
  if (!rawId) return null;
  const employee = await Employee.findById(rawId).lean();
  if (!employee) throw createError("Employee not found for offboarding.", 404);
  return employee;
};

const findEmployeeForUser = async (userId) => {
  const employee = await Employee.findOne({ userId }).lean();
  if (!employee) throw createError("Employee profile not found.", 404);
  return employee;
};

const findLatestEmployeeOffboarding = async (employee) =>
  Offboarding.findOne({
    $or: [{ employeeRef: employee._id }, { employeeCode: employee.employeeId }],
  }).sort({ createdAt: -1 });

export const getOffboarding = async (_req, res) => {
  const rows = await Offboarding.find().sort({ createdAt: -1 });
  res.json({ success: true, message: "Fetched offboarding", data: rows.map(serializeOffboarding) });
};

export const createOffboarding = async (req, res) => {
  const employee = await findEmployeeForRequest(req.body);
  const payload = buildOffboardingPayload({ body: req.body, employee });

  if (!payload.employeeName || !payload.department || !payload.lastWorkingDay) {
    throw createError("Employee name, department, and last working day are required.", 422);
  }

  const created = await Offboarding.create(payload);
  res.status(201).json({ success: true, message: "Created offboarding", data: serializeOffboarding(created) });
};

export const updateOffboarding = async (req, res) => {
  const existing = await Offboarding.findById(req.params.id);
  if (!existing) throw createError("Offboarding record not found.", 404);

  const employee = req.body.employeeRef || req.body.employeeRecordId || req.body.employeeMongoId
    ? await findEmployeeForRequest(req.body)
    : null;

  const payload = buildOffboardingPayload({ body: req.body, employee, existing });
  Object.assign(existing, payload);
  await existing.save();

  res.json({ success: true, message: "Updated offboarding", data: serializeOffboarding(existing) });
};

export const deleteOffboarding = async (req, res) => {
  const deleted = await Offboarding.findByIdAndDelete(req.params.id);
  if (!deleted) throw createError("Offboarding record not found.", 404);
  res.json({ success: true, message: "Deleted offboarding", data: serializeOffboarding(deleted) });
};

export const getMyOffboarding = async (req, res) => {
  const employee = await Employee.findOne({ userId: req.user._id }).lean();
  if (!employee) return res.json({ success: true, message: "No employee profile found", data: null });

  const record = await findLatestEmployeeOffboarding(employee);

  return res.json({ success: true, message: "Fetched employee offboarding", data: serializeOffboarding(record) });
};

export const submitMyResignation = async (req, res) => {
  const employee = await findEmployeeForUser(req.user._id);
  const reason = trimText(req.body.reason);
  const comments = trimText(req.body.comments);
  const noticePeriod = trimText(req.body.noticePeriod);
  const lastWorkingDay = toNullableDate(req.body.lastWorkingDay);

  if (!reason || !noticePeriod || !lastWorkingDay) {
    throw createError("Reason, notice period, and last working day are required.", 422);
  }

  const latest = await findLatestEmployeeOffboarding(employee);
  const hasOpenRequest =
    latest &&
    ["pending", "approved"].includes(normalizeRequestStatus(latest.resignationRequest?.status, "")) &&
    latest.status !== "rejected";
  if (hasOpenRequest) {
    throw createError("A resignation request already exists for this employee.", 409);
  }

  const payload = buildOffboardingPayload({
    body: {
      employeeRef: employee._id,
      employeeName: employee.fullName,
      employeeCode: employee.employeeId,
      employeeEmail: employee.email,
      department: employee.department || employee.departmentName,
      joiningDate: employee.joiningDate,
      exitType: "resignation",
      noticePeriod,
      lastWorkingDay,
      status: "pending",
      remarks: "",
      employeeRemarks: comments,
      resignationRequest: {
        status: "pending",
        reason,
        comments,
        noticePeriod,
        lastWorkingDay,
        submittedAt: new Date(),
      },
    },
    employee,
  });

  const created = await Offboarding.create(payload);
  res.status(201).json({ success: true, message: "Resignation submitted", data: serializeOffboarding(created) });
};

export const reviewResignationRequest = async (req, res) => {
  const record = await Offboarding.findById(req.params.id);
  if (!record) throw createError("Offboarding record not found.", 404);
  if (!record.resignationRequest) throw createError("No resignation request found on this record.", 404);

  const decision = normalizeRequestStatus(req.body.decision);
  if (!["approved", "rejected"].includes(decision)) {
    throw createError("Decision must be approved or rejected.", 422);
  }

  record.resignationRequest.status = decision;
  record.resignationRequest.reviewedAt = new Date();
  record.resignationRequest.reviewedByName = trimText(req.user?.name);
  record.resignationRequest.reviewComments = trimText(req.body.reviewComments);
  record.employeeRemarks = trimText(record.employeeRemarks || record.resignationRequest.comments);
  record.noticePeriod = trimText(record.noticePeriod || record.resignationRequest.noticePeriod);
  record.lastWorkingDay = record.lastWorkingDay || record.resignationRequest.lastWorkingDay || null;
  record.exitType = "resignation";

  if (decision === "approved") {
    record.status = "pending";
    record.offboardingStartedAt = new Date();
  } else {
    record.status = "rejected";
  }

  await record.save();
  res.json({ success: true, message: "Resignation request reviewed", data: serializeOffboarding(record) });
};

export const updateMyOffboardingActions = async (req, res) => {
  const employee = await Employee.findOne({ userId: req.user._id }).lean();
  if (!employee) throw createError("Employee profile not found.", 404);

  const record = await Offboarding.findOne({
    $or: [{ employeeRef: employee._id }, { employeeCode: employee.employeeId }],
  }).sort({ createdAt: -1 });

  if (!record) throw createError("No offboarding case assigned yet.", 404);

  if (req.body.documents?.exitForm) {
    record.documents.exitForm = normalizeDocument(req.body.documents.exitForm);
    record.employeeChecklist.exitFormSubmitted = Boolean(record.documents.exitForm?.url);
  }
  if (typeof req.body.completeExitInterview === "boolean" && req.body.completeExitInterview) {
    record.exitInterviewStatus = "completed";
    record.employeeChecklist.exitInterviewCompleted = true;
  }
  if (typeof req.body.confirmAssetReturn === "boolean" && req.body.confirmAssetReturn) {
    record.assetsReturnStatus = "completed";
    record.employeeChecklist.assetsReturned = true;
  }
  if (typeof req.body.acknowledgeDocuments === "boolean") {
    record.employeeChecklist.documentsAcknowledged = req.body.acknowledgeDocuments;
  }
  if (typeof req.body.employeeRemarks === "string") {
    record.employeeRemarks = trimText(req.body.employeeRemarks);
  }

  await record.save();

  res.json({ success: true, message: "Updated employee offboarding actions", data: serializeOffboarding(record) });
};
