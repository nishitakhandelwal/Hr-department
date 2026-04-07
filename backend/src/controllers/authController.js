import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { sendBrevoOtpEmail } from "../services/brevoEmailService.js";
import { ensureEmployeeProfileForUser } from "../services/employeeProfileService.js";
import { getSystemSettings, resolveRoleKeyForUser } from "../services/systemSettingsService.js";
import { generateSecureToken, hashSha256 } from "../utils/token.js";
import { createDefaultPermissions, normalizePermissions } from "../utils/permissions.js";
import { buildUploadsPublicPath } from "../utils/uploadUrls.js";
import { clearUserProfileImage, setUserProfileImage } from "../services/profileImageService.js";
import { recordUserActivity } from "../services/activityLogService.js";

const LOCK_MINUTES = 15;
const TWO_FACTOR_TTL_MINUTES = 10;
const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, accessRole: user.accessRole, email: user.email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

const hashValue = (value) => hashSha256(value);
const generateOtpCode = () => crypto.randomInt(0, 1000000).toString().padStart(6, "0");
const normalizeEmail = (value) => String(value || "").toLowerCase().trim();
const normalizePhoneNumber = (value) => String(value || "").replace(/[^\d+]/g, "").trim();

const buildPhoneCandidates = (value) => {
  const normalized = normalizePhoneNumber(value);
  const digits = normalized.replace(/\D/g, "");
  return Array.from(new Set([normalized, digits, digits ? `+${digits}` : ""].filter(Boolean)));
};

const getOtpConfig = () => ({
  ttlMinutes: Number(env.otp.ttlMinutes || 5),
  maxAttempts: Number(env.otp.maxAttempts || 3),
  resendCooldownSeconds: Number(env.otp.resendCooldownSeconds || 30),
});

const getRoleModules = (user, settings) => {
  const roleKey = resolveRoleKeyForUser(user);
  const modules = settings?.rolePermissions?.[roleKey];
  if (!modules) return null;
  return {
    dashboard: modules.dashboard,
    candidates: modules.candidates,
    employees: modules.employees,
    attendance: modules.attendance,
    payroll: modules.payroll,
    letters: modules.letters,
    departments: modules.departments,
    reports: modules.reports,
    userManagement: modules.userManagement,
    settings: modules.settings,
    candidateManagement: modules.candidates,
    jobApplications: modules.candidates,
    interviews: modules.candidates,
    offerLetters: modules.letters,
    reportsAnalytics: modules.reports,
  };
};

const toSafeUser = (user, settings = null) => {
  const rawPermissions =
    user?.permissions && typeof user.permissions.toObject === "function"
      ? user.permissions.toObject()
      : user?.permissions || {};
  const normalized = normalizePermissions(user.accessRole, rawPermissions);
  const roleModules = getRoleModules(user, settings);
  if (roleModules) {
    normalized.modules = { ...normalized.modules, ...roleModules };
  }

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    phoneNumber: user.phoneNumber || user.phone,
    profilePhotoUrl: user.profilePhotoUrl,
    profileImage: user.profileImage || user.profilePhotoUrl,
    role: user.role,
    accessRole: user.accessRole,
    accountStatus: user.accountStatus,
    joiningFormCompleted: Boolean(user.joiningFormCompleted),
    status: user.status || (user.role === "employee" ? "pending_form" : "active_employee"),
    department: user.department,
    isActive: user.isActive,
    isVerified: user.isVerified,
    permissions: normalized,
    twoFactorEnabled: user.twoFactorEnabled,
    forcePasswordReset: user.forcePasswordReset,
  };
};

const normalizeAccessRole = (role) => {
  if (role === "admin") return "admin";
  if (role === "candidate") return "candidate";
  return "employee";
};

const roleToSystemRole = (accessRole) => {
  if (accessRole === "candidate") return "candidate";
  return accessRole === "super_admin" || accessRole === "admin" ? "admin" : "employee";
};

const clearOtpState = (user) => {
  user.otpCode = "";
  user.otpExpiry = null;
  user.otpAttempts = 0;
  user.otpLastSentAt = null;
  user.otpChannel = "email";
};

