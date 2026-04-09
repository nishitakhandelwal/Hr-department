import fs from "fs";
import path from "path";
import { Candidate, CandidateStatuses } from "../models/Candidate.js";
import { GeneratedLetter } from "../models/GeneratedLetter.js";
import { Internship } from "../models/Internship.js";
import { JoiningForm } from "../models/JoiningForm.js";
import { LetterTemplate } from "../models/LetterTemplate.js";
import { env } from "../config/env.js";
import { generateOfferLetterHtml } from "../lib/letterTemplates.js";
import { sendEmail } from "../services/emailService.js";
import {
  appendTimelineIfMissing,
  convertCandidateToEmployeeRecord,
  notifyCandidateAndAdmins,
  sendCandidateWorkflowEmail,
} from "../services/recruitmentWorkflowService.js";
import {
  createAuditLogIfEnabled,
  maybeSendEmailBySettings,
  removeUploadedFileIfExists,
  validateUploadedFileAgainstSettings,
} from "../services/runtimeBehaviorService.js";
import { uploadsDir } from "../utils/paths.js";
import { secureUploadUrls } from "../utils/uploadAccess.js";

const STATUS_TRANSITIONS = {
  Draft: ["Applied"],
  Applied: ["Profile Completed", "HR Review", "Under Review", "Interview", "Interview Scheduled", "Selected", "Rejected"],
  "Profile Completed": ["HR Review", "Under Review", "Interview", "Interview Scheduled", "Selected", "Rejected"],
  "HR Review": ["Interview", "Interview Scheduled", "Selected", "Rejected"],
  "Under Review": ["Interview", "Interview Scheduled", "Selected", "Rejected"],
  Interview: ["Selected", "Rejected", "HR Review", "Under Review"],
  "Interview Scheduled": ["Selected", "Rejected", "HR Review", "Under Review"],
  Selected: ["Internship", "Offered", "Joining Form Requested", "Converted to Employee", "Rejected"],
  Internship: ["Selected", "Joining Form Requested", "Rejected"],
  Offered: ["Joining Form Requested", "Converted to Employee", "Rejected", "Accepted"],
  "Joining Form Requested": ["Joining Form Submitted", "Joining Form Correction Requested", "Rejected"],
  "Joining Form Submitted": ["Employee Onboarding", "Converted to Employee", "Joining Form Correction Requested", "Rejected"],
  "Joining Form Correction Requested": ["Joining Form Submitted", "Rejected"],
  "Joining Form Rejected": ["Rejected"],
  "Employee Onboarding": ["Converted to Employee"],
  "Converted to Employee": [],
  Accepted: ["Converted to Employee"],
  Rejected: [],
};

const LEGACY_STATUS_MAP = {
  applied: "Applied",
  shortlisted: "Under Review",
  trial: "Interview Scheduled",
  selected: "Selected",
  hired: "Selected",
  rejected: "Rejected",
};

const toString = (value) => String(value ?? "").trim();
const toLowerEmail = (value) => String(value ?? "").toLowerCase().trim();
const buildArchivedCandidateEmail = (candidate) => {
  const originalEmail = toLowerEmail(candidate?.email);
  if (!originalEmail) return `archived+${String(candidate?._id || Date.now())}@candidate.local`;
  const [localPart = "archived", domainPart = "candidate.local"] = originalEmail.split("@");
  return `archived+${String(candidate?._id || Date.now())}-${localPart}@${domainPart || "candidate.local"}`;
};

const normalizeAccommodation = (personalDetails = {}) =>
  toString(personalDetails.presentResidentialAccommodation || personalDetails.domicile);

const normalizeStatus = (status) => {
  const normalized = LEGACY_STATUS_MAP[String(status || "").trim().toLowerCase()] || status;
  return toString(normalized);
};

const sanitizeQualifications = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      degree: toString(item?.degree),
      institute: toString(item?.institute),
      year: toString(item?.year),
      percentage: toString(item?.percentage),
    }))
    .filter((item) => item.degree || item.institute || item.year || item.percentage);

const sanitizeReferences = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      name: toString(item?.name),
      relationship: toString(item?.relationship),
      company: toString(item?.company),
      contact: toString(item?.contact || item?.contactNumber),
      email: toLowerEmail(item?.email),
    }))
    .filter((item) => item.name || item.relationship || item.company || item.contact || item.email);

const sanitizeEmployment = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      company: toString(item?.company),
      designation: toString(item?.designation),
      from: toString(item?.from),
      to: toString(item?.to),
      responsibilities: toString(item?.responsibilities),
    }))
    .filter((item) => item.company || item.designation || item.from || item.to || item.responsibilities);

const mapDocumentFile = (req, file) => {
  if (!file) return null;
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return {
    url: `${baseUrl}/uploads/${encodeURIComponent(path.basename(file.path))}`,
    originalName: file.originalname || file.filename || "",
    uploadedAt: new Date(),
  };
};

const mapVideoFile = (req, file, source = "uploaded") => {
  if (!file) return null;
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return {
    url: `${baseUrl}/uploads/candidate-videos/${encodeURIComponent(path.basename(file.path))}`,
    originalName: file.originalname || file.filename || "",
    mimeType: file.mimetype || "",
    size: Number(file.size || 0),
    source: source === "recorded" ? "recorded" : "uploaded",
    uploadedAt: new Date(),
  };
};

const serializeCandidateForResponse = (req, user, candidate) => secureUploadUrls(candidate, req, user);

const LETTERS_FOLDER = path.join(uploadsDir, "letters");
if (!fs.existsSync(LETTERS_FOLDER)) {
  fs.mkdirSync(LETTERS_FOLDER, { recursive: true });
}

const OFFER_TEMPLATE_NAME = "Offer Letter";
const OFFER_TEMPLATE_VARIABLES = [
  "candidateName",
  "position",
  "joiningDate",
  "salary",
  "date",
  "companyName",
  "address",
];

const sanitizeFileToken = (value, fallback = "offer-letter") => {
  const token = toString(value).replace(/[^a-zA-Z0-9._-]/g, "-");
  return token || fallback;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const generateOfferLetterNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `AG/${year}/OFFER`;
  const count = await GeneratedLetter.countDocuments({ letterNumber: { $regex: `^${prefix}/` } });
  return `${prefix}/${String(count + 1).padStart(3, "0")}`;
};

