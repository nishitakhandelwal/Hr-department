import bcrypt from "bcryptjs";
import { Candidate } from "../models/Candidate.js";
import { Employee } from "../models/Employee.js";
import { Leave } from "../models/Leave.js";
import { Payroll } from "../models/Payroll.js";
import { User } from "../models/User.js";
import { AuditLog } from "../models/AuditLog.js";
import { UserActivity } from "../models/UserActivity.js";
import { sendEmail } from "../services/emailService.js";
import { createDefaultPermissions, normalizePermissions } from "../utils/permissions.js";
import { createAuditLogIfEnabled, maybeSendEmailBySettings } from "../services/runtimeBehaviorService.js";
import { buildUploadsPublicPath } from "../utils/uploadUrls.js";
import { clearUserProfileImage, setUserProfileImage } from "../services/profileImageService.js";
import { buildInvitationEmailLayout } from "../layouts/email/index.js";
import { deleteUserCompletely } from "../services/userDeletionService.js";
import { recordUserActivity } from "../services/activityLogService.js";
import { uploadFileToS3 } from "../services/s3Service.js";

const ACCESS_ROLES = ["super_admin", "admin", "hr_manager", "recruiter", "employee", "candidate"];
const ACCOUNT_STATUSES = ["active", "disabled", "pending"];
const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  hr_manager: "HR Manager",
  recruiter: "Recruiter",
  candidate: "Candidate",
  employee: "Employee",
};
const DASHBOARD_SUMMARY_TTL_MS = 15 * 1000;
let dashboardSummaryCache = {
  expiresAt: 0,
  data: null,
};

const toString = (value) => String(value ?? "").trim();

const normalizeAccessRole = (raw, fallbackRole = "employee") => {
  const value = toString(raw).toLowerCase();
  if (ACCESS_ROLES.includes(value)) return value;
  if (fallbackRole === "admin") return "admin";
  if (fallbackRole === "candidate") return "candidate";
  return "employee";
};

const accessRoleToSystemRole = (accessRole) => {
  if (accessRole === "super_admin" || accessRole === "admin") return "admin";
  if (accessRole === "candidate") return "candidate";
  return "employee";
};

const normalizeAccountStatus = (value) => {
  const normalized = toString(value).toLowerCase();
  if (ACCOUNT_STATUSES.includes(normalized)) return normalized;
  return "active";
};

const applyJoiningFormActivationRules = (payload) => {
  const accessRole = payload.accessRole || normalizeAccessRole(payload.accessRole, payload.role);
  const systemRole = payload.role || accessRoleToSystemRole(accessRole);
  const isEmployee = systemRole === "employee";

  if (!isEmployee) {
    payload.joiningFormCompleted = true;
    payload.status = "active_employee";
    return payload;
  }

  payload.joiningFormCompleted = false;
  payload.status = "pending_form";
  return payload;
};

const mergePermissions = (role, incoming = {}, existing = null) => {
  const base = existing || createDefaultPermissions(role);
  return normalizePermissions(role, {
    modules: { ...base.modules, ...(incoming.modules || {}) },
    actions: { ...base.actions, ...(incoming.actions || {}) },
    pageAccess: Array.isArray(incoming.pageAccess) ? incoming.pageAccess.map((item) => toString(item)).filter(Boolean) : base.pageAccess,
  });
};

const sanitizeUser = (user) => {
  const raw = user.toObject ? user.toObject() : user;
  delete raw.password;
  return raw;
};

const invalidateDashboardSummaryCache = () => {
  dashboardSummaryCache = { expiresAt: 0, data: null };
};

const logUserActivity = async ({ user, action, details = "", ipAddress = "" }) => {
  return recordUserActivity({ user, action, details, ipAddress });
};

const logAudit = async ({ actor, action, targetType = "", targetId = "", metadata = {} }) => {
  await createAuditLogIfEnabled({
    actorId: actor?._id ?? null,
    actorName: toString(actor?.name),
    actorEmail: toString(actor?.email),
    action: toString(action),
    targetType: toString(targetType),
    targetId: toString(targetId),
    metadata,
  });
};

