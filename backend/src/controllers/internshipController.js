import { Candidate } from "../models/Candidate.js";
import { Internship } from "../models/Internship.js";
import { appendTimelineIfMissing, notifyCandidateAndAdmins, sendCandidateWorkflowEmail } from "../services/recruitmentWorkflowService.js";

const toString = (value) => String(value ?? "").trim();

const isAdminLike = (user) => user?.role === "admin" || ["super_admin", "admin", "hr_manager", "recruiter"].includes(user?.accessRole);

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

  const data = await Internship.find(filter).populate("candidateId", "fullName email status").sort({ createdAt: -1 });
  return res.json({ success: true, message: "Fetched internships", data });
};

export const getInternshipById = async (req, res) => {
  const data = await Internship.findById(req.params.id).populate("candidateId", "fullName email status");
  if (!data) {
    return res.status(404).json({ success: false, message: "Internship not found" });
  }

  if (!isAdminLike(req.user)) {
    const candidate = await Candidate.findOne({ email: String(req.user?.email || "").toLowerCase().trim() });
    if (!candidate || String(candidate._id) !== String(data.candidateId?._id || data.candidateId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
  }

  return res.json({ success: true, message: "Fetched internship", data });
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
    status: "Assigned",
    assignedBy: req.user?._id ?? null,
    history: [{ action: "assigned", note: toString(notes), by: req.user?._id ?? null }],
  });

  candidate.status = "Internship";
  candidate.stageCompleted = Math.max(Number(candidate.stageCompleted || 0), 5);
  candidate.internship = {
    isAssigned: true,
    status: "Assigned",
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
    subject: "Internship assigned - HR Harmony Hub",
    message: `Your internship period is in progress from ${start.toDateString()} to ${end.toDateString()}.`,
  });

  return res.status(201).json({ success: true, message: "Internship assigned", data });
};

export const updateInternship = async (req, res) => {
  const data = await Internship.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!data) {
    return res.status(404).json({ success: false, message: "Internship not found" });
  }
  return res.json({ success: true, message: "Internship updated", data });
};

export const decideInternship = async (req, res) => {
  const { action, note = "", newEndDate = null } = req.body;
  if (!action || !["approve", "reject", "extend"].includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid action. Use approve/reject/extend." });
  }

  const internship = await Internship.findById(req.params.id);
  if (!internship) {
    return res.status(404).json({ success: false, message: "Internship not found" });
  }

  const candidate = await mapCandidateInternshipState(internship.candidateId, async (candidateDoc) => {
    if (action === "approve") {
      internship.status = "Approved";
      candidateDoc.internship = {
        ...candidateDoc.internship,
        status: "Approved",
        remarks: toString(note),
        updatedAt: new Date(),
      };
      candidateDoc.status = "Selected";
      appendTimelineIfMissing(candidateDoc, {
        key: "internship_approved",
        title: "Internship Approved",
        description: "Internship completed and approved.",
        at: new Date(),
      });
    }

    if (action === "reject") {
      internship.status = "Rejected";
      candidateDoc.internship = {
        ...candidateDoc.internship,
        status: "Rejected",
        remarks: toString(note),
        updatedAt: new Date(),
      };
      candidateDoc.status = "Rejected";
      appendTimelineIfMissing(candidateDoc, {
        key: "internship_rejected",
        title: "Internship Rejected",
        description: "Internship was not approved.",
        at: new Date(),
      });
    }

    if (action === "extend") {
      const extensionDate = newEndDate ? new Date(newEndDate) : null;
      if (!extensionDate || Number.isNaN(extensionDate.getTime())) {
        const error = new Error("A valid newEndDate is required for internship extension.");
        error.statusCode = 400;
        throw error;
      }
      internship.status = "Extended";
      internship.extendedTill = extensionDate;
      internship.extensionReason = toString(note);
      candidateDoc.internship = {
        ...candidateDoc.internship,
        status: "Extended",
        extensionDate,
        remarks: toString(note),
        updatedAt: new Date(),
      };
      candidateDoc.status = "Internship";
      appendTimelineIfMissing(candidateDoc, {
        key: "internship_extended",
        title: "Internship Extended",
        description: "Internship duration has been extended.",
        at: new Date(),
      });
    }
  });

  internship.reviewedBy = req.user?._id ?? null;
  internship.history = Array.isArray(internship.history) ? internship.history : [];
  internship.history.push({ action, note: toString(note), by: req.user?._id ?? null, at: new Date() });
  await internship.save();

  if (candidate) {
    await notifyCandidateAndAdmins({
      candidate,
      title: "Internship Update",
      message: `${candidate.fullName} internship decision: ${action}.`,
      type: "candidate",
    });
  }

  return res.json({ success: true, message: "Internship decision applied", data: internship });
};

export const deleteInternship = async (req, res) => {
  const data = await Internship.findByIdAndDelete(req.params.id);
  if (!data) {
    return res.status(404).json({ success: false, message: "Internship not found" });
  }
  return res.json({ success: true, message: "Internship deleted", data });
};