const generateOfferPdfBuffer = async (htmlContent) => {
  let browser;
  try {
    const puppeteerModule = await import("puppeteer");
    browser = await puppeteerModule.default.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdfRaw = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", right: "12mm", bottom: "18mm", left: "12mm" },
    });
    return Buffer.isBuffer(pdfRaw) ? pdfRaw : Buffer.from(pdfRaw);
  } catch (error) {
    const pdfError = new Error(error instanceof Error ? error.message : "Failed to generate offer letter PDF.");
    pdfError.statusCode = error?.statusCode || 500;
    throw pdfError;
  } finally {
    if (browser) await browser.close();
  }
};

const storeOfferPdf = ({ pdfBuffer, candidate, letterNumber, req }) => {
  const safeBaseName = sanitizeFileToken(`${candidate.fullName}-${letterNumber}`.toLowerCase(), "offer-letter");
  const fileName = `${safeBaseName}.pdf`;
  const filePath = path.join(LETTERS_FOLDER, fileName);
  fs.writeFileSync(filePath, pdfBuffer);
  return {
    fileName,
    filePath,
    pdfUrl: `${req.protocol}://${req.get("host")}/uploads/letters/${encodeURIComponent(fileName)}`,
  };
};

const ensureOfferTemplate = async (userId) => {
  const existingTemplate = await LetterTemplate.findOne({ type: "offer" }).sort({ version: -1 });
  if (existingTemplate) return existingTemplate;

  return LetterTemplate.create({
    name: OFFER_TEMPLATE_NAME,
    type: "offer",
    category: "recruitment",
    title: OFFER_TEMPLATE_NAME,
    content: "<p>Offer letter template</p>",
    headerHtml: "<div></div>",
    footerHtml: "<div></div>",
    variables: OFFER_TEMPLATE_VARIABLES,
    version: 1,
    isActive: true,
    createdBy: userId,
    auditHistory: [{ action: "auto-create", userId, notes: "Auto-created for offer workflow" }],
  });
};

const sendOfferLetterEmail = async ({ to, subject, html, pdfBuffer, fileName }) => {
  return sendEmail({
    to,
    subject,
    html,
    text: "Please find your offer letter attached.",
    attachments: [{ name: fileName, content: pdfBuffer }],
  });
};

const assertStatusTransition = (current, next) => {
  const nextStatus = normalizeStatus(next);
  if (!nextStatus) return;

  if (!CandidateStatuses.includes(nextStatus)) {
    const error = new Error(`Invalid status \"${nextStatus}\".`);
    error.statusCode = 400;
    throw error;
  }
};

const enrichCandidate = (candidate) => {
  if (!candidate) return candidate;
  candidate.userId = candidate.userId || null;
  candidate.status = normalizeStatus(candidate.status || "Applied");
  candidate.stageCompleted = Number(candidate.stageCompleted || 0) || 1;
  candidate.submittedAt = candidate.submittedAt || candidate.stage1?.submittedAt || candidate.createdAt || new Date();
  candidate.stage1 = candidate.stage1 || {};
  candidate.stage1.personalDetails = candidate.stage1.personalDetails || {};
  const accommodation = normalizeAccommodation(candidate.stage1.personalDetails);
  candidate.stage1.personalDetails.presentResidentialAccommodation = accommodation;
  candidate.stage1.personalDetails.domicile = accommodation;
  candidate.activityTimeline = Array.isArray(candidate.activityTimeline) ? candidate.activityTimeline : [];
  candidate.internship = candidate.internship || {};
  candidate.joiningForm = candidate.joiningForm || {};
  return candidate;
};

const findCandidateForUser = async (user) => {
  const userId = user?._id || null;
  if (!userId) return null;
  return Candidate.findOne({ userId });
};

const ensureBaseTimeline = (candidate) => {
  appendTimelineIfMissing(candidate, {
    key: "application_submitted",
    title: "Application Submitted",
    description: "Candidate completed Stage 1 application.",
    at: candidate.submittedAt || candidate.stage1?.submittedAt || candidate.createdAt || new Date(),
  });

  if (candidate.stage2SubmittedAt) {
    appendTimelineIfMissing(candidate, {
      key: "profile_completed",
      title: "Profile Completed",
      description: "Candidate submitted detailed profile and documents.",
      at: candidate.stage2SubmittedAt,
    });
  }

  if (candidate.adminReview?.reviewedAt) {
    appendTimelineIfMissing(candidate, {
      key: "hr_review",
      title: "HR Review",
      description: "HR has reviewed the candidate profile.",
      at: candidate.adminReview.reviewedAt,
    });
  }

  if (candidate.status === "Interview" || candidate.status === "Interview Scheduled") {
    appendTimelineIfMissing(candidate, {
      key: "interview_scheduled",
      title: "Interview",
      description: "Interview has been scheduled.",
      at: candidate.updatedAt || new Date(),
    });
  }

  if (candidate.status === "Selected") {
    appendTimelineIfMissing(candidate, {
      key: "selected",
      title: "Selected",
      description: "Candidate cleared interview and was selected.",
      at: candidate.updatedAt || new Date(),
    });
  }

  if (candidate.status === "Internship") {
    appendTimelineIfMissing(candidate, {
      key: "internship_assigned",
      title: "Internship Assigned",
      description: "Internship period is in progress.",
      at: candidate.internship?.updatedAt || candidate.updatedAt || new Date(),
    });
  }

  if (candidate.status === "Joining Form Requested") {
    appendTimelineIfMissing(candidate, {
      key: "joining_form_requested",
      title: "Joining Form Requested",
      description: "Candidate was asked to complete joining form.",
      at: candidate.joiningForm?.unlockedAt || candidate.updatedAt || new Date(),
    });
  }

  if (candidate.status === "Joining Form Submitted") {
    appendTimelineIfMissing(candidate, {
      key: "joining_form_submitted",
      title: "Joining Form Submitted",
      description: "Candidate submitted joining form.",
      at: candidate.joiningForm?.submittedAt || candidate.updatedAt || new Date(),
    });
  }

  if (candidate.status === "Converted to Employee") {
    appendTimelineIfMissing(candidate, {
      key: "employee_onboarding",
      title: "Employee Onboarding",
      description: "Candidate converted to employee account.",
      at: candidate.updatedAt || new Date(),
    });
  }
};

