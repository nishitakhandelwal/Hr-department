import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { asyncHandler } from "./asyncHandler.js";
import { normalizePermissions } from "../utils/permissions.js";
import { getSystemSettings, resolveRoleKeyForUser } from "../services/systemSettingsService.js";

export const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("[auth.protect] Missing or invalid authorization header", {
      method: req.method,
      path: req.originalUrl,
      hasHeader: Boolean(authHeader),
    });
    const error = new Error("Unauthorized: Missing token");
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.split(" ")[1];
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (verificationError) {
    console.warn("[auth.protect] JWT verification failed", {
      method: req.method,
      path: req.originalUrl,
      message: verificationError instanceof Error ? verificationError.message : "Unknown token verification error",
    });
    const error = new Error("Unauthorized: Invalid token");
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findById(payload.id).select(
    "_id name email phone profilePhotoUrl profileImage role accessRole department isActive isVerified accountStatus joiningFormCompleted status permissions forcePasswordReset twoFactorEnabled"
  );
  if (!user || !user.isActive) {
    console.warn("[auth.protect] User not found or inactive for token", {
      method: req.method,
      path: req.originalUrl,
      tokenUserId: payload?.id || null,
      tokenRole: payload?.role || null,
      tokenAccessRole: payload?.accessRole || null,
    });
    const error = new Error("Unauthorized: User not found or inactive");
    error.statusCode = 401;
    throw error;
  }

  const settings = await getSystemSettings({ lean: true });
  const sessionTimeoutMinutes = Number(settings?.security?.sessionTimeoutMinutes || 60);
  const tokenIssuedAt = Number(payload.iat || 0) * 1000;
  if (tokenIssuedAt && Date.now() - tokenIssuedAt > sessionTimeoutMinutes * 60 * 1000) {
    const error = new Error("Session expired. Please login again.");
    error.statusCode = 401;
    throw error;
  }

  const roleKey = resolveRoleKeyForUser(user);
  const roleModules = settings?.rolePermissions?.[roleKey];
  if (roleModules) {
    user.permissions = normalizePermissions(user.accessRole, {
      ...(user.permissions || {}),
      modules: {
        ...(user.permissions?.modules || {}),
        dashboard: roleModules.dashboard,
        candidates: roleModules.candidates,
        employees: roleModules.employees,
        attendance: roleModules.attendance,
        payroll: roleModules.payroll,
        letters: roleModules.letters,
        departments: roleModules.departments,
        reports: roleModules.reports,
        userManagement: roleModules.userManagement,
        settings: roleModules.settings,
        candidateManagement: roleModules.candidates,
        jobApplications: roleModules.candidates,
        interviews: roleModules.candidates,
        offerLetters: roleModules.letters,
        reportsAnalytics: roleModules.reports,
      },
    });
  }

  req.user = user;
  req.auth = payload;

  const isPendingEmployee = req.user?.role === "employee" && req.user?.status !== "active_employee";
  if (isPendingEmployee) {
    const allowedRoutes = [
      "/api/auth/me",
      "/api/auth/logout",
      "/api/joining-forms/me",
      "/api/joining-forms/me/submit",
    ];
    const isAllowed = allowedRoutes.some((route) => req.originalUrl.startsWith(route));
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: "Please complete your Joining Form to activate your account.",
        data: { status: req.user.status, joiningFormCompleted: Boolean(req.user.joiningFormCompleted) },
      });
    }
  }

  next();
});

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized", data: null });
  }
  if (!roles.includes(req.user.role)) {
    console.warn("[auth.authorize] Forbidden role", {
      method: req.method,
      path: req.originalUrl,
      requiredRoles: roles,
      userId: String(req.user._id || ""),
      userRole: req.user.role,
      userAccessRole: req.user.accessRole,
      tokenRole: req.auth?.role || null,
      tokenAccessRole: req.auth?.accessRole || null,
    });
    return res.status(403).json({ success: false, message: "Forbidden", data: null });
  }
  return next();
};

export const authorizeModule = (moduleKey) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized", data: null });
  }
  if (req.user.accessRole === "super_admin") return next();
  const modules = normalizePermissions(req.user.accessRole, req.user.permissions).modules;
  if (!modules) return next();
  if (modules[moduleKey] === false) {
    console.warn("[auth.authorizeModule] Forbidden module access", {
      method: req.method,
      path: req.originalUrl,
      moduleKey,
      userId: String(req.user._id || ""),
      userRole: req.user.role,
      userAccessRole: req.user.accessRole,
    });
    return res.status(403).json({ success: false, message: "Forbidden: module access denied", data: null });
  }
  return next();
};
