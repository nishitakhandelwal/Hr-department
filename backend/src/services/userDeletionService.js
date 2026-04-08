import mongoose from "mongoose";
import { Admin } from "../models/Admin.js";
import { Attendance } from "../models/Attendance.js";
import { AttendanceCorrectionRequest } from "../models/AttendanceCorrectionRequest.js";
import { AuditLog } from "../models/AuditLog.js";
import { Candidate } from "../models/Candidate.js";
import { Employee } from "../models/Employee.js";
import { Event } from "../models/Event.js";
import { GeneratedLetter } from "../models/GeneratedLetter.js";
import { Internship } from "../models/Internship.js";
import { JoiningForm } from "../models/JoiningForm.js";
import { Leave } from "../models/Leave.js";
import { LetterTemplate } from "../models/LetterTemplate.js";
import { Notification } from "../models/Notification.js";
import { Payroll } from "../models/Payroll.js";
import { User } from "../models/User.js";
import { UserActivity } from "../models/UserActivity.js";
import { deleteFileByPublicUrl } from "../utils/fileStorage.js";

const toLowerEmail = (value) => String(value ?? "").trim().toLowerCase();

const pushUrl = (set, value) => {
  const normalized = String(value ?? "").trim();
  if (normalized) set.add(normalized);
};

const collectCandidateFiles = (candidate, urls) => {
  if (!candidate) return;
  pushUrl(urls, candidate.profileImage);
  pushUrl(urls, candidate.resumeUrl);
  pushUrl(urls, candidate.documents?.resume?.url);
  pushUrl(urls, candidate.documents?.certificates?.url);
  for (const item of candidate.documents?.uploadedFiles || []) {
    pushUrl(urls, item?.url);
  }
  pushUrl(urls, candidate.videoIntroduction?.url);
  pushUrl(urls, candidate.offerLetter?.pdfUrl);
};

const collectEmployeeFiles = (employee, urls) => {
  if (!employee) return;
  pushUrl(urls, employee.profileImage);
  pushUrl(urls, employee.documents?.resume?.url);
  pushUrl(urls, employee.documents?.photograph?.url);
  pushUrl(urls, employee.documents?.certificates?.url);
  pushUrl(urls, employee.documents?.idProof?.url);
};

const collectJoiningFormFiles = (form, urls) => {
  if (!form) return;
  pushUrl(urls, form.documents?.resume?.url);
  pushUrl(urls, form.documents?.photograph?.url);
  pushUrl(urls, form.documents?.certificates?.url);
  pushUrl(urls, form.documents?.idProof?.url);
};

const collectGeneratedLetterFiles = (letter, urls) => {
  if (!letter) return;
  pushUrl(urls, letter.pdfUrl);
};

const buildOrQuery = (items = []) => items.filter(Boolean);

const applySession = (query, session) => (session ? query.session(session) : query);
const buildSessionOptions = (session, options = {}) => (session ? { ...options, session } : options);

const isTransactionUnsupportedError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("transaction numbers are only allowed on a replica set member or mongos") ||
    message.includes("replica set") ||
    message.includes("transaction") && message.includes("not supported")
  );
};

