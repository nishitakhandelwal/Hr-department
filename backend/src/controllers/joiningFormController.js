import path from "path";
import { Candidate } from "../models/Candidate.js";
import { Employee } from "../models/Employee.js";
import { JoiningForm } from "../models/JoiningForm.js";
import { User } from "../models/User.js";
import {
  appendTimelineIfMissing,
  convertCandidateToEmployeeRecord,
  notifyCandidateAndAdmins,
  sendCandidateWorkflowEmail,
} from "../services/recruitmentWorkflowService.js";
import { removeUploadedFileIfExists, validateUploadedFileAgainstSettings } from "../services/runtimeBehaviorService.js";
import { secureUploadUrls } from "../utils/uploadAccess.js";

const toString = (value) => String(value ?? "").trim();
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

const mapFilesToDocument = ({ req, existing = {} }) => {
  const files = req.files || {};
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  const toPayload = (fieldName) => {
    const file = Array.isArray(files[fieldName]) ? files[fieldName][0] : null;
    if (!file) return existing[fieldName] || {};
    return {
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: `${baseUrl}/uploads/${encodeURIComponent(path.basename(file.path))}`,
      uploadedAt: new Date(),
    };
  };

  return {
    resume: toPayload("resume"),
    photograph: toPayload("photograph"),
    certificates: toPayload("certificates"),
    idProof: toPayload("idProof"),
  };
};

const sanitizeEducation = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      degreeOrDiploma: toString(row?.degreeOrDiploma),
      university: toString(row?.university),
      yearOfPassing: toString(row?.yearOfPassing),
      percentage: toString(row?.percentage),
    }))
    .filter((row) => row.degreeOrDiploma || row.university || row.yearOfPassing || row.percentage);

const buildJoiningFormPrefillData = ({ form = null, candidate = null, user = null }) => {
  const candidateDob = toString(candidate?.stage1?.personalDetails?.dateOfBirth);
  const resolvedDateOfBirth = toString(form?.personalInformation?.dateOfBirth || candidateDob);
  const calculateAge = (value) => {
    if (!value) return "";
    const dob = new Date(value);
    if (Number.isNaN(dob.getTime())) return "";
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }
    return age > 0 ? String(age) : "";
  };

  return {
    fullName: toString(form?.personalInformation?.fullName || candidate?.fullName || user?.name),
    emailAddress: toString(form?.personalInformation?.emailAddress || candidate?.email || user?.email),
    phoneNumber: toString(form?.personalInformation?.phoneNumber || candidate?.phone || user?.phoneNumber),
    mobileNumber: toString(form?.personalInformation?.mobileNumber || candidate?.stage1?.contactDetails?.alternatePhone),
    dateOfBirth: resolvedDateOfBirth,
    age: toString(form?.personalInformation?.age || calculateAge(resolvedDateOfBirth)),
    maritalStatus: toString(form?.personalInformation?.maritalStatus || candidate?.stage1?.personalDetails?.maritalStatus),
    placeOfBirth: toString(form?.personalInformation?.placeOfBirth),
    fatherName: toString(form?.familyDetails?.fatherName || candidate?.stage1?.personalDetails?.fatherName),
    fatherOccupation: toString(form?.familyDetails?.fatherOccupation),
    motherName: toString(form?.familyDetails?.motherName || candidate?.stage1?.personalDetails?.motherName),
    motherOccupation: toString(form?.familyDetails?.motherOccupation),
    presentAddress: toString(form?.addressDetails?.presentAddress || candidate?.stage1?.contactDetails?.currentAddress),
    permanentAddress: toString(form?.addressDetails?.permanentAddress || candidate?.stage1?.contactDetails?.permanentAddress),
    accommodationDetails: toString(
      form?.accommodationDetails ||
        candidate?.stage1?.personalDetails?.presentResidentialAccommodation ||
        candidate?.stage1?.personalDetails?.domicile
    ),
    educationDetails: sanitizeEducation(
      form?.educationDetails?.length
        ? form.educationDetails
        : (candidate?.stage1?.qualificationDetails?.qualifications || []).map((row) => ({
            degreeOrDiploma: row?.degree,
            university: row?.institute,
            yearOfPassing: row?.year,
            percentage: row?.percentage,
          }))
    ),
  };
};