export const getCandidateWorkflowConfig = async (_req, res) => {
  return res.json({
    success: true,
    message: "Fetched candidate workflow config",
    data: {
      statuses: CandidateStatuses,
      transitions: STATUS_TRANSITIONS,
      legacyStatusMap: LEGACY_STATUS_MAP,
    },
  });
};

export const getCandidates = async (req, res) => {
  const rows = await Candidate.find(
    {},
    [
      "_id",
      "fullName",
      "email",
      "phone",
      "positionApplied",
      "status",
      "submittedAt",
      "createdAt",
      "updatedAt",
      "stage2SubmittedAt",
      "lastUpdatedAt",
      "offerLetter.salary",
      "offerLetter.joiningDate",
      "internship.status",
      "joiningForm.status",
      "joiningForm.isUnlocked",
    ].join(" ")
  )
    .sort({ createdAt: -1 })
    .lean();

  const data = rows.map((row) => enrichCandidate(row));
  return res.json({ success: true, message: "Fetched candidates", data });
};

export const getCandidateById = async (req, res) => {
  const row = await Candidate.findById(req.params.id);
  if (!row) {
    return res.status(404).json({ success: false, message: "Candidate not found" });
  }
  const data = enrichCandidate(row);
  ensureBaseTimeline(data);
  return res.json({ success: true, message: "Fetched candidate", data: serializeCandidateForResponse(req, req.user, data) });
};

export const getMyCandidateApplication = async (req, res) => {
  const row = await findCandidateForUser(req.user);
  const data = row ? enrichCandidate(row) : null;
  if (data) ensureBaseTimeline(data);
  return res.json({ success: true, message: "Fetched my candidate application", data: serializeCandidateForResponse(req, req.user, data) });
};

export const createCandidate = async (req, res) => {
  const {
    fullName,
    email,
    phone = "",
    positionApplied = "",
    personalDetails = {},
    contactDetails = {},
    qualificationDetails = {},
    declarationAccepted = false,
  } = req.body;

  const candidateName = toString(req.user?.name || fullName);
  const candidateEmail = toLowerEmail(req.user?.email || email);
  const candidateUserId = req.user?._id || null;

  if (!candidateName || !candidateEmail) {
    return res.status(400).json({ success: false, message: "Full name and email are required" });
  }

  if (!declarationAccepted) {
    return res.status(400).json({ success: false, message: "Declaration must be accepted" });
  }

  const existing = candidateUserId
    ? await Candidate.findOne({ userId: candidateUserId })
    : await Candidate.findOne({ email: candidateEmail });
  if (existing && Number(existing.stageCompleted || 0) >= 1) {
    return res.status(409).json({ success: false, message: "Your application has already been submitted." });
  }

  if (candidateUserId) {
    const staleEmailRecords = await Candidate.find({
      email: candidateEmail,
      userId: { $ne: candidateUserId },
    });

    for (const staleRecord of staleEmailRecords) {
      // Fresh re-registration must not reconnect to old email-linked candidate data.
      staleRecord.email = buildArchivedCandidateEmail(staleRecord);
      staleRecord.userId = staleRecord.userId || null;
      await staleRecord.save();
    }
  }

  const submittedAt = new Date();
  const payload = {
    fullName: candidateName,
    userId: candidateUserId,
    email: candidateEmail,
    phone: toString(phone),
    positionApplied: toString(positionApplied),
    status: "Applied",
    stageCompleted: 1,
    submittedAt,
    stage1: {
      personalDetails: {
        dateOfBirth: toString(personalDetails.dateOfBirth),
        fatherName: toString(personalDetails.fatherName),
        motherName: toString(personalDetails.motherName),
        maritalStatus: toString(personalDetails.maritalStatus),
        presentResidentialAccommodation: normalizeAccommodation(personalDetails),
        domicile: normalizeAccommodation(personalDetails),
      },
      contactDetails: {
        alternatePhone: toString(contactDetails.alternatePhone),
        currentAddress: toString(contactDetails.currentAddress),
        permanentAddress: toString(contactDetails.permanentAddress),
      },
      qualificationDetails: {
        highestQualification: toString(qualificationDetails.highestQualification),
        qualifications: sanitizeQualifications(qualificationDetails.qualifications),
      },
      declarationAccepted: true,
      submittedAt,
    },
    activityTimeline: [
      {
        key: "application_submitted",
        title: "Application Submitted",
        description: "Candidate completed Stage 1 application.",
        at: submittedAt,
      },
    ],
  };

  let candidate;
  if (existing) {
    Object.assign(existing, payload);
    candidate = await existing.save();
  } else {
    candidate = await Candidate.create(payload);
  }

  await notifyCandidateAndAdmins({
    candidate,
    title: "Application Submitted",
    message: `${candidate.fullName}, your application has been submitted successfully.`,
    type: "candidate",
    notifyAdmins: true,
  });

  await sendCandidateWorkflowEmail({
    to: candidate.email,
    subject: "Application received - Arihant Dream Infra Project Ltd.",
    message: "Your application has been received successfully. We will review your profile and update you soon.",
  });

  return res.status(201).json({
    success: true,
    message: "Application submitted successfully",
    data: serializeCandidateForResponse(req, req.user, candidate),
  });
};