const clearEmailVerificationState = (user) => {
  user.emailVerificationOtpHash = "";
  user.emailVerificationOtpExpiresAt = null;
  user.emailVerificationOtpAttempts = 0;
  user.emailVerificationOtpSentAt = null;
};

const clearPasswordResetOtpState = (user) => {
  user.passwordResetOtpHash = "";
  user.passwordResetOtpExpiresAt = null;
  user.passwordResetOtpAttempts = 0;
  user.passwordResetOtpSentAt = null;
};

const issueEmailVerificationOtp = async (user, { resend = false } = {}) => {
  const otpConfig = getOtpConfig();

  if (resend || user.emailVerificationOtpHash) {
    ensureOtpCanBeResent({ otpLastSentAt: user.emailVerificationOtpSentAt }, otpConfig);
  }

  const code = generateOtpCode();
  user.isVerified = false;
  user.emailVerificationOtpHash = hashValue(code);
  user.emailVerificationOtpExpiresAt = new Date(Date.now() + otpConfig.ttlMinutes * 60 * 1000);
  user.emailVerificationOtpAttempts = 0;
  user.emailVerificationOtpSentAt = new Date();
  await user.save();

  const result = await sendBrevoOtpEmail({
    to: user.email,
    otp: code,
    expiresInMinutes: otpConfig.ttlMinutes,
    subject: "Arihant Dream Infra Project Ltd. - Verify your email",
    heading: "Arihant Dream Infra Project Ltd. Email Verification",
    purpose: "verification code",
  });

  if (!result.success) {
    clearEmailVerificationState(user);
    await user.save();
    const error = new Error(result.error || "Unable to send verification email.");
    error.statusCode = 502;
    throw error;
  }

  return {
    message: "Verification code sent to your email.",
    expiresInSeconds: otpConfig.ttlMinutes * 60,
    resendCooldownSeconds: otpConfig.resendCooldownSeconds,
    email: user.email,
  };
};

const issuePasswordResetOtp = async (user, { resend = false } = {}) => {
  const otpConfig = getOtpConfig();

  if (resend || user.passwordResetOtpHash) {
    ensureOtpCanBeResent({ otpLastSentAt: user.passwordResetOtpSentAt }, otpConfig);
  }

  const code = generateOtpCode();
  user.passwordResetOtpHash = hashValue(code);
  user.passwordResetOtpExpiresAt = new Date(Date.now() + otpConfig.ttlMinutes * 60 * 1000);
  user.passwordResetOtpAttempts = 0;
  user.passwordResetOtpSentAt = new Date();
  await user.save();

  const result = await sendBrevoOtpEmail({
    to: user.email,
    otp: code,
    expiresInMinutes: otpConfig.ttlMinutes,
    subject: "Arihant Dream Infra Project Ltd. - Reset Password OTP",
    heading: "Password Reset OTP",
    purpose: "password reset code",
  });

  if (!result.success) {
    clearPasswordResetOtpState(user);
    await user.save();
    const error = new Error(result.error || "Unable to send password reset OTP.");
    error.statusCode = 502;
    throw error;
  }

  return {
    message: "Password reset OTP sent to your email.",
    expiresInSeconds: otpConfig.ttlMinutes * 60,
    resendCooldownSeconds: otpConfig.resendCooldownSeconds,
    email: user.email,
  };
};

const finalizeAuthenticatedSession = async ({ user, req, settings, message = "Successful login" }) => {
  const token = signToken(user);
  user.lastLoginAt = new Date();
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  clearOtpState(user);
  user.twoFactorCodeHash = "";
  user.twoFactorCodeExpiresAt = null;
  if (user.accountStatus === "pending") user.accountStatus = "active";
  await user.save();

  if (user.role === "employee") {
    await ensureEmployeeProfileForUser(user);
  }

  await recordUserActivity({
    user,
    action: "User Logged In",
    details: message,
    ipAddress: req.ip || "",
  });

  return {
    success: true,
    token,
    user: toSafeUser(user, settings),
    mustResetPassword: Boolean(user.forcePasswordReset),
  };
};

