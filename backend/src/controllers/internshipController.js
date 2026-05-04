import { Candidate } from "../models/Candidate.js";
import { Internship } from "../models/Internship.js";
import { createAuditLogIfEnabled } from "../services/runtimeBehaviorService.js";
import { convertCandidateToEmployeeRecord } from "../services/recruitmentWorkflowService.js";
import { appendTimelineIfMissing, notifyCandidateAndAdmins, sendCandidateWorkflowEmail } from "../services/recruitmentWorkflowService.js";

const toString = (value) => String(value ?? "").trim();
const toPositiveNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const isAdminLike = (user) => user?.role === "admin" || ["super_admin", "admin", "hr_manager", "recruiter"].includes(user?.accessRole);

const INTERNSHIP_ACTIONS = {
  extend: {
    key: "extend",
    label: "Extend Internship",
    destructive: false,
    requiresNote: false,
    requiresReason: false,
    requiresEndDate: true,
    confirmTitle: "Extend internship",
    confirmDescription: "Update the internship end date while preserving the previous extension history.",
  },
  complete: {
    key: "complete",
    label: "Complete Internship",
    destructive: false,
    requiresNote: false,
    requiresReason: false,
    requiresEndDate: false,
    confirmTitle: "Complete internship",
    confirmDescription: "Mark the internship as completed and capture the completion timestamp.",
  },
  cancel: {
    key: "cancel",
    label: "Cancel Internship",
    destructive: true,
    requiresNote: false,
    requiresReason: false,
    requiresEndDate: false,
    confirmTitle: "Cancel internship",
    confirmDescription: "Immediately end the internship and optionally capture a cancellation reason.",
  },
  convert_to_employee: {
    key: "convert_to_employee",
    label: "Convert to Employee",
    destructive: false,
    requiresNote: false,
    requiresReason: false,
    requiresEndDate: false,
    confirmTitle: "Convert to employee",
    confirmDescription: "Create or reuse an employee record for this intern using the existing candidate profile.",
  },
};

const normalizeInternshipStatus = (status) => {
  const normalized = toString(status).toLowerCase();
  if (["assigned", "in progress", "extended", "active"].includes(normalized)) return "Active";
  if (["approved", "completed"].includes(normalized)) return "Completed";
  if (["rejected", "cancelled"].includes(normalized)) return "Cancelled";
  if (normalized === "converted to employee") return "Converted to Employee";
  return status || "Active";
};

const pushCandidateTimelineEvent = (candidate, event) => {
  candidate.activityTimeline = Array.isArray(candidate.activityTimeline) ? candidate.activityTimeline : [];
  candidate.activityTimeline.push({
    key: event.key,
    title: event.title,
    description: event.description,
    at: event.at || new Date(),
  });
};

const populateInternshipQuery = (query) =>
  query
    .populate("candidateId", "fullName email status convertedEmployeeId positionApplied joiningForm")
    .populate("assignedBy", "name email")
    .populate("reviewedBy", "name email")
    .populate("history.by", "name email")
    .populate("extensionHistory.by", "name email")
    .populate("completion.completedBy", "name email")
    .populate("cancellation.cancelledBy", "name email")
    .populate("conversion.convertedBy", "name email")
    .populate("conversion.employeeId", "employeeId fullName designation email");

const getAvailableInternshipActions = (internship) => {
  const status = normalizeInternshipStatus(internship?.status);
  const candidate = internship?.candidateId && typeof internship.candidateId === "object" ? internship.candidateId : null;
  const alreadyConverted =
    status === "Converted to Employee" ||
    Boolean(internship?.conversion?.employeeId) ||
    Boolean(candidate?.convertedEmployeeId) ||
    String(candidate?.status || "") === "Converted to Employee";

  const actionKeys = [];
  if (status === "Active") {
    actionKeys.push("extend", "complete", "cancel");
  }
  if (status === "Active" && !alreadyConverted) {
    actionKeys.push("convert_to_employee");
  }

  return actionKeys.map((key) => INTERNSHIP_ACTIONS[key]);
};

const serializeInternship = (internship) => {
  if (!internship) return internship;
  const data = typeof internship.toObject === "function" ? internship.toObject() : internship;
  return {
    ...data,
    status: normalizeInternshipStatus(data.status),
    availableActions: getAvailableInternshipActions(data),
  };
};