export const submitCandidateStage2 = async (req, res) => {
  try {
    const candidate = await findCandidateForUser(req.user);

    if (!candidate) {
      console.error("[candidate.submitStage2] Candidate application not found", {
        userId: String(req.user?._id || ""),
        email: toLowerEmail(req.user?.email),
      });
      return res.status(404).json({ success: false, message: "Candidate application not found." });
    }

    if (Number(candidate.stageCompleted || 0) < 1) {
      return res.status(403).json({ success: false, message: "Complete Stage 1 before submitting Stage 2." });
    }

    if (candidate.stage2SubmittedAt || Number(candidate.stageCompleted || 0) >= 2) {
      return res.status(409).json({ success: false, message: "Stage 2 has already been submitted." });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "At least one document upload is required." });
    }

    const uploadValidation = await validateUploadedFileAgainstSettings(req.file);
    if (!uploadValidation.valid) {
      removeUploadedFileIfExists(req.file.path);
      return res.status(400).json({ success: false, message: uploadValidation.message });
    }

    const {
      noticePeriod = "",
      experienceDetails = "",
      expectedSalary = 0,
      references = [],
      employmentHistory = [],
      managementAssessment = {},
      candidateRemarks = "",
    } = req.body;

    const parsedReferences = typeof references === "string" ? JSON.parse(references || "[]") : references;
    const parsedEmployment = typeof employmentHistory === "string" ? JSON.parse(employmentHistory || "[]") : employmentHistory;
    const parsedManagement =
      typeof managementAssessment === "string" ? JSON.parse(managementAssessment || "{}") : managementAssessment;

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const resumeUrl = `${baseUrl}/uploads/${encodeURIComponent(path.basename(req.file.path))}`;
    const resumeDocument = mapDocumentFile(req, req.file);

    candidate.resumeUrl = resumeUrl;
    candidate.resumeFileName = req.file.filename;
    candidate.documents = {
      ...(candidate.documents || {}),
      resume: resumeDocument || candidate.documents?.resume || {},
      certificates: candidate.documents?.certificates || {},
    };
    candidate.stage2Details = {
      noticePeriod: toString(noticePeriod),
      experienceDetails: toString(experienceDetails),
      expectedSalary: Number(expectedSalary) || 0,
      references: sanitizeReferences(parsedReferences),
      employmentHistory: sanitizeEmployment(parsedEmployment),
      managementAssessment: {
        communication: toString(parsedManagement.communication),
        technicalSkill: toString(parsedManagement.technicalSkill),
        attitude: toString(parsedManagement.attitude),
        leadership: toString(parsedManagement.leadership),
      },
      candidateRemarks: toString(candidateRemarks),
    };

    candidate.stage2SubmittedAt = new Date();
    candidate.stageCompleted = 2;
    candidate.status = "Profile Completed";

    appendTimelineIfMissing(candidate, {
      key: "profile_completed",
      title: "Profile Completed",
      description: "Candidate submitted detailed profile and documents.",
      at: candidate.stage2SubmittedAt,
    });

    await candidate.save();

    await notifyCandidateAndAdmins({
      candidate,
      title: "Profile Completed",
      message: `${candidate.fullName} has completed profile details for HR review.`,
      type: "candidate",
      notifyAdmins: true,
    });

    await createAuditLogIfEnabled({
      actorId: req.user?._id ?? null,
      actorName: req.user?.name || "",
      actorEmail: req.user?.email || "",
      action: "DOCUMENTS_UPLOADED",
      targetType: "Candidate",
      targetId: String(candidate._id),
      metadata: { stage: "stage2", fileName: req.file.filename },
    });

    return res.json({
      success: true,
      message: "Stage 2 submitted successfully",
      data: serializeCandidateForResponse(req, req.user, candidate),
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to submit Stage 2",
    });
  }
};

export const updateMyCandidateProfile = async (req, res) => {
  const candidate = await findCandidateForUser(req.user);

  if (!candidate) {
    console.error("[candidate.updateMyProfile] Candidate application not found", {
      userId: String(req.user?._id || ""),
      email: toLowerEmail(req.user?.email),
    });
    return res.status(404).json({ success: false, message: "Candidate application not found." });
  }

  const {
    fullName = candidate.fullName,
    phone = candidate.phone,
    positionApplied = candidate.positionApplied,
    stage1 = {},
    stage2Details = {},
  } = req.body;

  candidate.fullName = toString(fullName) || candidate.fullName;
  candidate.phone = toString(phone);
  candidate.positionApplied = toString(positionApplied);

  const nextStage1 = typeof stage1 === "string" ? JSON.parse(stage1 || "{}") : stage1;
  const nextStage2 = typeof stage2Details === "string" ? JSON.parse(stage2Details || "{}") : stage2Details;

  candidate.stage1 = {
    ...(candidate.stage1 || {}),
    personalDetails: {
      ...(candidate.stage1?.personalDetails || {}),
      dateOfBirth: toString(nextStage1?.personalDetails?.dateOfBirth ?? candidate.stage1?.personalDetails?.dateOfBirth),
      fatherName: toString(nextStage1?.personalDetails?.fatherName ?? candidate.stage1?.personalDetails?.fatherName),
      motherName: toString(nextStage1?.personalDetails?.motherName ?? candidate.stage1?.personalDetails?.motherName),
      maritalStatus: toString(nextStage1?.personalDetails?.maritalStatus ?? candidate.stage1?.personalDetails?.maritalStatus),
      presentResidentialAccommodation: normalizeAccommodation({
        presentResidentialAccommodation:
          nextStage1?.personalDetails?.presentResidentialAccommodation ??
          candidate.stage1?.personalDetails?.presentResidentialAccommodation,
        domicile: nextStage1?.personalDetails?.domicile ?? candidate.stage1?.personalDetails?.domicile,
      }),
      domicile: normalizeAccommodation({
        presentResidentialAccommodation:
          nextStage1?.personalDetails?.presentResidentialAccommodation ??
          candidate.stage1?.personalDetails?.presentResidentialAccommodation,
        domicile: nextStage1?.personalDetails?.domicile ?? candidate.stage1?.personalDetails?.domicile,
      }),
    },
    contactDetails: {
      ...(candidate.stage1?.contactDetails || {}),
      alternatePhone: toString(nextStage1?.contactDetails?.alternatePhone ?? candidate.stage1?.contactDetails?.alternatePhone),
      currentAddress: toString(nextStage1?.contactDetails?.currentAddress ?? candidate.stage1?.contactDetails?.currentAddress),
      permanentAddress: toString(nextStage1?.contactDetails?.permanentAddress ?? candidate.stage1?.contactDetails?.permanentAddress),
    },
    qualificationDetails: {
      ...(candidate.stage1?.qualificationDetails || {}),
      highestQualification: toString(
        nextStage1?.qualificationDetails?.highestQualification ?? candidate.stage1?.qualificationDetails?.highestQualification
      ),
      qualifications:
        nextStage1?.qualificationDetails?.qualifications !== undefined
          ? sanitizeQualifications(nextStage1.qualificationDetails.qualifications)
          : candidate.stage1?.qualificationDetails?.qualifications || [],
    },
    declarationAccepted:
      typeof nextStage1?.declarationAccepted === "boolean"
        ? nextStage1.declarationAccepted
        : Boolean(candidate.stage1?.declarationAccepted),
    submittedAt: candidate.stage1?.submittedAt || candidate.submittedAt || new Date(),
  };

  candidate.stage2Details = {
    ...(candidate.stage2Details || {}),
    noticePeriod: toString(nextStage2?.noticePeriod ?? candidate.stage2Details?.noticePeriod),
    experienceDetails: toString(nextStage2?.experienceDetails ?? candidate.stage2Details?.experienceDetails),
    expectedSalary: Number(nextStage2?.expectedSalary ?? candidate.stage2Details?.expectedSalary ?? 0) || 0,
    references:
      nextStage2?.references !== undefined
        ? sanitizeReferences(nextStage2.references)
        : candidate.stage2Details?.references || [],
    employmentHistory:
      nextStage2?.employmentHistory !== undefined
        ? sanitizeEmployment(nextStage2.employmentHistory)
        : candidate.stage2Details?.employmentHistory || [],
    managementAssessment: {
      ...(candidate.stage2Details?.managementAssessment || {}),
      communication: toString(
        nextStage2?.managementAssessment?.communication ?? candidate.stage2Details?.managementAssessment?.communication
      ),
      technicalSkill: toString(
        nextStage2?.managementAssessment?.technicalSkill ?? candidate.stage2Details?.managementAssessment?.technicalSkill
      ),
      attitude: toString(nextStage2?.managementAssessment?.attitude ?? candidate.stage2Details?.managementAssessment?.attitude),
      leadership: toString(
        nextStage2?.managementAssessment?.leadership ?? candidate.stage2Details?.managementAssessment?.leadership
      ),
    },
    candidateRemarks: toString(nextStage2?.candidateRemarks ?? candidate.stage2Details?.candidateRemarks),
  };

  await candidate.save();
  return res.json({ success: true, message: "Candidate profile updated", data: serializeCandidateForResponse(req, req.user, candidate) });
};