const ensureOtpCanBeResent = (user, otpConfig) => {
  if (!user.otpLastSentAt) return;
  const cooldownEndsAt = user.otpLastSentAt.getTime() + otpConfig.resendCooldownSeconds * 1000;
  if (cooldownEndsAt > Date.now()) {
    const remainingSeconds = Math.ceil((cooldownEndsAt - Date.now()) / 1000);
    const error = new Error(`Please wait ${remainingSeconds}s before requesting another OTP.`);
    error.statusCode = 429;
    throw error;
  }
};

const findUserForOtpLogin = async ({ phoneNumber, email }) => {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    return User.findOne({ email: normalizedEmail });
  }

  const phoneCandidates = buildPhoneCandidates(phoneNumber);
  if (phoneCandidates.length === 0) return null;

  return User.findOne({
    $or: [{ phoneNumber: { $in: phoneCandidates } }, { phone: { $in: phoneCandidates } }],
  });
};

const deliverOtp = async ({ user, code, otpConfig }) => {
  const result = await sendBrevoOtpEmail({
    to: user.email,
    otp: code,
    expiresInMinutes: otpConfig.ttlMinutes,
  });

  if (!result.success) {
    const error = new Error(result.error || "Unable to send OTP email.");
    error.statusCode = 502;
    throw error;
  }

  return result;
};

export const register = async (req, res) => {
  const { name, email, password, role } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const accessRole = normalizeAccessRole(role);
  const systemRole = roleToSystemRole(accessRole);

  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) {
    const error = new Error("Email already in use");
    error.statusCode = 409;
    throw error;
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hash,
    role: systemRole,
    accessRole,
    accountStatus: "active",
    isVerified: false,
    permissions: createDefaultPermissions(accessRole),
  });
  const verification = await issueEmailVerificationOtp(user);
  return res.status(201).json({
    success: true,
    message: "Registration successful. Verify your email to continue.",
    data: verification,
  });
};