const buildHistoryEntry = ({ action, note = "", reason = "", statusFrom = "", statusTo = "", by = null, metadata = {} }) => ({
  action,
  label: INTERNSHIP_ACTIONS[action]?.label || action,
  note: toString(note) || toString(reason),
  statusFrom,
  statusTo,
  metadata,
  by,
  at: new Date(),
});

const syncCandidateInternshipState = ({ candidate, status, endDate, note = "", extensionDate = null }) => {
  candidate.internship = {
    ...candidate.internship,
    isAssigned: status !== "Cancelled",
    status,
    startDate: candidate.internship?.startDate || null,
    endDate: endDate || candidate.internship?.endDate || null,
    extensionDate: extensionDate || candidate.internship?.extensionDate || null,
    remarks: toString(note),
    updatedAt: new Date(),
  };
};

const mapCandidateInternshipState = async (candidateId, updater) => {
  const candidate = await Candidate.findById(candidateId);
  if (!candidate) return null;
  await updater(candidate);
  await candidate.save();
  return candidate;
};

export const listInternships = async (req, res) => {
  const filter = {};

  if (!isAdminLike(req.user)) {
    const candidate = await Candidate.findOne({ email: String(req.user?.email || "").toLowerCase().trim() });
    if (!candidate) {
      return res.json({ success: true, message: "Fetched internships", data: [] });
    }
    filter.candidateId = candidate._id;
  } else if (req.query.candidateId) {
    filter.candidateId = req.query.candidateId;
  }

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const rows = await populateInternshipQuery(Internship.find(filter)).sort({ createdAt: -1 });
  const data = rows.map((item) => serializeInternship(item));
  return res.json({ success: true, message: "Fetched internships", data });
};

