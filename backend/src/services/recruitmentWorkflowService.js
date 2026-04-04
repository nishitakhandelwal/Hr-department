import bcrypt from "bcryptjs";
import crypto from "crypto";
import mongoose from "mongoose";
import { Candidate } from "../models/Candidate.js";
import { Department } from "../models/Department.js";
import { Employee } from "../models/Employee.js";
import { JoiningForm } from "../models/JoiningForm.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { sendEmail } from "./emailService.js";
import { maybeSendEmailBySettings } from "./runtimeBehaviorService.js";

const toString = (value) => String(value ?? "").trim();
const toLowerEmail = (value) => String(value ?? "").toLowerCase().trim();
const toUserId = (value) => (value ? String(value) : "");

export const appendTimelineIfMissing = (candidate, event) => {
  candidate.activityTimeline = Array.isArray(candidate.activityTimeline) ? candidate.activityTimeline : [];
  const exists = candidate.activityTimeline.some((item) => item.key === event.key);
  if (!exists) {
    candidate.activityTimeline.push({
      key: event.key,
      title: event.title,
      description: event.description,
      at: event.at || new Date(),
    });
  }
};

const generateEmployeeId = async (session = null) => {
  const year = new Date().getFullYear();
  const total = await Employee.countDocuments({}, session ? { session } : undefined);

  for (let i = 0; i < 8; i += 1) {
    const code = `EMP-${year}-${String(total + i + 1).padStart(4, "0")}`;
    const existsQuery = Employee.exists({ employeeId: code });
    if (session) existsQuery.session(session);
    const exists = await existsQuery;
    if (!exists) return code;
  }

  return `EMP-${year}-${Date.now()}`;
};

const resolveDepartment = async ({ departmentId, candidate, session = null }) => {
  if (departmentId) {
    const byId = await Department.findById(departmentId).session(session || null);
    if (byId) return byId;
  }

  const position = toString(candidate?.positionApplied);
  if (!position) return null;

  const byName = await Department.findOne({ name: position }).session(session || null);
  if (byName) return byName;

  return null;
};

const mapEmployeeSnapshot = ({ candidate, joiningForm, mappedDepartment, designation, salary, joiningDate }) => {
  const personal = joiningForm?.personalInformation || {};
  const address = joiningForm?.addressDetails || {};
  const educationDetails = Array.isArray(joiningForm?.educationDetails) ? joiningForm.educationDetails : [];
  const documents = joiningForm?.documents || {};
  const joinedOn = joiningDate ? new Date(joiningDate) : new Date();

  const baseQualification = Array.isArray(candidate?.stage1?.qualificationDetails?.qualifications)
    ? candidate.stage1.qualificationDetails.qualifications.map((item) => ({
        degreeOrDiploma: toString(item?.degree),
        university: toString(item?.institute),
        yearOfPassing: toString(item?.year),
        percentage: toString(item?.percentage),
      }))
    : [];

  return {
    fullName: toString(personal.fullName) || toString(candidate?.fullName),
    email: toLowerEmail(personal.emailAddress || candidate?.email),
    phone: toString(personal.mobileNumber || personal.phoneNumber || candidate?.phone),
    department: toString(mappedDepartment?.name || candidate?.positionApplied || ""),
    designation: toString(designation) || toString(candidate?.positionApplied) || "Employee",
    salary:
      salary === null || salary === undefined
        ? Number(candidate?.stage2Details?.expectedSalary || 0)
        : Number(salary || 0),
    joiningDate: joinedOn,
    status: "active",
    documents: {
      resume: documents?.resume || {},
      photograph: documents?.photograph || {},
      certificates: documents?.certificates || {},
      idProof: documents?.idProof || {},
    },
    address: {
      presentAddress: toString(address.presentAddress || candidate?.stage1?.contactDetails?.currentAddress),
      permanentAddress: toString(address.permanentAddress || candidate?.stage1?.contactDetails?.permanentAddress),
    },
    educationDetails: educationDetails.length ? educationDetails : baseQualification,
  };
};

export const createNotificationForUser = async ({ userId, title, message, type = "general" }) => {
  if (!userId) return null;
  return Notification.create({ userId, title, message, type, read: false });
};

export const createNotificationsForUsers = async ({ userIds, title, message, type = "general" }) => {
  const uniqueUserIds = [...new Set((userIds || []).map(toUserId).filter(Boolean))];
  if (!uniqueUserIds.length) return [];
  return Notification.insertMany(
    uniqueUserIds.map((userId) => ({
      userId,
      title,
      message,
      type,
      read: false,
    }))
  );
};

export const getCandidateNotificationUserId = async (candidate) => {
  if (!candidate?.email) return "";
  const candidateUser = await User.findOne({ email: toLowerEmail(candidate.email), role: "candidate" }).select("_id").lean();
  return toUserId(candidateUser?._id);
};