export const updateMyCandidateDocuments = async (req, res) => {
  const candidate = await findCandidateForUser(req.user);

  if (!candidate) {
    console.error("[candidate.updateMyDocuments] Candidate application not found", {
      userId: String(req.user?._id || ""),
      email: toLowerEmail(req.user?.email),
    });
    return res.status(404).json({ success: false, message: "Candidate application not found." });
  }

  const uploadedFiles = Array.isArray(req.files) ? req.files : [];
  const resumeFile = uploadedFiles.find((file) => file.fieldname === "resume") || null;
  const certificatesFile = uploadedFiles.find((file) => file.fieldname === "certificates") || null;
  const supportingFiles = uploadedFiles.filter((file) => file.fieldname === "files");

  if (!resumeFile && !certificatesFile && supportingFiles.length === 0) {
    return res.status(400).json({ success: false, message: "Upload at least one document." });
  }

  for (const file of uploadedFiles) {
    const uploadValidation = await validateUploadedFileAgainstSettings(file);
    if (!uploadValidation.valid) {
      uploadedFiles.forEach((item) => removeUploadedFileIfExists(item.path));
      return res.status(400).json({ success: false, message: uploadValidation.message });
    }
  }

  const nextUploadedFiles = [
    ...(Array.isArray(candidate.documents?.uploadedFiles) ? candidate.documents.uploadedFiles : []),
    ...supportingFiles.map((file) => mapDocumentFile(req, file)).filter(Boolean),
  ];

  candidate.documents = {
    ...(candidate.documents || {}),
    resume: mapDocumentFile(req, resumeFile) || candidate.documents?.resume || {},
    certificates: mapDocumentFile(req, certificatesFile) || candidate.documents?.certificates || {},
    uploadedFiles: nextUploadedFiles,
  };

  if (resumeFile) {
    candidate.resumeUrl = candidate.documents.resume?.url || candidate.resumeUrl;
    candidate.resumeFileName = resumeFile.filename || candidate.resumeFileName;
  }

  await candidate.save();
  return res.json({ success: true, message: "Candidate documents updated", data: serializeCandidateForResponse(req, req.user, candidate) });
};

export const uploadCandidateVideo = async (req, res) => {
  const candidate = await findCandidateForUser(req.user);

  if (!candidate) {
    console.error("[candidate.uploadVideo] Candidate application not found", {
      userId: String(req.user?._id || ""),
      email: toLowerEmail(req.user?.email),
    });
    return res.status(404).json({ success: false, message: "Candidate application not found." });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: "Please upload a video file." });
  }

  const allowedVideoMimeTypes = ["video/mp4", "video/webm", "video/quicktime"];
  if (!allowedVideoMimeTypes.includes(req.file.mimetype)) {
    removeUploadedFileIfExists(req.file.path);
    return res.status(400).json({ success: false, message: "Only MP4, WEBM, and MOV videos are allowed." });
  }

  const maxVideoSizeBytes = 50 * 1024 * 1024;
  if (Number(req.file.size || 0) > maxVideoSizeBytes) {
    removeUploadedFileIfExists(req.file.path);
    return res.status(400).json({ success: false, message: "Video size must be 50 MB or less." });
  }

  const source = toString(req.body?.source).toLowerCase() === "recorded" ? "recorded" : "uploaded";
  candidate.videoIntroduction = {
    ...(candidate.videoIntroduction || {}),
    ...mapVideoFile(req, req.file, source),
  };

  appendTimelineIfMissing(candidate, {
    key: "video_introduction_uploaded",
    title: "Video Introduction Added",
    description: "Candidate submitted a video introduction.",
    at: new Date(),
  });

  await candidate.save();

  await createAuditLogIfEnabled({
    actorId: req.user?._id ?? null,
    actorName: req.user?.name || "",
    actorEmail: req.user?.email || "",
    action: "VIDEO_INTRODUCTION_UPLOADED",
    targetType: "Candidate",
    targetId: String(candidate._id),
    metadata: {
      fileName: req.file.filename,
      source,
      mimeType: req.file.mimetype,
      size: req.file.size,
    },
  });

  return res.json({
    success: true,
    message: "Video introduction uploaded successfully.",
    data: serializeCandidateForResponse(req, req.user, candidate),
  });
};

