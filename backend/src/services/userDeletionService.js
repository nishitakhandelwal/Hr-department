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

export const deleteUserCompletely = async (userId) => {
  const session = await mongoose.startSession();
  const fileUrls = new Set();
  let deletedUser = null;
  let deletionSummary = null;

  try {
    await session.withTransaction(async () => {
      const user = await User.findById(userId).select("-password").session(session);
      if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }

      deletedUser = user.toObject();
      const normalizedEmail = toLowerEmail(user.email);

      pushUrl(fileUrls, user.profilePhotoUrl);
      pushUrl(fileUrls, user.profileImage);

      const candidateSelectors = buildOrQuery([
        { userId: user._id },
        normalizedEmail ? { email: normalizedEmail } : null,
      ]);
      const candidates = candidateSelectors.length ? await Candidate.find({ $or: candidateSelectors }).session(session) : [];
      const candidateIds = candidates.map((candidate) => candidate._id);
      for (const candidate of candidates) collectCandidateFiles(candidate, fileUrls);

      const employeeSelectors = buildOrQuery([
        { userId: user._id },
        candidateIds.length ? { candidateId: { $in: candidateIds } } : null,
        normalizedEmail ? { email: normalizedEmail } : null,
      ]);
      const employees = employeeSelectors.length ? await Employee.find({ $or: employeeSelectors }).session(session) : [];
      const employeeIds = employees.map((employee) => employee._id);
      for (const employee of employees) collectEmployeeFiles(employee, fileUrls);

      const joiningFormSelectors = buildOrQuery([
        { userId: user._id },
        candidateIds.length ? { candidateId: { $in: candidateIds } } : null,
      ]);
      const joiningForms = joiningFormSelectors.length ? await JoiningForm.find({ $or: joiningFormSelectors }).session(session) : [];
      for (const form of joiningForms) collectJoiningFormFiles(form, fileUrls);

      const generatedLetterSelectors = buildOrQuery([
        candidateIds.length ? { candidateId: { $in: candidateIds } } : null,
        employeeIds.length ? { employeeId: { $in: employeeIds } } : null,
      ]);
      const generatedLetters = generatedLetterSelectors.length
        ? await GeneratedLetter.find({ $or: generatedLetterSelectors }).session(session)
        : [];
      for (const letter of generatedLetters) collectGeneratedLetterFiles(letter, fileUrls);

      const [
        notificationsResult,
        userActivitiesResult,
        auditLogsResult,
        eventsResult,
        correctionRequestsResult,
        attendanceResult,
        leaveResult,
        payrollResult,
        generatedLettersResult,
        internshipsResult,
        joiningFormsResult,
        employeesResult,
        candidatesResult,
        adminResult,
        userResult,
      ] = await Promise.all([
        Notification.deleteMany({ userId: user._id }, { session }),
        UserActivity.deleteMany({ userId: user._id }, { session }),
        AuditLog.deleteMany(
          {
            $or: [{ actorId: user._id }, { targetType: "User", targetId: String(user._id) }],
          },
          { session }
        ),
        Event.deleteMany({ $or: [{ userId: user._id }, { createdBy: user._id }] }, { session }),
        AttendanceCorrectionRequest.deleteMany(
          {
            $or: [
              { userId: user._id },
              ...(employeeIds.length ? [{ employeeId: { $in: employeeIds } }] : []),
            ],
          },
          { session }
        ),
        employeeIds.length ? Attendance.deleteMany({ employeeId: { $in: employeeIds } }, { session }) : Promise.resolve({ deletedCount: 0 }),
        employeeIds.length ? Leave.deleteMany({ employeeId: { $in: employeeIds } }, { session }) : Promise.resolve({ deletedCount: 0 }),
        employeeIds.length ? Payroll.deleteMany({ employeeId: { $in: employeeIds } }, { session }) : Promise.resolve({ deletedCount: 0 }),
        generatedLetterSelectors.length
          ? GeneratedLetter.deleteMany({ $or: generatedLetterSelectors }, { session })
          : Promise.resolve({ deletedCount: 0 }),
        candidateIds.length ? Internship.deleteMany({ candidateId: { $in: candidateIds } }, { session }) : Promise.resolve({ deletedCount: 0 }),
        joiningFormSelectors.length
          ? JoiningForm.deleteMany({ $or: joiningFormSelectors }, { session })
          : Promise.resolve({ deletedCount: 0 }),
        employeeSelectors.length ? Employee.deleteMany({ $or: employeeSelectors }, { session }) : Promise.resolve({ deletedCount: 0 }),
        candidateSelectors.length ? Candidate.deleteMany({ $or: candidateSelectors }, { session }) : Promise.resolve({ deletedCount: 0 }),
        normalizedEmail ? Admin.deleteOne({ email: normalizedEmail }, { session }) : Promise.resolve({ deletedCount: 0 }),
        User.deleteOne({ _id: user._id }, { session }),
      ]);

      deletionSummary = {
        notifications: notificationsResult.deletedCount || 0,
        userActivities: userActivitiesResult.deletedCount || 0,
        auditLogs: auditLogsResult.deletedCount || 0,
        events: eventsResult.deletedCount || 0,
        attendanceCorrectionRequests: correctionRequestsResult.deletedCount || 0,
        attendance: attendanceResult.deletedCount || 0,
        leaves: leaveResult.deletedCount || 0,
        payrolls: payrollResult.deletedCount || 0,
        generatedLetters: generatedLettersResult.deletedCount || 0,
        internships: internshipsResult.deletedCount || 0,
        joiningForms: joiningFormsResult.deletedCount || 0,
        employees: employeesResult.deletedCount || 0,
        candidates: candidatesResult.deletedCount || 0,
        adminProfiles: adminResult.deletedCount || 0,
        users: userResult.deletedCount || 0,
      };
    });
  } finally {
    await session.endSession();
  }

  const storageCleanup = await Promise.allSettled([...fileUrls].map((fileUrl) => deleteFileByPublicUrl(fileUrl)));
  const storageFailures = storageCleanup.filter((result) => result.status === "rejected").length;

  return {
    user: deletedUser,
    summary: {
      ...(deletionSummary || {}),
      filesDeletedAttempted: fileUrls.size,
      fileDeleteFailures: storageFailures,
    },
  };
};