export const login = async (req, res) => {
  const { email, password, otp = "" } = req.body;
  const settings = await getSystemSettings({ lean: true });
  const maxFailedAttempts = Number(settings?.security?.maxLoginAttempts || 5);
  const otpLoginEnabled = settings?.security?.otpLoginEnabled !== false;
  const twoFactorEnforced = settings?.security?.twoFactorEnforced === true;
  const user = await User.findOne({ email: normalizeEmail(email) });

  if (!user || !user.isActive || user.accountStatus === "disabled") {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    const error = new Error("Account is locked due to multiple failed login attempts. Try again later.");
    error.statusCode = 423;
    throw error;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    user.failedLoginAttempts = Number(user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= maxFailedAttempts) {
      user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      user.failedLoginAttempts = 0;
    }
    await user.save();

    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  if (!user.isVerified) {
    if (user.role === "employee" || user.accessRole === "employee") {
      // Employee accounts created from admin HR flows do not use email verification.
      user.isVerified = true;
    } else {
      const error = new Error("Please verify your email before signing in.");
      error.statusCode = 403;
      throw error;
    }
  }

  const shouldRequireTwoFactor = otpLoginEnabled && (user.twoFactorEnabled || (twoFactorEnforced && user.role === "admin"));
  if (shouldRequireTwoFactor) {
    if (!otp) {
      const code = generateOtpCode();
      user.twoFactorCodeHash = hashValue(code);
      user.twoFactorCodeExpiresAt = new Date(Date.now() + TWO_FACTOR_TTL_MINUTES * 60 * 1000);
      await user.save();

      await sendBrevoOtpEmail({
        to: user.email,
        otp: code,
        expiresInMinutes: TWO_FACTOR_TTL_MINUTES,
        subject: "Arihant Dream Infra Project Ltd. - Login Verification Code",
        heading: "Login Verification Code",
        purpose: "verification code",
      });

      return res.status(202).json({
        success: true,
        requiresTwoFactor: true,
        message: "Verification code sent to your email.",
      });
    }

    const codeValid =
      user.twoFactorCodeHash &&
      user.twoFactorCodeExpiresAt &&
      user.twoFactorCodeExpiresAt.getTime() > Date.now() &&
      user.twoFactorCodeHash === hashValue(String(otp));

    if (!codeValid) {
      const error = new Error("Invalid or expired verification code.");
      error.statusCode = 401;
      throw error;
    }
  }

  const payload = await finalizeAuthenticatedSession({
    user,
    req,
    settings,
    message: "Successful email-password login",
  });

  return res.json(payload);
};

export const requestOtp = async (req, res) => {
  const { phoneNumber = "", email = "", resend = false } = req.body;
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const normalizedEmail = normalizeEmail(email);
  const otpConfig = getOtpConfig();
  const settings = await getSystemSettings({ lean: true });

  if (settings?.security?.otpLoginEnabled === false) {
    return res.status(403).json({ success: false, message: "OTP login is disabled." });
  }

  const user = await findUserForOtpLogin({ phoneNumber: normalizedPhone, email: normalizedEmail });

  if (!user || !user.isActive || user.accountStatus === "disabled") {
    return res.status(404).json({ success: false, message: "No active user found for the provided contact details." });
  }

  if (!normalizedPhone && !normalizedEmail) {
    return res.status(400).json({ success: false, message: "A valid email or phone number is required." });
  }

  if (!user.email) {
    return res.status(400).json({ success: false, message: "User does not have an email address configured for OTP delivery." });
  }

  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    return res.status(423).json({ success: false, message: "Account is temporarily locked. Try again later." });
  }

  if (resend || user.otpCode) {
    ensureOtpCanBeResent(user, otpConfig);
  }

  const code = generateOtpCode();
  user.otpCode = hashValue(code);
  user.otpExpiry = new Date(Date.now() + otpConfig.ttlMinutes * 60 * 1000);
  user.otpAttempts = 0;
  user.otpLastSentAt = new Date();
  user.otpChannel = "email";
  if (normalizedPhone) {
    user.phoneNumber = normalizedPhone;
    user.phone = normalizedPhone;
  }
  await user.save();

  let providerResult;
  try {
    providerResult = await deliverOtp({
      user,
      code,
      otpConfig,
    });
  } catch (error) {
    clearOtpState(user);
    await user.save();
    console.error("[authController] OTP request failed", {
      identifier: normalizedEmail || normalizedPhone,
      userId: String(user._id),
      message: error?.message,
    });
    throw error;
  }

  console.log("[authController] OTP generated", {
    userId: String(user._id),
    identifier: normalizedEmail || normalizedPhone,
    delivery: user.email,
    expiresAt: user.otpExpiry?.toISOString?.() || null,
  });

  return res.status(200).json({
    success: true,
    message: "OTP sent to your email.",
    expiresIn: otpConfig.ttlMinutes * 60,
    expiresInSeconds: otpConfig.ttlMinutes * 60,
    resendAvailableIn: otpConfig.resendCooldownSeconds,
    resendCooldownSeconds: otpConfig.resendCooldownSeconds,
    channel: "email",
    destination: user.email,
    provider: providerResult.provider || "email",
    debugOtp: env.nodeEnv !== "production" && providerResult.mock ? code : undefined,
  });
};

export const sendOtp = requestOtp;

export const verifyOtp = async (req, res) => {
  const { phoneNumber = "", email = "", otp = "" } = req.body;
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const normalizedEmail = normalizeEmail(email);
  const normalizedOtp = String(otp || "").replace(/\D/g, "").slice(0, 6);
  const otpConfig = getOtpConfig();
  const settings = await getSystemSettings({ lean: true });

  const user = await findUserForOtpLogin({ phoneNumber: normalizedPhone, email: normalizedEmail });

  if (!user || !user.isActive || user.accountStatus === "disabled") {
    return res.status(404).json({ success: false, message: "No active user found for the provided contact details." });
  }

  if (!user.otpCode || !user.otpExpiry || user.otpExpiry.getTime() <= Date.now()) {
    clearOtpState(user);
    await user.save();
    return res.status(401).json({ success: false, message: "OTP has expired. Request a new code." });
  }

  if (Number(user.otpAttempts || 0) >= otpConfig.maxAttempts) {
    clearOtpState(user);
    await user.save();
    return res.status(429).json({ success: false, message: "Maximum OTP attempts reached. Request a new code." });
  }

  if (user.otpCode !== hashValue(normalizedOtp)) {
    user.otpAttempts = Number(user.otpAttempts || 0) + 1;
    const remainingAttempts = Math.max(0, otpConfig.maxAttempts - user.otpAttempts);
    if (user.otpAttempts >= otpConfig.maxAttempts) {
      clearOtpState(user);
    }
    await user.save();
    return res.status(401).json({
      success: false,
      message: remainingAttempts > 0 ? `Invalid OTP. ${remainingAttempts} attempt(s) remaining.` : "Maximum OTP attempts reached. Request a new code.",
      attemptsRemaining: remainingAttempts,
    });
  }

  const payload = await finalizeAuthenticatedSession({
    user,
    req,
    settings,
    message: normalizedEmail ? "Successful email OTP login" : "Successful phone OTP login",
  });

  return res.json(payload);
};