const buildJoiningFormPayload = ({ req, existing = null, fullNameFallback = "", emailFallback = "" }) => {
  const educationDetails =
    typeof req.body.educationDetails === "string"
      ? JSON.parse(req.body.educationDetails || "[]")
      : req.body.educationDetails || [];

  return {
    personalInformation: {
      fullName: toString(req.body.fullName || fullNameFallback),
      dateOfBirth: toString(req.body.dateOfBirth),
      age: toString(req.body.age),
      maritalStatus: toString(req.body.maritalStatus),
      placeOfBirth: toString(req.body.placeOfBirth),
      phoneNumber: toString(req.body.phoneNumber),
      mobileNumber: toString(req.body.mobileNumber),
      emailAddress: toString(req.body.emailAddress || emailFallback),
    },
    familyDetails: {
      fatherName: toString(req.body.fatherName),
      fatherOccupation: toString(req.body.fatherOccupation),
      motherName: toString(req.body.motherName),
      motherOccupation: toString(req.body.motherOccupation),
    },
    addressDetails: {
      presentAddress: toString(req.body.presentAddress),
      permanentAddress: toString(req.body.permanentAddress),
    },
    accommodationDetails: toString(req.body.accommodationDetails),
    educationDetails: sanitizeEducation(educationDetails),
    documents: mapFilesToDocument({ req, existing: existing?.documents || {} }),
    declarationAccepted: true,
    submittedAt: new Date(),
  };
};

const serializeJoiningFormForResponse = (req, user, value) => secureUploadUrls(value, req, user);

const resolveJoiningFormIdentityKey = (form) => {
  const candidateId =
    typeof form?.candidateId === "object" && form?.candidateId?._id
      ? String(form.candidateId._id)
      : form?.candidateId
        ? String(form.candidateId)
        : "";
  const userId =
    typeof form?.userId === "object" && form?.userId?._id
      ? String(form.userId._id)
      : form?.userId
        ? String(form.userId)
        : "";

  return candidateId ? `candidate:${candidateId}` : userId ? `user:${userId}` : `form:${String(form?._id || "")}`;
};

const dedupeJoiningForms = (forms = []) => {
  const latestByIdentity = new Map();

  for (const form of forms) {
    const key = resolveJoiningFormIdentityKey(form);
    const existing = latestByIdentity.get(key);
    const currentTime = new Date(form?.updatedAt || form?.createdAt || 0).getTime();
    const existingTime = existing ? new Date(existing?.updatedAt || existing?.createdAt || 0).getTime() : -1;
    if (!existing || currentTime >= existingTime) {
      latestByIdentity.set(key, form);
    }
  }

  return Array.from(latestByIdentity.values()).sort(
    (left, right) => new Date(right?.updatedAt || right?.createdAt || 0).getTime() - new Date(left?.updatedAt || left?.createdAt || 0).getTime()
  );
};

const syncDuplicateJoiningForms = async ({ formId, userId = null, candidateId = null, patch = {} }) => {
  const orFilters = [
    userId ? { userId } : null,
    candidateId ? { candidateId } : null,
  ].filter(Boolean);

  if (!orFilters.length) return;

  await JoiningForm.updateMany(
    {
      _id: { $ne: formId },
      $or: orFilters,
    },
    { $set: patch }
  );
};

const getCandidateForRequest = async (req) => {
  if (req.user?.role === "candidate") {
    return Candidate.findOne({ userId: req.user?._id });
  }
  return Candidate.findById(req.params.candidateId || req.body?.candidateId);
};