export const getUsers = async (_req, res) => {
  const rows = await User.find()
    .select("-password")
    .sort({ createdAt: -1 })
    .lean();
  const users = rows.map((row) => ({
    ...row,
    accessRole: row.accessRole || normalizeAccessRole("", row.role),
    accountStatus: row.accountStatus || "active",
  }));
  res.json({ success: true, message: "Fetched users", data: users });
};

export const getManagedUsers = async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
  const skip = (page - 1) * limit;
  const search = toString(req.query.search);
  const role = toString(req.query.role).toLowerCase();
  const department = toString(req.query.department);
  const status = toString(req.query.status).toLowerCase();
  const activity = toString(req.query.activity);
  const sortBy = toString(req.query.sortBy || "createdAt");
  const sortOrder = toString(req.query.sortOrder || "desc") === "asc" ? 1 : -1;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { department: { $regex: search, $options: "i" } },
    ];
  }
  if (role && ACCESS_ROLES.includes(role)) query.accessRole = role;
  if (department) query.department = { $regex: department, $options: "i" };
  if (status && ACCOUNT_STATUSES.includes(status)) {
    query.accountStatus = status === "active" ? { $in: ["active", null] } : status;
  }

  if (activity) {
    const activityRows = await UserActivity.find({ action: { $regex: activity, $options: "i" } }).select("userId").lean();
    const userIds = [...new Set(activityRows.map((row) => String(row.userId)))];
    query._id = { $in: userIds };
  }

  const [rows, total] = await Promise.all([
    User.find(query).select("-password").sort({ [sortBy]: sortOrder }).skip(skip).limit(limit).lean(),
    User.countDocuments(query),
  ]);

  const items = rows.map((row) => ({
    ...row,
    accessRole: row.accessRole || normalizeAccessRole("", row.role),
    accountStatus: row.accountStatus || "active",
  }));

  return res.json({
    success: true,
    message: "Fetched managed users",
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    },
  });
};

export const listUserActivities = async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
  const skip = (page - 1) * limit;
  const search = toString(req.query.search);

  const query = {};
  if (search) {
    query.$or = [
      { userName: { $regex: search, $options: "i" } },
      { userEmail: { $regex: search, $options: "i" } },
      { action: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    UserActivity.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    UserActivity.countDocuments(query),
  ]);

  return res.json({
    success: true,
    message: "Fetched user activity logs",
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    },
  });
};

export const listAuditLogs = async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
  const skip = (page - 1) * limit;
  const search = toString(req.query.search);

  const query = {};
  if (search) {
    query.$or = [
      { action: { $regex: search, $options: "i" } },
      { actorName: { $regex: search, $options: "i" } },
      { targetType: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments(query),
  ]);

  return res.json({
    success: true,
    message: "Fetched audit logs",
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    },
  });
};

export const createUser = async (req, res) => {
  const payload = { ...req.body };
  if (!payload.password || payload.password.length < 6) {
    const error = new Error("Password must be at least 6 characters.");
    error.statusCode = 422;
    throw error;
  }

  const accessRole = normalizeAccessRole(payload.accessRole, payload.role);
  payload.role = accessRoleToSystemRole(accessRole);
  payload.accessRole = accessRole;
  payload.accountStatus = normalizeAccountStatus(payload.accountStatus || "active");
  applyJoiningFormActivationRules(payload);
  payload.permissions = mergePermissions(accessRole, payload.permissions);
  payload.password = await bcrypt.hash(payload.password, 10);

  const user = await User.create(payload);
  const safeUser = sanitizeUser(user);
  invalidateDashboardSummaryCache();

  await logAudit({
    actor: req.user,
    action: "USER_CREATED",
    targetType: "User",
    targetId: safeUser._id,
    metadata: { email: safeUser.email, accessRole: safeUser.accessRole },
  });

  await logUserActivity({
    user: req.user,
    action: "Created user",
    details: `${safeUser.name} (${safeUser.email}) created`,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, message: "User created", data: safeUser });
};