export const getInternshipById = async (req, res) => {
  const data = await populateInternshipQuery(Internship.findById(req.params.id));
  if (!data) {
    return res.status(404).json({ success: false, message: "Internship not found" });
  }

  if (!isAdminLike(req.user)) {
    const candidate = await Candidate.findOne({ email: String(req.user?.email || "").toLowerCase().trim() });
    if (!candidate || String(candidate._id) !== String(data.candidateId?._id || data.candidateId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
  }

  return res.json({ success: true, message: "Fetched internship", data: serializeInternship(data) });
};

export const createInternship = async (req, res) => {
  const { candidateId, startDate, endDate, notes = "" } = req.body;
  if (!candidateId || !startDate || !endDate) {
    return res.status(400).json({ success: false, message: "candidateId, startDate and endDate are required." });
  }

  const candidate = await Candidate.findById(candidateId);
  if (!candidate) {
    return res.status(404).json({ success: false, message: "Candidate not found" });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return res.status(400).json({ success: false, message: "Invalid internship date range." });
  }

  const data = await Internship.create({
    candidateId,
    startDate: start,
    endDate: end,
    notes: toString(notes),
    status: "Active",
    assignedBy: req.user?._id ?? null,
    history: [buildHistoryEntry({ action: "assigned", note: toString(notes), statusFrom: "", statusTo: "Active", by: req.user?._id ?? null })],
  });

  candidate.status = "Internship";
  candidate.stageCompleted = Math.max(Number(candidate.stageCompleted || 0), 5);
  candidate.internship = {
    isAssigned: true,
    status: "Active",
    startDate: start,
    endDate: end,
    extensionDate: null,
    remarks: toString(notes),
    updatedAt: new Date(),
  };
  appendTimelineIfMissing(candidate, {
    key: "internship_assigned",
    title: "Internship Assigned",
    description: "Internship Period in Progress",
    at: new Date(),
  });
  await candidate.save();

  await notifyCandidateAndAdmins({
    candidate,
    title: "Internship Assigned",
    message: `${candidate.fullName} internship period is in progress.`,
    type: "candidate",
  });

  await sendCandidateWorkflowEmail({
    to: candidate.email,
    subject: "Internship assigned - Arihant Dream Infra Project Ltd.",
    message: `Your internship period is in progress from ${start.toDateString()} to ${end.toDateString()}.`,
  });

  const created = await populateInternshipQuery(Internship.findById(data._id));

  await createAuditLogIfEnabled({
    actorId: req.user?._id ?? null,
    actorName: req.user?.name || "",
    actorEmail: req.user?.email || "",
    action: "INTERNSHIP_ASSIGNED",
    targetType: "Internship",
    targetId: String(data._id),
    metadata: {
      candidateId: String(candidate._id),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    },
  });

  return res.status(201).json({ success: true, message: "Internship assigned", data: serializeInternship(created) });
};

export const updateInternship = async (req, res) => {
  const data = await Internship.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!data) {
    return res.status(404).json({ success: false, message: "Internship not found" });
  }
  return res.json({ success: true, message: "Internship updated", data });
};

export const applyInternshipAction = async (req, res) => {
  const { action, note = "", reason = "", newEndDate = null, departmentId = "", designation = "", salary = null, joiningDate = null } = req.body;
  if (!action || !Object.keys(INTERNSHIP_ACTIONS).includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid action." });
  }

  const internship = await Internship.findById(req.params.id);
  if (!internship) {
    return res.status(404).json({ success: false, message: "Internship not found" });
  }

  const currentStatus = normalizeInternshipStatus(internship.status);
  const hydratedInternship = await populateInternshipQuery(Internship.findById(req.params.id));
  const allowedActions = getAvailableInternshipActions(hydratedInternship).map((item) => item.key);
  if (!allowedActions.includes(action)) {
    return res.status(409).json({ success: false, message: `Action "${action}" is not allowed while internship status is ${currentStatus}.` });
  }

  let actionStatus = currentStatus;
  let resultEmployee = null;
  let candidate = null;

  if (action === "extend" || action === "complete" || action === "cancel") {
    candidate = await mapCandidateInternshipState(internship.candidateId, async (candidateDoc) => {
      candidateDoc.status = candidateDoc.status || "Internship";

      if (action === "extend") {
        const extensionDate = newEndDate ? new Date(newEndDate) : null;
        if (!extensionDate || Number.isNaN(extensionDate.getTime())) {
          const error = new Error("A valid new end date is required for internship extension.");
          error.statusCode = 400;
          throw error;
        }
        if (extensionDate <= new Date(internship.endDate)) {
          const error = new Error("The extended end date must be after the current end date.");
          error.statusCode = 400;
          throw error;
        }

        internship.extensionHistory = Array.isArray(internship.extensionHistory) ? internship.extensionHistory : [];
        internship.extensionHistory.push({
          previousEndDate: internship.endDate,
          newEndDate: extensionDate,
          reason: toString(reason),
          note: toString(note),
          by: req.user?._id ?? null,
          at: new Date(),
        });
        internship.endDate = extensionDate;
        internship.extendedTill = extensionDate;
        internship.extensionReason = toString(reason) || toString(note);
        internship.status = "Active";
        actionStatus = "Active";

        candidateDoc.status = "Internship";
        syncCandidateInternshipState({
          candidate: candidateDoc,
          status: "Active",
          endDate: extensionDate,
          note: toString(note) || toString(reason),
          extensionDate,
        });
        pushCandidateTimelineEvent(candidateDoc, {
          key: `internship_extended_${Date.now()}`,
          title: "Internship Extended",
          description: `Internship extended to ${extensionDate.toDateString()}.`,
          at: new Date(),
        });
      }

      if (action === "complete") {
        internship.status = "Completed";
        internship.completion = {
          completedAt: new Date(),
          completedBy: req.user?._id ?? null,
          note: toString(note),
        };
        actionStatus = "Completed";

        candidateDoc.status = "Internship";
        syncCandidateInternshipState({
          candidate: candidateDoc,
          status: "Completed",
          endDate: internship.endDate,
          note: toString(note),
        });
        pushCandidateTimelineEvent(candidateDoc, {
          key: `internship_completed_${Date.now()}`,
          title: "Internship Completed",
          description: "Internship has been marked as completed.",
          at: new Date(),
        });
      }

      if (action === "cancel") {
        const cancelledAt = new Date();
        internship.status = "Cancelled";
        internship.endDate = cancelledAt;
        internship.cancellation = {
          cancelledAt,
          cancelledBy: req.user?._id ?? null,
          reason: toString(reason),
          note: toString(note),
        };
        actionStatus = "Cancelled";

        candidateDoc.status = "Internship";
        syncCandidateInternshipState({
          candidate: candidateDoc,
          status: "Cancelled",
          endDate: cancelledAt,
          note: toString(reason) || toString(note),
        });
        pushCandidateTimelineEvent(candidateDoc, {
          key: `internship_cancelled_${Date.now()}`,
          title: "Internship Cancelled",
          description: "Internship has been cancelled.",
          at: new Date(),
        });
      }
    });
  }

  if (action === "convert_to_employee") {
    const convertedAt = new Date();
    const conversion = await convertCandidateToEmployeeRecord({
      candidateId: String(internship.candidateId),
      actor: req.user,
      departmentId,
      designation,
      salary: toPositiveNumberOrNull(salary),
      joiningDate,
      enforceJoiningFormApproved: false,
    });
    resultEmployee = conversion.employee;
    actionStatus = "Converted to Employee";
    internship.status = "Converted to Employee";
    internship.endDate = convertedAt;
    internship.conversion = {
      convertedAt,
      convertedBy: req.user?._id ?? null,
      employeeId: conversion.employee?._id || null,
      note: toString(note),
    };
    conversion.candidate.internship = {
      ...conversion.candidate.internship,
      isAssigned: true,
      status: "Converted to Employee",
      startDate: conversion.candidate.internship?.startDate || internship.startDate,
      endDate: convertedAt,
      extensionDate: conversion.candidate.internship?.extensionDate || internship.extendedTill || null,
      remarks: toString(note),
      updatedAt: convertedAt,
    };
    pushCandidateTimelineEvent(conversion.candidate, {
      key: `internship_converted_${Date.now()}`,
      title: "Internship Converted",
      description: "Internship has been converted to an employee record.",
      at: convertedAt,
    });
    await conversion.candidate.save();
    candidate = conversion.candidate;
  }

  internship.reviewedBy = req.user?._id ?? null;
  internship.history = Array.isArray(internship.history) ? internship.history : [];
  internship.history.push(
    buildHistoryEntry({
      action,
      note: toString(note),
      reason: toString(reason),
      statusFrom: currentStatus,
      statusTo: actionStatus,
      by: req.user?._id ?? null,
      metadata:
        action === "extend"
          ? {
              previousEndDate: internship.extensionHistory?.[internship.extensionHistory.length - 1]?.previousEndDate || null,
              newEndDate: internship.endDate,
            }
          : action === "cancel"
            ? { effectiveEndDate: internship.endDate }
          : action === "convert_to_employee"
            ? { employeeId: resultEmployee?._id || null, effectiveEndDate: internship.endDate }
            : {},
    })
  );
  await internship.save();

  if (candidate) {
    await notifyCandidateAndAdmins({
      candidate,
      title: INTERNSHIP_ACTIONS[action].label,
      message: `${candidate.fullName} internship updated: ${INTERNSHIP_ACTIONS[action].label}.`,
      type: "candidate",
    });
  }

  await createAuditLogIfEnabled({
    actorId: req.user?._id ?? null,
    actorName: req.user?.name || "",
    actorEmail: req.user?.email || "",
    action: `INTERNSHIP_${action.toUpperCase()}`,
    targetType: "Internship",
    targetId: String(internship._id),
    metadata: {
      candidateId: String(internship.candidateId),
      statusFrom: currentStatus,
      statusTo: actionStatus,
      reason: toString(reason),
      note: toString(note),
      newEndDate: newEndDate || null,
      employeeId: resultEmployee?._id ? String(resultEmployee._id) : null,
    },
  });

  const refreshed = await populateInternshipQuery(Internship.findById(internship._id));
  return res.json({
    success: true,
    message: `${INTERNSHIP_ACTIONS[action].label} applied successfully.`,
    data: serializeInternship(refreshed),
  });
};

export const decideInternship = applyInternshipAction;

export const deleteInternship = async (req, res) => {
  const data = await Internship.findByIdAndDelete(req.params.id);
  if (!data) {
    return res.status(404).json({ success: false, message: "Internship not found" });
  }
  return res.json({ success: true, message: "Internship deleted", data });
};