export const reviewCandidateByAdmin = async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);
  if (!candidate) {
    return res.status(404).json({ success: false, message: "Candidate not found" });
  }

  const {
    evaluationRemarks = "",
    adminNotes = "",
    rating = null,
    status = candidate.status,
    interviewSchedule = {},
    videoFeedback = "",
    videoRating = null,
  } = req.body;

  const normalizedStatus = normalizeStatus(status);
  assertStatusTransition(candidate.status, normalizedStatus);

  candidate.adminReview = {
    evaluationRemarks: toString(evaluationRemarks),
    adminNotes: toString(adminNotes),
    rating: rating === null || rating === undefined || rating === "" ? null : Number(rating),
    reviewedAt: new Date(),
    reviewedBy: req.user?._id ?? null,
  };

  if (candidate.videoIntroduction?.url) {
    const hasVideoReviewInput =
      toString(videoFeedback).length > 0 || ![null, undefined, ""].includes(videoRating);
    candidate.videoIntroduction = {
      ...(candidate.videoIntroduction || {}),
      adminFeedback: toString(videoFeedback),
      adminRating: videoRating === null || videoRating === undefined || videoRating === "" ? null : Number(videoRating),
      reviewedAt: hasVideoReviewInput ? new Date() : candidate.videoIntroduction?.reviewedAt || null,
      reviewedBy: hasVideoReviewInput ? req.user?._id ?? null : candidate.videoIntroduction?.reviewedBy || null,
    };
  }

  candidate.status = normalizedStatus;
  candidate.stageCompleted = Math.max(Number(candidate.stageCompleted || 0), 3);

  appendTimelineIfMissing(candidate, {
    key: "hr_review",
    title: "HR Review",
    description: "HR evaluation has been completed.",
    at: new Date(),
  });

  if (normalizedStatus === "Interview" || normalizedStatus === "Interview Scheduled") {
    candidate.interviewSchedule = {
      ...(candidate.interviewSchedule || {}),
      date: toString(interviewSchedule.date ?? candidate.interviewSchedule?.date),
      time: toString(interviewSchedule.time ?? candidate.interviewSchedule?.time),
      meetingLink: toString(interviewSchedule.meetingLink ?? candidate.interviewSchedule?.meetingLink),
      mode: toString(interviewSchedule.mode ?? candidate.interviewSchedule?.mode),
      notes: toString(interviewSchedule.notes ?? candidate.interviewSchedule?.notes),
    };
    appendTimelineIfMissing(candidate, {
      key: "interview_scheduled",
      title: "Interview",
      description: "Interview has been scheduled.",
      at: new Date(),
    });
  }

  if (normalizedStatus === "Selected") {
    appendTimelineIfMissing(candidate, {
      key: "selected",
      title: "Selected",
      description: "Candidate has been selected.",
      at: new Date(),
    });
  }

  await candidate.save();

  await notifyCandidateAndAdmins({
    candidate,
    title: "Interview Result",
    message: `${candidate.fullName} status updated to ${candidate.status}.`,
    type: "candidate",
  });

  if (normalizedStatus === "Selected") {
    await sendCandidateWorkflowEmail({
      to: candidate.email,
      subject: "Candidate selected - Arihant Dream Infra Project Ltd.",
      message: "Congratulations. You have been selected. HR will share your next onboarding step shortly.",
    });
  }

  await createAuditLogIfEnabled({
    actorId: req.user?._id ?? null,
    actorName: req.user?.name || "",
    actorEmail: req.user?.email || "",
    action: "CANDIDATE_STATUS_UPDATED",
    targetType: "Candidate",
    targetId: String(candidate._id),
    metadata: { status: candidate.status, via: "review" },
  });
  return res.json({ success: true, message: "Candidate review updated", data: serializeCandidateForResponse(req, req.user, candidate) });
};

export const updateCandidateStatus = async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, message: "Status is required" });
  }

  const candidate = await Candidate.findById(req.params.id);
  if (!candidate) {
    return res.status(404).json({ success: false, message: "Candidate not found" });
  }

  const normalizedStatus = normalizeStatus(status);
  assertStatusTransition(candidate.status, normalizedStatus);
  candidate.status = normalizedStatus;

  if (normalizedStatus === "Interview" || normalizedStatus === "Interview Scheduled") {
    candidate.stageCompleted = Math.max(Number(candidate.stageCompleted || 0), 4);
    appendTimelineIfMissing(candidate, {
      key: "interview_scheduled",
      title: "Interview",
      description: "Interview has been scheduled.",
      at: new Date(),
    });

    await sendCandidateWorkflowEmail({
      to: candidate.email,
      subject: "Interview scheduled - Arihant Dream Infra Project Ltd.",
      message: "Your interview has been scheduled. Please log in to your candidate dashboard for updates.",
    });
  }

  if (normalizedStatus === "Selected") {
    candidate.stageCompleted = Math.max(Number(candidate.stageCompleted || 0), 4);
    appendTimelineIfMissing(candidate, {
      key: "selected",
      title: "Selected",
      description: "Candidate has been selected.",
      at: new Date(),
    });

    await sendCandidateWorkflowEmail({
      to: candidate.email,
      subject: "Selection update - Arihant Dream Infra Project Ltd.",
      message: "Congratulations. You have been selected. The next onboarding step will be shared shortly.",
    });
  }

  await candidate.save();

  await notifyCandidateAndAdmins({
    candidate,
    title: "Candidate Status Updated",
    message: `${candidate.fullName} moved to ${candidate.status}.`,
    type: "candidate",
  });

  await createAuditLogIfEnabled({
    actorId: req.user?._id ?? null,
    actorName: req.user?.name || "",
    actorEmail: req.user?.email || "",
    action: "CANDIDATE_STATUS_UPDATED",
    targetType: "Candidate",
    targetId: String(candidate._id),
    metadata: { status: candidate.status, via: "direct_update" },
  });

  return res.json({ success: true, message: "Candidate status updated", data: serializeCandidateForResponse(req, req.user, candidate) });
};