export const createNotificationForCandidate = async ({ candidate, candidateUserId = "", title, message, type = "candidate" }) => {
  const userId = candidateUserId || (await getCandidateNotificationUserId(candidate));
  return createNotificationForUser({ userId, title, message, type });
};

export const createAdminNotifications = async ({ title, message, type = "general" }) => {
  const admins = await User.find({ role: "admin", isActive: true }).select("_id").lean();
  return createNotificationsForUsers({
    userIds: admins.map((admin) => admin._id),
    title,
    message,
    type,
  });
};

export const notifyCandidateAndAdmins = async ({ candidate, title, message, type = "candidate", notifyAdmins = false }) => {
  const candidateUserId = await getCandidateNotificationUserId(candidate);
  await createNotificationForCandidate({ candidate, candidateUserId, title, message, type });
  if (notifyAdmins) {
    await createAdminNotifications({ title, message, type });
  }
};

export const sendCandidateWorkflowEmail = async ({ to, subject, message }) => {
  if (!to) {
    console.warn("[workflowEmail] Skipped email: missing recipient", { subject });
    return { success: false, skipped: true, message: "Missing candidate email." };
  }
  const result = await maybeSendEmailBySettings(() =>
    sendEmail({
      to,
      subject,
      html: `<p>${message}</p>`,
      text: message,
    })
  );
  if (!result?.success) {
    console.error("[workflowEmail] Email sending failed", {
      to,
      subject,
      error: result?.error || result?.message || "Unknown error",
      code: result?.code || "",
    });
  }
  return result;
};