export const registerCandidate = async (req, res) => {
  const { name, email, password, department = "Candidate" } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) {
    const error = new Error("Email already in use");
    error.statusCode = 409;
    throw error;
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: normalizedEmail,
    password: hash,
    role: "candidate",
    accessRole: "candidate",
    accountStatus: "active",
    isVerified: false,
    department,
    permissions: createDefaultPermissions("candidate"),
  });
  const verification = await issueEmailVerificationOtp(user);
  return res.status(201).json({
    success: true,
    message: "Registration successful. Verify your email to continue.",
    data: verification,
  });
};

export const verifyRegistrationOtp = async (req, res) => {
  const { email = "", otp = "" } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedOtp = String(otp || "").replace(/\D/g, "").slice(0, 6);
  const otpConfig = getOtpConfig();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user || user.accountStatus === "disabled") {
    return res.status(404).json({ success: false, message: "No active user found for this email." });
  }

  if (user.isVerified) {
    return res.json({ success: true, message: "Email already verified." });
  }

  if (
    !user.emailVerificationOtpHash ||
    !user.emailVerificationOtpExpiresAt ||
    user.emailVerificationOtpExpiresAt.getTime() <= Date.now()
  ) {
    clearEmailVerificationState(user);
    await user.save();
    return res.status(401).json({ success: false, message: "Verification code has expired. Request a new code." });
  }

  if (Number(user.emailVerificationOtpAttempts || 0) >= otpConfig.maxAttempts) {
    clearEmailVerificationState(user);
    await user.save();
    return res.status(429).json({ success: false, message: "Maximum verification attempts reached. Request a new code." });
  }

  if (user.emailVerificationOtpHash !== hashValue(normalizedOtp)) {
    user.emailVerificationOtpAttempts = Number(user.emailVerificationOtpAttempts || 0) + 1;
    const attemptsRemaining = Math.max(0, otpConfig.maxAttempts - user.emailVerificationOtpAttempts);
    if (user.emailVerificationOtpAttempts >= otpConfig.maxAttempts) {
      clearEmailVerificationState(user);
    }
    await user.save();
    return res.status(401).json({
      success: false,
      message:
        attemptsRemaining > 0
          ? `Invalid verification code. ${attemptsRemaining} attempt(s) remaining.`
          : "Maximum verification attempts reached. Request a new code.",
      attemptsRemaining,
    });
  }

  user.isVerified = true;
  clearEmailVerificationState(user);
  await user.save();

  return res.json({ success: true, message: "Email verified successfully." });
};

export const resendRegistrationOtp = async (req, res) => {
  const { email = "" } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });

  if (!user || user.accountStatus === "disabled") {
    return res.status(404).json({ success: false, message: "No active user found for this email." });
  }

  if (user.isVerified) {
    return res.status(400).json({ success: false, message: "Email is already verified." });
  }

  const verification = await issueEmailVerificationOtp(user, { resend: true });
  return res.json({
    success: true,
    message: verification.message,
    data: verification,
  });
};

export const requestPasswordReset = async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body?.email);
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "No account found with this email address.",
    });
  }

  try {
    const otpPayload = await issuePasswordResetOtp(user, { resend: Boolean(req.body?.resend) });
    return res.json({ success: true, message: "Password reset OTP sent successfully.", data: otpPayload });
  } catch (error) {
    console.error("[authController] Password reset OTP failed", {
      email: user.email,
      userId: String(user._id),
      message: error instanceof Error ? error.message : "Unknown OTP error",
      code: error?.code,
      details: error?.details,
    });

    return res.status(502).json({
      success: false,
      message: "Failed to send reset OTP. Please try again later.",
    });
  }
};