export const assignInternshipToCandidate = async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);
  if (!candidate) {
    return res.status(404).json({ success: false, message: "Candidate not found" });
  }

  if (!["Selected", "Internship", "Offered"].includes(candidate.status)) {
    return res.status(400).json({ success: false, message: "Internship can only be assigned to selected/offered candidates." });
  }

  const { startDate, endDate, notes = "" } = req.body;
  if (!startDate || !endDate) {
    return res.status(400).json({ success: false, message: "Internship startDate and endDate are required." });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return res.status(400).json({ success: false, message: "Invalid internship dates." });
  }

  const internship = await Internship.create({
    candidateId: candidate._id,
    startDate: start,
    endDate: end,
    status: "Assigned",
    notes: toString(notes),
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
    description: `Internship assigned from ${start.toDateString()} to ${end.toDateString()}.`,
    at: new Date(),
  });
  await candidate.save();

  await notifyCandidateAndAdmins({
    candidate,
    title: "Internship Assigned",
    message: `${candidate.fullName} internship period is now in progress.`,
    type: "candidate",
  });

  await sendCandidateWorkflowEmail({
    to: candidate.email,
    subject: "Internship assigned - Arihant Dream Infra Project Ltd.",
    message: `Your internship has been assigned from ${start.toDateString()} to ${end.toDateString()}.`,
  });

  return res.status(201).json({
    success: true,
    message: "Internship assigned successfully",
    data: { candidate: serializeCandidateForResponse(req, req.user, candidate), internship },
  });
};