export const inviteUser = async (req, res) => {
  const { name = "", email = "", role = "", department = "", temporaryPassword = "" } = req.body;
  if (temporaryPassword.length < 6) {
    return res.status(422).json({ success: false, message: "Temporary password must be at least 6 characters." });
  }

  const accessRole = normalizeAccessRole(role, role === "candidate" ? "candidate" : "employee");
  const hash = await bcrypt.hash(temporaryPassword, 10);
  const normalizedEmail = toString(email).toLowerCase();
  const user = await User.create({
    name: toString(name),
    email: normalizedEmail,
    password: hash,
    role: accessRoleToSystemRole(accessRole),
    accessRole,
    department: toString(department),
    accountStatus: "pending",
    forcePasswordReset: true,
    joiningFormCompleted: accessRole !== "employee",
    status: accessRole === "employee" ? "pending_form" : "active_employee",
    permissions: createDefaultPermissions(accessRole),
  });

  const safeUser = sanitizeUser(user);
  invalidateDashboardSummaryCache();

  await logAudit({
    actor: req.user,
    action: "USER_INVITED",
    targetType: "User",
    targetId: safeUser._id,
    metadata: { email: safeUser.email, accessRole: safeUser.accessRole },
  });

  await logUserActivity({
    user: req.user,
    action: "Invited user",
    details: `${safeUser.name} (${safeUser.email}) invited`,
    ipAddress: req.ip,
  });

  const loginUrl = `${req.protocol}://${req.get("host").replace(":5000", ":8080")}/login`;
  const invitationEmail = buildInvitationEmailLayout({
    name: toString(name),
    role: ROLE_LABELS[accessRole] || accessRole,
    email: normalizedEmail,
    temporaryPassword,
    loginUrl,
  });
  const emailResult = await maybeSendEmailBySettings(() =>
    sendEmail({
      to: normalizedEmail,
      subject: invitationEmail.subject,
      html: invitationEmail.html,
      text: invitationEmail.text,
    })
  );

  res.status(201).json({
    success: true,
    message: emailResult.success
      ? "Invitation created and email sent successfully."
      : emailResult.skipped
      ? "Invitation created, but email delivery is currently disabled by system settings."
      : `Invitation created, but email could not be sent: ${emailResult.error || "Unknown email error"}`,
    data: { ...safeUser, invitationEmailSent: Boolean(emailResult.success) },
  });
};

export const updateUser = async (req, res) => {
  const payload = { ...req.body };
  if (payload.password) payload.password = await bcrypt.hash(payload.password, 10);
  delete payload.joiningFormCompleted;
  delete payload.status;
  if (payload.accessRole || payload.role) {
    const accessRole = normalizeAccessRole(payload.accessRole, payload.role);
    payload.accessRole = accessRole;
    payload.role = accessRoleToSystemRole(accessRole);
    if (!payload.permissions) payload.permissions = createDefaultPermissions(accessRole);
    if (payload.role === "employee") {
      payload.joiningFormCompleted = false;
      payload.status = "pending_form";
    }
  }
  if (payload.accountStatus) payload.accountStatus = normalizeAccountStatus(payload.accountStatus);
  const user = await User.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  }).select("-password");
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  invalidateDashboardSummaryCache();

  await logAudit({
    actor: req.user,
    action: "USER_UPDATED",
    targetType: "User",
    targetId: user._id,
    metadata: payload,
  });
  await logUserActivity({
    user: req.user,
    action: "Updated user",
    details: `${user.name} (${user.email}) updated`,
    ipAddress: req.ip,
  });
  res.json({ success: true, message: "User updated", data: user });
};