export const convertCandidateToEmployeeRecord = async ({
  candidateId,
  actor = null,
  departmentId = "",
  designation = "",
  salary = null,
  joiningDate = null,
  enforceJoiningFormApproved = false,
}) => {
  const convertWithSession = async (session = null) => {
    const candidateQuery = Candidate.findById(candidateId);
    if (session) candidateQuery.session(session);
    const candidate = await candidateQuery;
    if (!candidate) {
      const error = new Error("Candidate not found");
      error.statusCode = 404;
      throw error;
    }

    const joiningFormQuery = JoiningForm.findOne({ candidateId: candidate._id }).sort({ updatedAt: -1 });
    if (session) joiningFormQuery.session(session);
    const joiningForm = await joiningFormQuery;

    if (enforceJoiningFormApproved) {
      const isApproved =
        String(candidate.joiningForm?.status || "").toLowerCase() === "approved" ||
        String(joiningForm?.status || "").toLowerCase() === "approved";
      if (!isApproved) {
        const error = new Error("Joining form must be approved before conversion.");
        error.statusCode = 400;
        throw error;
      }
    }

    if (candidate.convertedEmployeeId) {
      const existingByCandidateId = Employee.findById(candidate.convertedEmployeeId);
      if (session) existingByCandidateId.session(session);
      const existingEmployee = await existingByCandidateId;
      if (existingEmployee) {
        return { candidate, employee: existingEmployee, alreadyExists: true };
      }
    }

    const existingByCandidateQuery = Employee.findOne({ candidateId: candidate._id });
    if (session) existingByCandidateQuery.session(session);
    const existingByCandidate = await existingByCandidateQuery;
    if (existingByCandidate) {
      candidate.convertedEmployeeId = existingByCandidate._id;
      candidate.status = "Converted to Employee";
      candidate.stageCompleted = Math.max(Number(candidate.stageCompleted || 0), 8);
      if (enforceJoiningFormApproved) {
        candidate.joiningForm = {
          ...candidate.joiningForm,
          isUnlocked: false,
          status: "Approved",
          reviewedAt: joiningForm?.reviewedAt || new Date(),
          reviewedBy: joiningForm?.reviewedBy || actor?._id || null,
        };
      }
      appendTimelineIfMissing(candidate, {
        key: "employee_onboarding",
        title: "Employee Onboarding",
        description: "Candidate was converted to employee.",
        at: new Date(),
      });
      await (session ? candidate.save({ session }) : candidate.save());
      return { candidate, employee: existingByCandidate, alreadyExists: true };
    }

    const candidateEmail = toLowerEmail(candidate.email);
    const userQuery = User.findOne({ email: candidateEmail });
    if (session) userQuery.session(session);
    let user = await userQuery;

    if (user && user.role === "admin") {
      const error = new Error("An admin account already exists with this candidate email.");
      error.statusCode = 409;
      throw error;
    }

    if (!user) {
      const tempPassword = crypto.randomBytes(12).toString("hex");
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const createdUsers = await User.create(
        [
          {
            name: toString(candidate.fullName) || "Employee",
            email: candidateEmail,
            password: hashedPassword,
            role: "employee",
            accessRole: "employee",
            department: toString(candidate.positionApplied),
            isActive: true,
            accountStatus: "active",
            joiningFormCompleted: true,
            status: "active_employee",
          },
        ],
        session ? { session } : undefined
      );
      user = createdUsers[0];
    } else if (user.role !== "employee") {
      user.role = "employee";
      user.accessRole = "employee";
      user.name = toString(candidate.fullName) || user.name;
      user.department = toString(candidate.positionApplied) || user.department;
      user.isActive = true;
      user.accountStatus = "active";
      user.joiningFormCompleted = true;
      user.status = "active_employee";
      await (session ? user.save({ session }) : user.save());
    }

    const existingByUserQuery = Employee.findOne({ userId: user._id });
    if (session) existingByUserQuery.session(session);
    const existingEmployeeByUser = await existingByUserQuery;
    if (existingEmployeeByUser) {
      candidate.convertedEmployeeId = existingEmployeeByUser._id;
      candidate.status = "Converted to Employee";
      candidate.stageCompleted = Math.max(Number(candidate.stageCompleted || 0), 8);
      if (enforceJoiningFormApproved) {
        candidate.joiningForm = {
          ...candidate.joiningForm,
          isUnlocked: false,
          status: "Approved",
          reviewedAt: joiningForm?.reviewedAt || new Date(),
          reviewedBy: joiningForm?.reviewedBy || actor?._id || null,
        };
      }
      appendTimelineIfMissing(candidate, {
        key: "employee_onboarding",
        title: "Employee Onboarding",
        description: "Candidate was converted to employee.",
        at: new Date(),
      });
      await (session ? candidate.save({ session }) : candidate.save());
      return { candidate, employee: existingEmployeeByUser, alreadyExists: true };
    }

    const mappedDepartment = await resolveDepartment({ departmentId, candidate, session });
    const employeeSnapshot = mapEmployeeSnapshot({
      candidate,
      joiningForm,
      mappedDepartment,
      designation,
      salary,
      joiningDate,
    });

    const createdEmployees = await Employee.create(
      [
        {
          userId: user._id,
          candidateId: candidate._id,
          employeeId: await generateEmployeeId(session),
          fullName: employeeSnapshot.fullName,
          email: employeeSnapshot.email,
          phone: employeeSnapshot.phone,
          department: employeeSnapshot.department,
          designation: employeeSnapshot.designation,
          salary: employeeSnapshot.salary,
          joiningDate: employeeSnapshot.joiningDate,
          departmentId: mappedDepartment?._id || null,
          departmentName: mappedDepartment?.name || employeeSnapshot.department,
          joiningFormCompleted: true,
          status: "active_employee",
          documents: employeeSnapshot.documents,
          address: employeeSnapshot.address,
          educationDetails: employeeSnapshot.educationDetails,
        },
      ],
      session ? { session } : undefined
    );
    const employee = createdEmployees[0];

    candidate.convertedEmployeeId = employee._id;
    candidate.departmentId = mappedDepartment?._id || candidate.departmentId || null;
    candidate.status = "Converted to Employee";
    candidate.stageCompleted = Math.max(Number(candidate.stageCompleted || 0), 8);
    candidate.joiningForm = {
      ...candidate.joiningForm,
      isUnlocked: false,
      status: "Approved",
      reviewedAt: joiningForm?.reviewedAt || new Date(),
      reviewedBy: joiningForm?.reviewedBy || actor?._id || null,
    };
    appendTimelineIfMissing(candidate, {
      key: "employee_onboarding",
      title: "Employee Onboarding",
      description: "Candidate was converted to employee.",
      at: new Date(),
    });
    await (session ? candidate.save({ session }) : candidate.save());

    return { candidate, employee, alreadyExists: false };
  };

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await convertWithSession(session);
    });
  } catch (error) {
    const message = String(error?.message || "");
    const unsupportedTxn =
      message.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
      message.includes("does not support transactions");

    if (!unsupportedTxn) {
      throw error;
    }

    console.warn("[employee-conversion] Transactions unsupported; falling back to non-transactional conversion.", {
      candidateId: String(candidateId),
      reason: message,
    });
    result = await convertWithSession(null);
  } finally {
    await session.endSession();
  }

  if (!result.alreadyExists) {
    console.log("Employee successfully created from joining form.", {
      candidateId: String(result?.candidate?._id || candidateId),
      employeeId: result?.employee?.employeeId || "",
    });
  }

  await notifyCandidateAndAdmins({
    candidate: result.candidate,
    title: "Employee Onboarding",
    message: `${result.candidate.fullName} has been converted to employee successfully.`,
    type: "candidate",
    notifyAdmins: actor?.role === "candidate",
  });

  await sendCandidateWorkflowEmail({
    to: result.candidate.email,
    subject: "Welcome to HR Harmony Hub - Employee Onboarding",
    message:
      "Your onboarding is complete and your profile has been converted to an employee account. Please log in to continue.",
  });

  return { ...result, actor };
};