export const sendOfferLetterToCandidate = async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);
  if (!candidate) {
    return res.status(404).json({ success: false, message: "Candidate not found" });
  }

  if (!["Selected", "Internship"].includes(candidate.status)) {
    return res.status(400).json({ success: false, message: "Offer letter can be sent only to selected or internship candidates." });
  }

  const { salary, role, joiningDate } = req.body || {};
  const normalizedRole = toString(role || candidate.positionApplied);
  const normalizedSalary = Number(salary ?? candidate.stage2Details?.expectedSalary ?? 0);
  const joiningDateValue = joiningDate ? new Date(joiningDate) : null;

  if (!normalizedRole) {
    return res.status(400).json({ success: false, message: "Offer role is required." });
  }
  if (!Number.isFinite(normalizedSalary) || normalizedSalary <= 0) {
    return res.status(400).json({ success: false, message: "A valid offer salary is required." });
  }
  if (!joiningDateValue || Number.isNaN(joiningDateValue.getTime())) {
    return res.status(400).json({ success: false, message: "A valid joining date is required." });
  }
  if (!candidate.email) {
    return res.status(400).json({ success: false, message: "Candidate email is missing." });
  }
  if (!env.brevo.apiKey || !env.brevo.senderEmail) {
    return res.status(500).json({
      success: false,
      message: "Email transport is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL before sending offers.",
    });
  }

  const letterNumber = await generateOfferLetterNumber();
  const template = await ensureOfferTemplate(req.user?._id ?? null);
  const htmlContent = generateOfferLetterHtml({
    candidateName: candidate.fullName,
    position: normalizedRole,
    joiningDate: joiningDateValue.toLocaleDateString("en-GB"),
    salary: formatCurrency(normalizedSalary),
    date: new Date().toLocaleDateString("en-GB"),
    address: candidate.stage1?.contactDetails?.currentAddress || candidate.stage1?.contactDetails?.permanentAddress || "",
  });

  let pdfFile = null;
  try {
    const pdfBuffer = await generateOfferPdfBuffer(htmlContent);
    pdfFile = storeOfferPdf({ pdfBuffer, candidate, letterNumber, req });

    const generatedLetter = await GeneratedLetter.create({
      letterNumber,
      type: "offer",
      category: "recruitment",
      employeeId: null,
      candidateId: candidate._id,
      templateId: template._id,
      generatedContent: htmlContent,
      status: "Generated",
      pdfUrl: pdfFile.pdfUrl,
      issuedDate: new Date(),
      createdBy: req.user?._id ?? null,
      version: template.version || 1,
      approvalStatus: "Approved",
      auditHistory: [{ action: "generate", userId: req.user?._id ?? null, notes: "Offer letter generated" }],
    });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>Dear ${candidate.fullName},</p>
        <p>We are pleased to share your offer letter for the role of <strong>${normalizedRole}</strong>.</p>
        <p>Please find the signed PDF attached with your compensation and joining details.</p>
        <p>Joining date: <strong>${joiningDateValue.toLocaleDateString("en-GB")}</strong></p>
        <p>Salary: <strong>${formatCurrency(normalizedSalary)}</strong></p>
        <p>Regards,<br/>HR Team</p>
      </div>
    `;

    let emailResult;
    try {
      emailResult = await maybeSendEmailBySettings(() =>
        sendOfferLetterEmail({
          to: candidate.email,
          subject: `Offer Letter - ${normalizedRole}`,
          html: emailHtml,
          pdfBuffer,
          fileName: pdfFile.fileName,
        })
      );
    } catch (error) {
      console.error("[candidate.sendOffer] Email provider failed", {
        candidateId: String(candidate._id),
        email: candidate.email,
        message: error instanceof Error ? error.message : "Unknown email error",
      });
      fs.existsSync(pdfFile.filePath) && fs.unlinkSync(pdfFile.filePath);
      await GeneratedLetter.findByIdAndDelete(generatedLetter._id);
      return res.status(502).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to send offer letter email.",
      });
    }

    if (emailResult?.skipped) {
      fs.existsSync(pdfFile.filePath) && fs.unlinkSync(pdfFile.filePath);
      await GeneratedLetter.findByIdAndDelete(generatedLetter._id);
      return res.status(409).json({ success: false, message: emailResult.message });
    }

    if (!emailResult?.success) {
      fs.existsSync(pdfFile.filePath) && fs.unlinkSync(pdfFile.filePath);
      await GeneratedLetter.findByIdAndDelete(generatedLetter._id);
      return res.status(502).json({
        success: false,
        message: emailResult?.error || "Failed to send offer letter email.",
      });
    }

    generatedLetter.status = "Sent";
    generatedLetter.sentAt = new Date();
    generatedLetter.auditHistory.push({
      action: "send",
      userId: req.user?._id ?? null,
      notes: `Offer letter emailed to ${candidate.email}`,
    });
    await generatedLetter.save();

    candidate.status = "Offered";
    candidate.stageCompleted = Math.max(Number(candidate.stageCompleted || 0), 4);
    candidate.positionApplied = normalizedRole;
    candidate.offerLetter = {
      generatedLetterId: generatedLetter._id,
      pdfUrl: pdfFile.pdfUrl,
      role: normalizedRole,
      salary: normalizedSalary,
      joiningDate: joiningDateValue,
      sentAt: new Date(),
      emailSentAt: new Date(),
      sentBy: req.user?._id ?? null,
    };
    appendTimelineIfMissing(candidate, {
      key: "offer_sent",
      title: "Offer Letter Sent",
      description: `Offer letter issued for ${normalizedRole}.`,
      at: new Date(),
    });
    await candidate.save();

    await notifyCandidateAndAdmins({
      candidate,
      title: "Offer Letter Issued",
      message: `Offer letter has been issued to ${candidate.fullName}.`,
      type: "candidate",
    });

    await createAuditLogIfEnabled({
      actorId: req.user?._id ?? null,
      actorName: req.user?.name || "",
      actorEmail: req.user?.email || "",
      action: "OFFER_LETTER_SENT",
      targetType: "Candidate",
      targetId: String(candidate._id),
      metadata: {
        generatedLetterId: String(generatedLetter._id),
        role: normalizedRole,
        salary: normalizedSalary,
        joiningDate: joiningDateValue.toISOString(),
      },
    });

    return res.json({
      success: true,
      message: "Offer letter generated and emailed successfully.",
      data: serializeCandidateForResponse(req, req.user, candidate),
    });
  } catch (error) {
    if (pdfFile?.filePath && fs.existsSync(pdfFile.filePath)) {
      fs.unlinkSync(pdfFile.filePath);
    }
    console.error("[candidate.sendOffer] Offer generation failed", {
      candidateId: String(candidate._id),
      message: error instanceof Error ? error.message : "Unknown offer generation error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate offer letter.",
    });
  }
};

export const sendJoiningFormToCandidate = async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);
  if (!candidate) {
    return res.status(404).json({ success: false, message: "Candidate not found" });
  }

  if (!["Selected", "Internship", "Offered"].includes(candidate.status)) {
    return res.status(400).json({ success: false, message: "Joining form can be sent only to selected/internship/offered candidates." });
  }

  await JoiningForm.findOneAndUpdate(
    { candidateId: candidate._id },
    {
      $set: {
        status: "Requested",
        requestedAt: new Date(),
        userId: candidate.userId ?? null,
      },
      $setOnInsert: {
        candidateId: candidate._id,
      },
    },
    { upsert: true, new: true }
  );

  candidate.joiningForm = {
    ...candidate.joiningForm,
    isUnlocked: true,
    status: "Requested",
    unlockedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
  };
  candidate.status = "Joining Form Requested";
  candidate.stageCompleted = Math.max(Number(candidate.stageCompleted || 0), 6);
  appendTimelineIfMissing(candidate, {
    key: "joining_form_requested",
    title: "Joining Form Requested",
    description: "Candidate can now complete joining form.",
    at: new Date(),
  });
  await candidate.save();

  await notifyCandidateAndAdmins({
    candidate,
    title: "Joining Form Request",
    message: `Joining form has been unlocked for ${candidate.fullName}.`,
    type: "candidate",
  });

  await sendCandidateWorkflowEmail({
    to: candidate.email,
    subject: "Congratulations! Next Step - Complete Your Joining Form",
    message:
      "You have successfully cleared the interview process. Please log in to your portal and complete your joining form to proceed with onboarding.",
  });

  return res.json({ success: true, message: "Joining form sent successfully", data: serializeCandidateForResponse(req, req.user, candidate) });
};

export const convertCandidateToEmployee = async (req, res) => {
  const { departmentId = "", designation = "", salary = null, joiningDate = null } = req.body;

  const result = await convertCandidateToEmployeeRecord({
    candidateId: req.params.id,
    actor: req.user,
    departmentId,
    designation,
    salary,
    joiningDate,
    enforceJoiningFormApproved: true,
  });

  return res.status(result.alreadyExists ? 200 : 201).json({
    success: true,
    message: result.alreadyExists ? "Candidate already converted to employee." : "Candidate moved to employee successfully.",
    data: {
      employee: result.employee,
      candidate: serializeCandidateForResponse(req, req.user, result.candidate),
    },
  });
};

export const deleteCandidate = async (req, res) => {
  const deleted = await Candidate.findByIdAndDelete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: "Candidate not found" });
  }

  return res.json({ success: true, message: "Candidate deleted", data: deleted });
};

export const acceptOffer = async (req, res) => {
  const candidate = await Candidate.findById(req.params.candidateId);
  if (!candidate) {
    return res.status(404).json({ success: false, message: "Candidate not found" });
  }

  if (!["Offered", "Accepted", "Joining Form Submitted", "Employee Onboarding"].includes(candidate.status)) {
    return res.status(400).json({
      success: false,
      message: "Only offered/onboarding candidates can be moved to employee.",
    });
  }

  const result = await convertCandidateToEmployeeRecord({
    candidateId: req.params.candidateId,
    actor: req.user,
    enforceJoiningFormApproved: true,
  });

  return res.status(result.alreadyExists ? 200 : 201).json({
    success: true,
    message: result.alreadyExists ? "Employee already exists for this candidate." : "Candidate moved to employee successfully.",
    data: {
      employee: result.employee,
      candidate: serializeCandidateForResponse(req, req.user, result.candidate),
    },
  });
};