export const resetPassword = async (req, res) => {
  const token = req.params?.token || req.body?.token;
  const { email = "", otp = "", password } = req.body;
  let user = null;

  if (token) {
    const tokenHash = hashValue(String(token || ""));
    user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token." });
    }
  } else {
    const normalizedEmail = normalizeEmail(email);
    const normalizedOtp = String(otp || "").replace(/\D/g, "").slice(0, 6);
    const otpConfig = getOtpConfig();
    user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP." });
    }

    if (!user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt || user.passwordResetOtpExpiresAt.getTime() <= Date.now()) {
      clearPasswordResetOtpState(user);
      await user.save();
      return res.status(400).json({ success: false, message: "OTP has expired. Request a new code." });
    }

    if (Number(user.passwordResetOtpAttempts || 0) >= otpConfig.maxAttempts) {
      clearPasswordResetOtpState(user);
      await user.save();
      return res.status(429).json({ success: false, message: "Maximum OTP attempts reached. Request a new code." });
    }

    if (user.passwordResetOtpHash !== hashValue(normalizedOtp)) {
      user.passwordResetOtpAttempts = Number(user.passwordResetOtpAttempts || 0) + 1;
      const remainingAttempts = Math.max(0, otpConfig.maxAttempts - user.passwordResetOtpAttempts);

      if (user.passwordResetOtpAttempts >= otpConfig.maxAttempts) {
        clearPasswordResetOtpState(user);
      }

      await user.save();
      return res.status(400).json({
        success: false,
        message: remainingAttempts > 0 ? `Invalid OTP. ${remainingAttempts} attempt(s) remaining.` : "Maximum OTP attempts reached. Request a new code.",
      });
    }
  }

  user.password = await bcrypt.hash(String(password), 10);
  user.forcePasswordReset = false;
  user.passwordResetToken = "";
  user.passwordResetTokenExpires = null;
  clearPasswordResetOtpState(user);
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  await recordUserActivity({
    user,
    action: "Password Reset",
    details: "User reset password via secure token",
    ipAddress: req.ip || "",
  });

  return res.json({ success: true, message: "Password reset successful." });
};

export const me = async (req, res) => {
  const settings = await getSystemSettings({ lean: true });
  return res.json({ success: true, user: toSafeUser(req.user, settings) });
};

export const updateMyProfilePhoto = async (req, res) => {
  if (!req.user?._id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: "Please upload an image file." });
  }

  const allowedMimeTypes = ["image/jpeg", "image/png"];
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ success: false, message: "Only JPG and PNG images are allowed." });
  }

  let user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  const nextPhotoUrl = buildUploadsPublicPath("settings", req.file.filename);
  user = await setUserProfileImage({ userId: user._id, imageUrl: nextPhotoUrl });

  const settings = await getSystemSettings({ lean: true });

  return res.json({
    success: true,
    message: "Profile photo updated successfully.",
    user: toSafeUser(user, settings),
  });
};

export const uploadProfileImage = updateMyProfilePhoto;
export const updateProfileImage = updateMyProfilePhoto;

export const uploadProfileImageViaSharedRoute = async (req, res) => {
  if (!req.user?._id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: "Please upload a profile image file." });
  }

  let user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  const imageUrl = buildUploadsPublicPath("profile", req.file.filename);
  user = await setUserProfileImage({ userId: user._id, imageUrl });

  const settings = await getSystemSettings({ lean: true });
  return res.status(201).json({
    success: true,
    message: "Profile image uploaded successfully.",
    data: {
      imageUrl,
      user: toSafeUser(user, settings),
    },
  });
};

export const removeProfileImage = async (req, res) => {
  if (!req.user?._id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  let user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  user = await clearUserProfileImage({ userId: user._id });

  const settings = await getSystemSettings({ lean: true });
  return res.json({
    success: true,
    message: "Profile image removed successfully.",
    user: toSafeUser(user, settings),
  });
};

export const logout = async (req, res) => {
  if (req.user?._id) {
    await recordUserActivity({
      user: req.user,
      action: "User Logged Out",
      details: "Session ended",
      ipAddress: req.ip || "",
    });
  }

  return res.json({ success: true, message: "Logged out successfully." });
};