const validateUploadedFiles = async (filesObj = {}) => {
  const allFiles = Object.values(filesObj).flat();
  for (const file of allFiles) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      removeUploadedFileIfExists(file.path);
      return { valid: false, message: "Invalid file type. Allowed: PDF, DOC, DOCX, JPG, PNG." };
    }
    const validation = await validateUploadedFileAgainstSettings(file);
    if (!validation.valid) {
      removeUploadedFileIfExists(file.path);
      return validation;
    }
  }
  return { valid: true };
};

export const listJoiningForms = async (req, res) => {
  if (req.user?.role === "candidate") {
    const candidate = await Candidate.findOne({ userId: req.user?._id });
    if (!candidate) {
      return res.json({ success: true, message: "Fetched joining forms", data: [] });
    }
    const data = await JoiningForm.find({ candidateId: candidate._id }).sort({ createdAt: -1 });
    return res.json({ success: true, message: "Fetched joining forms", data: serializeJoiningFormForResponse(req, req.user, data) });
  }

  if (req.user?.role === "employee") {
    const data = await JoiningForm.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, message: "Fetched joining forms", data: serializeJoiningFormForResponse(req, req.user, data) });
  }

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.candidateId) filter.candidateId = req.query.candidateId;

  const data = await JoiningForm.find(filter)
    .populate("candidateId", "fullName email status positionApplied")
    .populate("userId", "name email status joiningFormCompleted")
    .populate("reviewedBy", "name email")
    .sort({ createdAt: -1 });

  return res.json({
    success: true,
    message: "Fetched joining forms",
    data: serializeJoiningFormForResponse(req, req.user, dedupeJoiningForms(data)),
  });
};

export const getMyJoiningForm = async (req, res) => {
  if (req.user?.role === "employee") {
    const user = await User.findById(req.user._id).select("name email phoneNumber role status joiningFormCompleted");
    const employee = await Employee.findOne({ userId: req.user._id }).select(
      "candidateId fullName email phone address educationDetails"
    );
    let candidate = null;

    if (employee?.candidateId) {
      candidate = await Candidate.findById(employee.candidateId);
    }

    if (!candidate && employee?._id) {
      candidate = await Candidate.findOne({ convertedEmployeeId: employee._id });
    }

    const data =
      (await JoiningForm.findOne({ userId: req.user._id })) ||
      (candidate ? await JoiningForm.findOne({ candidateId: candidate._id }) : null);

    return res.json({
      success: true,
      message: "Fetched joining form",
      data: {
        form: serializeJoiningFormForResponse(req, req.user, data),
        prefillData: buildJoiningFormPrefillData({ form: data, candidate, user }),
      },
    });
  }

  const candidate = await Candidate.findOne({ userId: req.user?._id });
  if (!candidate) {
    return res.status(404).json({ success: false, message: "Candidate profile not found." });
  }

  const data = await JoiningForm.findOne({ candidateId: candidate._id });
  const user = await User.findById(req.user?._id).select("name email phoneNumber role");
  return res.json({
    success: true,
    message: "Fetched joining form",
    data: {
      form: serializeJoiningFormForResponse(req, req.user, data),
      prefillData: buildJoiningFormPrefillData({ form: data, candidate, user }),
    },
  });
};

export const sendJoiningForm = async (req, res) => {
  const candidate = await getCandidateForRequest(req);
  if (!candidate) {
    return res.status(404).json({ success: false, message: "Candidate not found" });
  }

  if (!["Selected", "Internship", "Offered"].includes(candidate.status)) {
    return res.status(400).json({ success: false, message: "Only selected/internship/offered candidates can receive joining form." });
  }

  const form = await JoiningForm.findOneAndUpdate(
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
    title: "Joining Form",
    description: "Complete Joining Form unlocked.",
    at: new Date(),
  });
  await candidate.save();

  await notifyCandidateAndAdmins({
    candidate,
    title: "Joining Form Request",
    message: "Please complete your joining form in candidate portal.",
    type: "candidate",
  });

  await sendCandidateWorkflowEmail({
    to: candidate.email,
    subject: "Congratulations! Next Step - Complete Your Joining Form",
    message:
      "You have successfully cleared the interview process. Please log in to your portal and complete your joining form to proceed with onboarding.",
  });

  return res.json({ success: true, message: "Joining form request sent", data: serializeJoiningFormForResponse(req, req.user, form) });
};