export const updateUserRole = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  if (String(req.user._id) === String(req.params.id)) {
    return res.status(400).json({ success: false, message: "You cannot change your own role." });
  }

  const accessRole = normalizeAccessRole(req.body.accessRole);

  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      accessRole,
      role: accessRoleToSystemRole(accessRole),
      ...(accessRoleToSystemRole(accessRole) === "employee"
        ? { joiningFormCompleted: false, status: "pending_form" }
        : { joiningFormCompleted: true, status: "active_employee" }),
      permissions: mergePermissions(accessRole, req.body.permissions),
    },
    { new: true, runValidators: true }
  ).select("-password");

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  invalidateDashboardSummaryCache();

  await logAudit({
    actor: req.user,
    action: "ROLE_CHANGED",
    targetType: "User",
    targetId: user._id,
    metadata: { accessRole: user.accessRole },
  });
  await logUserActivity({
    user: req.user,
    action: "Changed user role",
    details: `${user.name} role changed to ${user.accessRole}`,
    ipAddress: req.ip,
  });

  return res.json({ success: true, message: "User role updated", data: user });
};

export const updateUserStatus = async (req, res) => {
  const accountStatus = normalizeAccountStatus(req.body.accountStatus);
  const existingUser = await User.findById(req.params.id).select("_id role status joiningFormCompleted");
  if (!existingUser) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      accountStatus,
      isActive: accountStatus !== "disabled",
      ...(existingUser.role === "employee"
        ? {
            joiningFormCompleted: Boolean(existingUser.joiningFormCompleted),
            status: existingUser.joiningFormCompleted ? "active_employee" : "pending_form",
          }
        : {}),
    },
    { new: true, runValidators: true }
  ).select("-password");
  invalidateDashboardSummaryCache();

  await logAudit({
    actor: req.user,
    action: "USER_STATUS_CHANGED",
    targetType: "User",
    targetId: user._id,
    metadata: { accountStatus: user.accountStatus },
  });
  return res.json({ success: true, message: "User status updated", data: user });
};

export const updateUserSecurity = async (req, res) => {
  const updates = {
    forcePasswordReset: Boolean(req.body.forcePasswordReset),
    twoFactorEnabled: Boolean(req.body.twoFactorEnabled),
  };
  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  }).select("-password");
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  invalidateDashboardSummaryCache();

  await logAudit({
    actor: req.user,
    action: "USER_SECURITY_UPDATED",
    targetType: "User",
    targetId: user._id,
    metadata: updates,
  });
  return res.json({ success: true, message: "User security updated", data: user });
};

export const updateUserPermissions = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  user.permissions = mergePermissions(user.accessRole, req.body.permissions, user.permissions);
  await user.save();
  const safeUser = sanitizeUser(user);
  invalidateDashboardSummaryCache();

  await logAudit({
    actor: req.user,
    action: "PERMISSIONS_UPDATED",
    targetType: "User",
    targetId: safeUser._id,
    metadata: { permissions: safeUser.permissions },
  });

  return res.json({ success: true, message: "User permissions updated", data: safeUser });
};

export const deleteUser = async (req, res) => {
  const result = await deleteUserCompletely(req.params.id);
  const user = result.user;
  invalidateDashboardSummaryCache();

  await logAudit({
    actor: req.user,
    action: "USER_DELETED",
    targetType: "User",
    targetId: user._id,
    metadata: { email: user.email, deletionSummary: result.summary },
  });

  res.json({ success: true, message: "User deleted", data: { user, deletionSummary: result.summary } });
};