const performUserDeletion = async (userId, session = null) => {
  const fileUrls = new Set();

  const user = await applySession(User.findById(userId).select("-password"), session);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const deletedUser = user.toObject();
  const normalizedEmail = toLowerEmail(user.email);

  pushUrl(fileUrls, user.profilePhotoUrl);
  pushUrl(fileUrls, user.profileImage);

  const candidateSelectors = buildOrQuery([
    { userId: user._id },
    normalizedEmail ? { email: normalizedEmail } : null,
  ]);
  const candidates = candidateSelectors.length ? await applySession(Candidate.find({ $or: candidateSelectors }), session) : [];
  const candidateIds = candidates.map((candidate) => candidate._id);
  for (const candidate of candidates) collectCandidateFiles(candidate, fileUrls);

  const employeeSelectors = buildOrQuery([
    { userId: user._id },
    candidateIds.length ? { candidateId: { $in: candidateIds } } : null,
    normalizedEmail ? { email: normalizedEmail } : null,
  ]);
  const employees = employeeSelectors.length ? await applySession(Employee.find({ $or: employeeSelectors }), session) : [];
  const employeeIds = employees.map((employee) => employee._id);
  for (const employee of employees) collectEmployeeFiles(employee, fileUrls);

  const joiningFormSelectors = buildOrQuery([
    { userId: user._id },
    candidateIds.length ? { candidateId: { $in: candidateIds } } : null,
  ]);
  const joiningForms = joiningFormSelectors.length ? await applySession(JoiningForm.find({ $or: joiningFormSelectors }), session) : [];
  for (const form of joiningForms) collectJoiningFormFiles(form, fileUrls);

  const generatedLetterSelectors = buildOrQuery([
    { createdBy: user._id },
    candidateIds.length ? { candidateId: { $in: candidateIds } } : null,
    employeeIds.length ? { employeeId: { $in: employeeIds } } : null,
  ]);
  const generatedLetters = generatedLetterSelectors.length
    ? await applySession(GeneratedLetter.find({ $or: generatedLetterSelectors }), session)
    : [];
  for (const letter of generatedLetters) collectGeneratedLetterFiles(letter, fileUrls);

  const [
    notificationsResult,
    userActivitiesResult,
    auditLogsResult,
    eventsResult,
    correctionRequestsResult,
    reviewedCorrectionRequestsResult,
    attendanceResult,
    leaveResult,
    payrollResult,
    candidateReviewRefsResult,
    candidateJoiningRefsResult,
    candidateVideoRefsResult,
    candidateOfferRefsResult,
    internshipAssignedRefsResult,
    internshipReviewedRefsResult,
    internshipHistoryRefsResult,
    joiningFormReviewedRefsResult,
    generatedLettersResult,
    letterTemplatesResult,
    internshipsResult,
    joiningFormsResult,
    employeesResult,
    candidatesResult,
    adminResult,
    userResult,
  ] = await Promise.all([
    Notification.deleteMany({ userId: user._id }, buildSessionOptions(session)),
    UserActivity.deleteMany({ userId: user._id }, buildSessionOptions(session)),
    AuditLog.deleteMany(
      {
        $or: [{ actorId: user._id }, { targetType: "User", targetId: String(user._id) }],
      },
      buildSessionOptions(session)
    ),
    Event.deleteMany({ $or: [{ userId: user._id }, { createdBy: user._id }] }, buildSessionOptions(session)),
    AttendanceCorrectionRequest.deleteMany(
      {
        $or: [
          { userId: user._id },
          ...(employeeIds.length ? [{ employeeId: { $in: employeeIds } }] : []),
        ],
      },
      buildSessionOptions(session)
    ),
    AttendanceCorrectionRequest.updateMany(
      { reviewedBy: user._id },
      { $set: { reviewedBy: null } },
      buildSessionOptions(session)
    ),
    employeeIds.length
      ? Attendance.deleteMany({ employeeId: { $in: employeeIds } }, buildSessionOptions(session))
      : Promise.resolve({ deletedCount: 0 }),
    employeeIds.length
      ? Leave.deleteMany({ employeeId: { $in: employeeIds } }, buildSessionOptions(session))
      : Promise.resolve({ deletedCount: 0 }),
    employeeIds.length
      ? Payroll.deleteMany({ employeeId: { $in: employeeIds } }, buildSessionOptions(session))
      : Promise.resolve({ deletedCount: 0 }),
    Candidate.updateMany({ "adminReview.reviewedBy": user._id }, { $set: { "adminReview.reviewedBy": null } }, buildSessionOptions(session)),
    Candidate.updateMany({ "joiningForm.reviewedBy": user._id }, { $set: { "joiningForm.reviewedBy": null } }, buildSessionOptions(session)),
    Candidate.updateMany({ "videoIntroduction.reviewedBy": user._id }, { $set: { "videoIntroduction.reviewedBy": null } }, buildSessionOptions(session)),
    Candidate.updateMany({ "offerLetter.sentBy": user._id }, { $set: { "offerLetter.sentBy": null } }, buildSessionOptions(session)),
    Internship.updateMany({ assignedBy: user._id }, { $set: { assignedBy: null } }, buildSessionOptions(session)),
    Internship.updateMany({ reviewedBy: user._id }, { $set: { reviewedBy: null } }, buildSessionOptions(session)),
    Internship.updateMany(
      { "history.by": user._id },
      { $set: { "history.$[entry].by": null } },
      buildSessionOptions(session, { arrayFilters: [{ "entry.by": user._id }] })
    ),
    JoiningForm.updateMany({ reviewedBy: user._id }, { $set: { reviewedBy: null } }, buildSessionOptions(session)),
    generatedLetterSelectors.length
      ? GeneratedLetter.deleteMany({ $or: generatedLetterSelectors }, buildSessionOptions(session))
      : Promise.resolve({ deletedCount: 0 }),
    LetterTemplate.deleteMany({ createdBy: user._id }, buildSessionOptions(session)),
    candidateIds.length ? Internship.deleteMany({ candidateId: { $in: candidateIds } }, buildSessionOptions(session)) : Promise.resolve({ deletedCount: 0 }),
    joiningFormSelectors.length
      ? JoiningForm.deleteMany({ $or: joiningFormSelectors }, buildSessionOptions(session))
      : Promise.resolve({ deletedCount: 0 }),
    employeeSelectors.length ? Employee.deleteMany({ $or: employeeSelectors }, buildSessionOptions(session)) : Promise.resolve({ deletedCount: 0 }),
    candidateSelectors.length ? Candidate.deleteMany({ $or: candidateSelectors }, buildSessionOptions(session)) : Promise.resolve({ deletedCount: 0 }),
    normalizedEmail ? Admin.deleteOne({ email: normalizedEmail }, buildSessionOptions(session)) : Promise.resolve({ deletedCount: 0 }),
    User.deleteOne({ _id: user._id }, buildSessionOptions(session)),
  ]);

  return {
    user: deletedUser,
    summary: {
      notifications: notificationsResult.deletedCount || 0,
      userActivities: userActivitiesResult.deletedCount || 0,
      auditLogs: auditLogsResult.deletedCount || 0,
      events: eventsResult.deletedCount || 0,
      attendanceCorrectionRequests: correctionRequestsResult.deletedCount || 0,
      attendanceCorrectionReviewRefsCleared: reviewedCorrectionRequestsResult.modifiedCount || 0,
      attendance: attendanceResult.deletedCount || 0,
      leaves: leaveResult.deletedCount || 0,
      payrolls: payrollResult.deletedCount || 0,
      candidateReviewRefsCleared: candidateReviewRefsResult.modifiedCount || 0,
      candidateJoiningRefsCleared: candidateJoiningRefsResult.modifiedCount || 0,
      candidateVideoRefsCleared: candidateVideoRefsResult.modifiedCount || 0,
      candidateOfferRefsCleared: candidateOfferRefsResult.modifiedCount || 0,
      internshipAssignedRefsCleared: internshipAssignedRefsResult.modifiedCount || 0,
      internshipReviewedRefsCleared: internshipReviewedRefsResult.modifiedCount || 0,
      internshipHistoryRefsCleared: internshipHistoryRefsResult.modifiedCount || 0,
      joiningFormReviewRefsCleared: joiningFormReviewedRefsResult.modifiedCount || 0,
      generatedLetters: generatedLettersResult.deletedCount || 0,
      letterTemplates: letterTemplatesResult.deletedCount || 0,
      internships: internshipsResult.deletedCount || 0,
      joiningForms: joiningFormsResult.deletedCount || 0,
      employees: employeesResult.deletedCount || 0,
      candidates: candidatesResult.deletedCount || 0,
      adminProfiles: adminResult.deletedCount || 0,
      users: userResult.deletedCount || 0,
    },
    fileUrls,
  };
};

export const deleteUser = async (userId) => {
  console.log("Deleting user:", userId);
  const session = await mongoose.startSession();
  let result = null;

  try {
    try {
      await session.withTransaction(async () => {
        result = await performUserDeletion(userId, session);
      });
    } catch (error) {
      if (!isTransactionUnsupportedError(error)) {
        throw error;
      }

      console.warn("[userDeletionService] Mongo transactions unsupported, retrying delete without transaction.");
      result = await performUserDeletion(userId, null);
    }
  } finally {
    await session.endSession();
  }

  const storageCleanup = await Promise.allSettled([...(result?.fileUrls || [])].map((fileUrl) => deleteFileByPublicUrl(fileUrl)));
  const storageFailures = storageCleanup.filter((result) => result.status === "rejected").length;

  return {
    user: result?.user || null,
    summary: {
      ...(result?.summary || {}),
      filesDeletedAttempted: result?.fileUrls?.size || 0,
      fileDeleteFailures: storageFailures,
    },
  };
};

export const deleteUserCompletely = deleteUser;