export const submitMyJoiningForm = async (req, res) => {
  if (req.user?.role === "employee") {
    const user = await User.findById(req.user?._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const filesValidation = await validateUploadedFiles(req.files || {});
    if (!filesValidation.valid) {
      return res.status(400).json({ success: false, message: filesValidation.message });
    }

    const declarationAccepted = String(req.body.declarationAccepted || "false") === "true";
    if (!declarationAccepted) {
      return res.status(400).json({ success: false, message: "Declaration must be accepted before submission." });
    }

    const employee = await Employee.findOne({ userId: user._id }).select("candidateId");
    const linkedCandidateId = employee?.candidateId || null;
    const existing =
      (await JoiningForm.findOne({ userId: user._id })) ||
      (linkedCandidateId ? await JoiningForm.findOne({ candidateId: linkedCandidateId }) : null);
    const payload = buildJoiningFormPayload({
      req,
      existing,
      fullNameFallback: user.name,
      emailFallback: user.email,
    });

    const selector = existing?._id ? { _id: existing._id } : { userId: user._id };
    const update = {
      $set: {
        userId: user._id,
        status: "Submitted",
        ...payload,
      },
      $setOnInsert: {
        requestedAt: new Date(),
      },
    };

    if (linkedCandidateId) {
      update.$set.candidateId = linkedCandidateId;
    }

    const data = await JoiningForm.findOneAndUpdate(selector, update, {
      upsert: true,
      new: true,
      runValidators: true,
    });

    user.joiningFormCompleted = false;
    user.status = "pending_form";
    await user.save();

    return res.json({ success: true, message: "Joining form submitted successfully", data: serializeJoiningFormForResponse(req, req.user, data) });
  }

  const candidate = await Candidate.findOne({ userId: req.user?._id });
  if (!candidate) {
    return res.status(404).json({ success: false, message: "Candidate profile not found." });
  }

  if (!candidate.joiningForm?.isUnlocked) {
    return res.status(403).json({ success: false, message: "Joining form is not available yet." });
  }

  const filesValidation = await validateUploadedFiles(req.files || {});
  if (!filesValidation.valid) {
    return res.status(400).json({ success: false, message: filesValidation.message });
  }

  const declarationAccepted = String(req.body.declarationAccepted || "false") === "true";
  if (!declarationAccepted) {
    return res.status(400).json({ success: false, message: "Declaration must be accepted before submission." });
  }

  const existing = await JoiningForm.findOne({ candidateId: candidate._id });
  const payload = buildJoiningFormPayload({
    req,
    existing,
    fullNameFallback: candidate.fullName,
    emailFallback: candidate.email,
  });

  const data = await JoiningForm.findOneAndUpdate(
    { candidateId: candidate._id },
    {
      $set: {
        userId: req.user?._id ?? null,
        status: "Submitted",
        ...payload,
      },
      $setOnInsert: {
        candidateId: candidate._id,
        requestedAt: new Date(),
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  candidate.joiningForm = {
    ...candidate.joiningForm,
    isUnlocked: true,
    status: "Submitted",
    submittedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
  };
  candidate.status = "Joining Form Submitted";
  candidate.stageCompleted = Math.max(Number(candidate.stageCompleted || 0), 7);
  appendTimelineIfMissing(candidate, {
    key: "joining_form_submitted",
    title: "Joining Form Submitted",
    description: "Candidate submitted joining form for review.",
    at: new Date(),
  });
  await candidate.save();

  await notifyCandidateAndAdmins({
    candidate,
    title: "Joining Form Submitted",
    message: `${candidate.fullName} submitted joining form. Pending admin review.`,
    type: "candidate",
    notifyAdmins: true,
  });

  return res.json({ success: true, message: "Joining form submitted successfully", data: serializeJoiningFormForResponse(req, req.user, data) });
};

export const reviewJoiningForm = async (req, res) => {
  const { action, remarks = "", departmentId = "", designation = "", salary = null, joiningDate = null } = req.body;
  if (!action || !["approve", "request_correction", "reject"].includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid action. Use approve/request_correction/reject." });
  }

  const data = await JoiningForm.findById(req.params.id);
  if (!data) {
    return res.status(404).json({ success: false, message: "Joining form not found" });
  }

  const candidate = data.candidateId ? await Candidate.findById(data.candidateId) : null;
  const reviewedAt = new Date();

  if (!candidate && data.userId) {
    const user = await User.findById(data.userId);
    const employee = await Employee.findOne({ userId: data.userId });

    if (!user) {
      return res.status(404).json({ success: false, message: "Linked user not found" });
    }

    data.adminRemarks = toString(remarks);
    data.reviewedAt = reviewedAt;
    data.reviewedBy = req.user?._id ?? null;

    if (action === "request_correction") {
      data.status = "Correction Requested";
      await data.save();

      user.joiningFormCompleted = false;
      user.status = "pending_form";
      await user.save();

      if (employee) {
        employee.joiningFormCompleted = false;
        employee.status = "pending_form";
        await employee.save();
      }

      await syncDuplicateJoiningForms({
        formId: data._id,
        userId: data.userId,
        candidateId: data.candidateId,
        patch: {
          status: "Correction Requested",
          adminRemarks: toString(remarks),
          reviewedAt,
          reviewedBy: req.user?._id ?? null,
        },
      });

      return res.json({
        success: true,
        message: "Correction requested",
        data: { joiningForm: serializeJoiningFormForResponse(req, req.user, data), employee, user },
      });
    }

    if (action === "reject") {
      data.status = "Rejected";
      await data.save();

      user.joiningFormCompleted = false;
      user.status = "pending_form";
      await user.save();

      if (employee) {
        employee.joiningFormCompleted = false;
        employee.status = "pending_form";
        await employee.save();
      }

      await syncDuplicateJoiningForms({
        formId: data._id,
        userId: data.userId,
        candidateId: data.candidateId,
        patch: {
          status: "Rejected",
          adminRemarks: toString(remarks),
          reviewedAt,
          reviewedBy: req.user?._id ?? null,
        },
      });

      return res.json({
        success: true,
        message: "Joining form rejected",
        data: { joiningForm: serializeJoiningFormForResponse(req, req.user, data), employee, user },
      });
    }

    data.status = "Approved";
    await data.save();

    user.joiningFormCompleted = true;
    user.status = "active_employee";
    await user.save();

    if (employee) {
      employee.joiningFormCompleted = true;
      employee.status = "active_employee";
      await employee.save();
    }

    await syncDuplicateJoiningForms({
      formId: data._id,
      userId: data.userId,
      candidateId: data.candidateId,
      patch: {
        status: "Approved",
        adminRemarks: toString(remarks),
        reviewedAt,
        reviewedBy: req.user?._id ?? null,
      },
    });

    return res.json({
      success: true,
      message: "Joining form approved.",
      data: { joiningForm: serializeJoiningFormForResponse(req, req.user, data), employee, user },
    });
  }

  if (!candidate) {
    return res.status(404).json({ success: false, message: "Candidate not found" });
  }

  if (action === "request_correction") {
    data.status = "Correction Requested";
    data.adminRemarks = toString(remarks);
    data.reviewedAt = reviewedAt;
    data.reviewedBy = req.user?._id ?? null;
    await data.save();

    candidate.status = "Joining Form Correction Requested";
    candidate.joiningForm = {
      ...candidate.joiningForm,
      isUnlocked: true,
      status: "Correction Requested",
      reviewedAt,
      reviewedBy: req.user?._id ?? null,
    };
    appendTimelineIfMissing(candidate, {
      key: "joining_form_correction_requested",
      title: "Joining Form Correction Requested",
      description: toString(remarks) || "Please correct and resubmit your joining form.",
      at: reviewedAt,
    });
    await candidate.save();

    await notifyCandidateAndAdmins({
      candidate,
      title: "Joining Form Correction",
      message: "Admin requested correction in your joining form.",
      type: "candidate",
    });

    await syncDuplicateJoiningForms({
      formId: data._id,
      userId: data.userId,
      candidateId: data.candidateId,
      patch: {
        status: "Correction Requested",
        adminRemarks: toString(remarks),
        reviewedAt,
        reviewedBy: req.user?._id ?? null,
      },
    });

    return res.json({ success: true, message: "Correction requested", data: serializeJoiningFormForResponse(req, req.user, data) });
  }

  if (action === "reject") {
    data.status = "Rejected";
    data.adminRemarks = toString(remarks);
    data.reviewedAt = reviewedAt;
    data.reviewedBy = req.user?._id ?? null;
    await data.save();

    candidate.status = "Joining Form Rejected";
    candidate.joiningForm = {
      ...candidate.joiningForm,
      isUnlocked: false,
      status: "Rejected",
      reviewedAt,
      reviewedBy: req.user?._id ?? null,
    };
    appendTimelineIfMissing(candidate, {
      key: "joining_form_rejected",
      title: "Joining Form Rejected",
      description: toString(remarks) || "Joining form was rejected by admin.",
      at: reviewedAt,
    });
    await candidate.save();

    await notifyCandidateAndAdmins({
      candidate,
      title: "Joining Form Rejected",
      message: "Your joining form was rejected. Contact HR for details.",
      type: "candidate",
    });

    await syncDuplicateJoiningForms({
      formId: data._id,
      userId: data.userId,
      candidateId: data.candidateId,
      patch: {
        status: "Rejected",
        adminRemarks: toString(remarks),
        reviewedAt,
        reviewedBy: req.user?._id ?? null,
      },
    });

    return res.json({ success: true, message: "Joining form rejected", data: serializeJoiningFormForResponse(req, req.user, data) });
  }

  data.status = "Approved";
  data.adminRemarks = toString(remarks);
  data.reviewedAt = reviewedAt;
  data.reviewedBy = req.user?._id ?? null;
  await data.save();

  await sendCandidateWorkflowEmail({
    to: candidate.email,
    subject: "Joining form approved - Arihant Dream Infra Project Ltd.",
    message: "Your joining form is approved. We are onboarding your employee profile now.",
  });

  const converted = await convertCandidateToEmployeeRecord({
    candidateId: candidate._id,
    actor: req.user,
    departmentId,
    designation,
    salary,
    joiningDate,
    enforceJoiningFormApproved: true,
  });

  await syncDuplicateJoiningForms({
    formId: data._id,
    userId: data.userId,
    candidateId: data.candidateId,
    patch: {
      status: "Approved",
      adminRemarks: toString(remarks),
      reviewedAt,
      reviewedBy: req.user?._id ?? null,
    },
  });

  return res.json({
    success: true,
    message: "Joining form approved and candidate converted to employee.",
    data: {
      joiningForm: serializeJoiningFormForResponse(req, req.user, data),
      employee: converted.employee,
      candidate: secureUploadUrls(converted.candidate, req, req.user),
    },
  });
};

export const getJoiningFormById = async (req, res) => {
  const data = await JoiningForm.findById(req.params.id)
    .populate("candidateId", "fullName email status")
    .populate("reviewedBy", "name email");
  if (!data) {
    return res.status(404).json({ success: false, message: "Joining form not found" });
  }
  return res.json({ success: true, message: "Fetched joining form", data: serializeJoiningFormForResponse(req, req.user, data) });
};

export const deleteJoiningForm = async (req, res) => {
  const data = await JoiningForm.findByIdAndDelete(req.params.id);
  if (!data) {
    return res.status(404).json({ success: false, message: "Joining form not found" });
  }
  return res.json({ success: true, message: "Joining form deleted", data: serializeJoiningFormForResponse(req, req.user, data) });
};