export const getAdminDashboardSummary = async (_req, res) => {
  if (dashboardSummaryCache.data && dashboardSummaryCache.expiresAt > Date.now()) {
    res.set("Cache-Control", "private, max-age=15");
    return res.json({
      success: true,
      message: "Fetched admin dashboard summary",
      data: dashboardSummaryCache.data,
    });
  }

  const [
    activeEmployeesCount,
    totalEmployees,
    totalCandidates,
    applicationsUnderReview,
    pendingHrReviews,
    pendingLeavesCount,
    payrollTotals,
    departmentRows,
    recentEmployees,
    leaves,
    interviewCandidates,
  ] = await Promise.all([
    Employee.countDocuments({ status: { $in: ["active", "active_employee"] } }),
    Employee.countDocuments(),
    Candidate.countDocuments(),
    Candidate.countDocuments({ status: { $in: ["Under Review", "Interview Scheduled"] } }),
    Candidate.countDocuments({ stageCompleted: { $gte: 2 }, "adminReview.reviewedAt": { $exists: false } }),
    Leave.countDocuments({ status: "pending" }),
    Payroll.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ["$netSalary", 0] } } } }]),
    Employee.aggregate([
      {
        $group: {
          _id: {
            $ifNull: ["$department", "$departmentName"],
          },
        },
      },
      { $match: { _id: { $nin: [null, ""] } } },
      { $count: "total" },
    ]),
    Employee.find()
      .select("employeeId fullName email department designation salary status userId createdAt")
      .populate("userId", "name email department")
      .sort({ createdAt: -1 })
      .limit(12)
      .lean(),
    Leave.find({ status: "pending" })
      .select("employeeId fromDate leaveType")
      .populate({ path: "employeeId", select: "userId fullName", populate: { path: "userId", select: "name" } })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Candidate.find({ "interviewSchedule.date": { $exists: true, $ne: "" } })
      .select("fullName positionApplied status interviewSchedule")
      .sort({ "interviewSchedule.date": 1 })
      .limit(6)
      .lean(),
  ]);

  const totalPayrollValue = Number(payrollTotals[0]?.total || 0);
  const departmentsCovered = Number(departmentRows[0]?.total || 0);

  const interviewEvents = interviewCandidates.map((candidate) => ({
    id: `candidate-${candidate._id}`,
    title: `${candidate.fullName || "Candidate"} interview`,
    date: candidate.interviewSchedule?.date,
    type: "meeting",
    time: candidate.interviewSchedule?.time || "",
    note: candidate.positionApplied || candidate.status,
  }));

  const leaveEvents = leaves.map((leave) => ({
    id: `leave-${leave._id}`,
    title: `${leave.employeeId?.userId?.name || leave.employeeId?.fullName || "Employee"} leave starts`,
    date: leave.fromDate,
    type: "holiday",
    note: leave.leaveType ? `${leave.leaveType} request awaiting approval.` : "Pending leave request.",
  }));

  const data = {
    activeEmployeesCount,
    applicationsUnderReview,
    pendingHrReviews,
    pendingLeavesCount,
    totalPayrollValue,
    departmentsCovered,
    totalCandidates,
    totalEmployees,
    recentEmployees,
    events: [...leaveEvents, ...interviewEvents].slice(0, 12),
  };
  dashboardSummaryCache = {
    expiresAt: Date.now() + DASHBOARD_SUMMARY_TTL_MS,
    data,
  };
  res.set("Cache-Control", "private, max-age=15");
  return res.json({
    success: true,
    message: "Fetched admin dashboard summary",
    data,
  });
};

export const updateUserProfileImage = async (req, res) => {
  let user = await User.findById(req.params.id).select("-password");
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Please upload an image file." });
  }

  console.log("[Managed User Profile Upload Debug] req.file", {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    hasBuffer: Boolean(req.file.buffer),
  });
  console.log("[Managed User Profile Upload Debug] req.body", req.body);

  const uploadedImage = await uploadFileToS3({
    file: req.file,
    folder: "profiles/",
  });

  user = await setUserProfileImage({
    userId: user._id,
    imageUrl: uploadedImage.url,
  });

  await logAudit({
    actor: req.user,
    action: "USER_PROFILE_IMAGE_UPDATED",
    targetType: "User",
    targetId: user._id,
    metadata: { email: user.email },
  });

  return res.json({
    success: true,
    message: "User profile image updated successfully.",
    data: {
      ...user.toObject(),
      profileImage: uploadedImage.url,
      profilePhotoUrl: uploadedImage.url,
    },
  });
};

export const removeUserProfileImage = async (req, res) => {
  let user = await User.findById(req.params.id).select("-password");
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  user = await clearUserProfileImage({ userId: user._id });

  await logAudit({
    actor: req.user,
    action: "USER_PROFILE_IMAGE_REMOVED",
    targetType: "User",
    targetId: user._id,
    metadata: { email: user.email },
  });

  return res.json({ success: true, message: "User profile image removed successfully.", data: user });
};
