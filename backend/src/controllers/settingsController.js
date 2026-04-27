import bcrypt from "bcryptjs";
import { Parser } from "json2csv";
import { User } from "../models/User.js";
import { AuditLog } from "../models/AuditLog.js";
import { getDefaultSystemSettings, getSystemSettings, refreshSystemSettingsCache, resetSystemSettingsToDefault, syncRolePermissionsToUsers, cleanupAuditLogs } from "../services/systemSettingsService.js";
import { deleteFileByPublicUrl } from "../utils/fileStorage.js";
import { buildUploadsPublicPath } from "../utils/uploadUrls.js";
import { setUserProfileImage } from "../services/profileImageService.js";

const parseMaybeJson = (value, fallback = {}) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
};

const pickObject = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const toPlain = (value) => (value && typeof value.toObject === "function" ? value.toObject() : value || {});

const mapLegacyCompany = (incoming) => ({
  companyName: incoming.companyName || "",
  companyLogoUrl: incoming.companyLogoUrl || "",
  address: incoming.address ?? incoming.companyAddress ?? "",
  contactEmail: incoming.contactEmail ?? incoming.companyEmail ?? "",
  contactPhone: incoming.contactPhone ?? incoming.contactNumber ?? "",
  website: incoming.website ?? incoming.websiteUrl ?? "",
  description: incoming.description ?? "",
});

const ALLOWED_DOCUMENT_STATUSES = new Set(["required", "optional", "disabled"]);
const DEFAULT_CANDIDATE_DOCUMENT_FIELDS = [
  { fieldId: "resume", label: "Resume", status: "required" },
  { fieldId: "pan-card", label: "PAN Card", status: "optional" },
  { fieldId: "aadhaar-card", label: "Aadhaar Card", status: "optional" },
  { fieldId: "passport-size-photo", label: "Passport Size Photo", status: "optional" },
  { fieldId: "certificates", label: "Certificates", status: "optional" },
];
const DEFAULT_CERTIFICATE_TYPES = [
  { typeId: "education", label: "Educational Certificate" },
  { typeId: "experience", label: "Experience Certificate" },
];

const normalizeCandidateDocumentFields = (value) => {
  const rawFields = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = rawFields
    .map((field, index) => {
      const fieldId = String(field?.fieldId || field?.id || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const label = String(field?.label || "").trim();
      const rawStatus = String(field?.status || "optional").trim().toLowerCase();
      const status = ALLOWED_DOCUMENT_STATUSES.has(rawStatus) ? rawStatus : "optional";
      return {
        fieldId: fieldId || `document-${index + 1}`,
        label: label || `Document ${index + 1}`,
        status,
      };
    })
    .filter((field) => {
      if (!field.fieldId || seen.has(field.fieldId)) return false;
      seen.add(field.fieldId);
      return true;
    });

  for (const defaultField of DEFAULT_CANDIDATE_DOCUMENT_FIELDS) {
    if (!normalized.find((field) => field.fieldId === defaultField.fieldId)) {
      if (defaultField.fieldId === "resume") normalized.unshift(defaultField);
      else normalized.push(defaultField);
    }
  }

  return normalized;
};

const normalizeCertificateTypes = (value) => {
  const rawTypes = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = rawTypes
    .map((entry, index) => {
      const typeId = String(entry?.typeId || entry?.id || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const label = String(entry?.label || "").trim();
      return {
        typeId: typeId || `certificate-type-${index + 1}`,
        label: label || `Certificate Type ${index + 1}`,
      };
    })
    .filter((entry) => {
      if (!entry.typeId || seen.has(entry.typeId)) return false;
      seen.add(entry.typeId);
      return true;
    });

  return normalized.length ? normalized : DEFAULT_CERTIFICATE_TYPES;
};

const validateSecurity = (security) => {
  const minLength = Number(security?.passwordPolicy?.minLength || 8);
  const sessionTimeoutMinutes = Number(security?.sessionTimeoutMinutes || 60);
  const maxLoginAttempts = Number(security?.maxLoginAttempts || 5);

  if (minLength < 6 || minLength > 64) {
    return "Password minimum length must be between 6 and 64.";
  }
  if (sessionTimeoutMinutes < 5 || sessionTimeoutMinutes > 1440) {
    return "Session timeout must be between 5 and 1440 minutes.";
  }
  if (maxLoginAttempts < 1 || maxLoginAttempts > 20) {
    return "Maximum login attempts must be between 1 and 20.";
  }
  return "";
};

const validateDocuments = (documents) => {
  if (!Array.isArray(documents?.allowedFileTypes) || documents.allowedFileTypes.length === 0) {
    return "At least one allowed file type is required.";
  }
  const maxUploadSizeMb = Number(documents.maxUploadSizeMb || 0);
  if (maxUploadSizeMb < 1 || maxUploadSizeMb > 100) {
    return "Max upload size must be between 1 and 100 MB.";
  }
  const candidateFields = normalizeCandidateDocumentFields(documents?.candidateFields || DEFAULT_CANDIDATE_DOCUMENT_FIELDS);
  if (!candidateFields.length) {
    return "At least one candidate document field is required.";
  }
  if (candidateFields.some((field) => !field.label || !field.fieldId)) {
    return "Each candidate document field must include an id and label.";
  }
  const certificateTypes = normalizeCertificateTypes(documents?.certificateTypes || DEFAULT_CERTIFICATE_TYPES);
  if (!certificateTypes.length) {
    return "At least one certificate type is required.";
  }
  if (certificateTypes.some((entry) => !entry.typeId || !entry.label)) {
    return "Each certificate type must include an id and label.";
  }
  return "";
};

const validatePayroll = (payroll) => {
  const fixedWorkingDays = Number(payroll?.fixedWorkingDays || 0);
  const standardDailyHours = Number(payroll?.standardDailyHours || 0);
  const overtimeMultiplier = Number(payroll?.overtimeMultiplier || 0);

  if (!["weekdays", "calendar", "fixed"].includes(String(payroll?.workingDaysMode || ""))) {
    return "Working days mode must be weekdays, calendar, or fixed.";
  }
  if (fixedWorkingDays < 1 || fixedWorkingDays > 31) {
    return "Fixed working days must be between 1 and 31.";
  }
  if (standardDailyHours < 1 || standardDailyHours > 24) {
    return "Standard daily hours must be between 1 and 24.";
  }
  if (overtimeMultiplier < 0 || overtimeMultiplier > 10) {
    return "Overtime multiplier must be between 0 and 10.";
  }
  return "";
};

const updateSection = async (sectionKey, patch) => {
  const settings = await getSystemSettings();
  settings[sectionKey] = { ...toPlain(settings[sectionKey]), ...patch };
  await settings.save();
  await refreshSystemSettingsCache();
  return settings;
};

export const getSettings = async (req, res) => {
  const settings = await getSystemSettings();
  const freshUser = await User.findById(req.user._id).select("name email phone profilePhotoUrl profileImage accessRole role twoFactorEnabled");
  return res.json({
    success: true,
    message: "Settings fetched",
    data: {
      settings,
      defaults: getDefaultSystemSettings(),
      profile: freshUser,
    },
  });
};

export const getPublicSettings = async (_req, res) => {
  const settings = await getSystemSettings({ lean: true });
  return res.json({
    success: true,
    message: "Public settings fetched",
    data: {
      company: settings.company,
      preferences: settings.preferences,
      security: {
        otpLoginEnabled: settings.security?.otpLoginEnabled !== false,
      },
      documents: {
        allowedFileTypes: settings.documents?.allowedFileTypes || [],
        maxUploadSizeMb: Number(settings.documents?.maxUploadSizeMb || 10),
        candidateFields: normalizeCandidateDocumentFields(settings.documents?.candidateFields || DEFAULT_CANDIDATE_DOCUMENT_FIELDS),
        certificateTypes: normalizeCertificateTypes(settings.documents?.certificateTypes || DEFAULT_CERTIFICATE_TYPES),
      },
    },
  });
};

export const updateSettings = async (req, res) => {
  const settings = await getSystemSettings();
  const previousCompanyLogoUrl = settings.company?.companyLogoUrl || "";
  const company = mapLegacyCompany(parseMaybeJson(req.body.company, req.body.company || {}));
  const rolePermissions = pickObject(parseMaybeJson(req.body.rolePermissions, req.body.rolePermissions || {}));
  const security = pickObject(parseMaybeJson(req.body.security, req.body.security || {}));
  const notifications = pickObject(parseMaybeJson(req.body.notifications, req.body.notifications || {}));
  const preferences = pickObject(parseMaybeJson(req.body.preferences, req.body.preferences || {}));
  const documents = pickObject(parseMaybeJson(req.body.documents, req.body.documents || {}));
  const audit = pickObject(parseMaybeJson(req.body.audit, req.body.audit || {}));
  const payroll = pickObject(parseMaybeJson(req.body.payroll, req.body.payroll || {}));

  if (Object.keys(security).length > 0) {
    const securityPatch = {
      ...toPlain(settings.security),
      ...security,
      passwordPolicy: {
        ...toPlain(settings.security.passwordPolicy),
        ...(security.passwordPolicy || {}),
      },
    };
    const errorMessage = validateSecurity(securityPatch);
    if (errorMessage) return res.status(422).json({ success: false, message: errorMessage });
    settings.security = securityPatch;
  }

  if (Object.keys(documents).length > 0) {
    const documentsPatch = {
      ...toPlain(settings.documents),
      ...documents,
      candidateFields: normalizeCandidateDocumentFields(documents.candidateFields ?? settings.documents?.candidateFields),
      certificateTypes: normalizeCertificateTypes(documents.certificateTypes ?? settings.documents?.certificateTypes),
    };
    const errorMessage = validateDocuments(documentsPatch);
    if (errorMessage) return res.status(422).json({ success: false, message: errorMessage });
    settings.documents = documentsPatch;
  }

  if (Object.keys(company).length > 0) {
    settings.company = { ...toPlain(settings.company), ...company };
  }
  if (Object.keys(rolePermissions).length > 0) {
    settings.rolePermissions = { ...toPlain(settings.rolePermissions), ...rolePermissions };
  }
  if (Object.keys(notifications).length > 0) {
    settings.notifications = { ...toPlain(settings.notifications), ...notifications };
  }
  if (Object.keys(preferences).length > 0) {
    settings.preferences = { ...toPlain(settings.preferences), ...preferences };
  }
  if (Object.keys(audit).length > 0) {
    settings.audit = { ...toPlain(settings.audit), ...audit };
  }
  if (Object.keys(payroll).length > 0) {
    const payrollPatch = {
      ...toPlain(settings.payroll),
      ...payroll,
      pf: {
        ...toPlain(settings.payroll?.pf),
        ...(payroll.pf || {}),
      },
      esi: {
        ...toPlain(settings.payroll?.esi),
        ...(payroll.esi || {}),
      },
    };
    const errorMessage = validatePayroll(payrollPatch);
    if (errorMessage) return res.status(422).json({ success: false, message: errorMessage });
    settings.payroll = payrollPatch;
  }

  if (req.file) {
    settings.company.companyLogoUrl = buildUploadsPublicPath("settings", req.file.filename);
  }

  await settings.save();
  if (req.file) {
    await deleteFileByPublicUrl(previousCompanyLogoUrl);
  }
  await syncRolePermissionsToUsers(settings.rolePermissions.toObject());
  await cleanupAuditLogs();
  await refreshSystemSettingsCache();

  return res.json({
    success: true,
    message: "Settings updated successfully",
    data: settings,
  });
};

export const updateCompanySettings = async (req, res) => {
  const settings = await getSystemSettings();
  const previousCompanyLogoUrl = settings.company?.companyLogoUrl || "";
  const incoming = mapLegacyCompany(parseMaybeJson(req.body.company, req.body));
  const patch = {
    ...toPlain(settings.company),
    ...incoming,
  };
  if (req.file) {
    patch.companyLogoUrl = buildUploadsPublicPath("settings", req.file.filename);
  }
  settings.company = patch;
  await settings.save();
  if (req.file) {
    await deleteFileByPublicUrl(previousCompanyLogoUrl);
  }
  await refreshSystemSettingsCache();
  return res.json({ success: true, message: "Company settings updated", data: settings.company });
};

export const updateRbacSettings = async (req, res) => {
  const rolePermissions = pickObject(parseMaybeJson(req.body.rolePermissions, req.body));
  const settings = await updateSection("rolePermissions", rolePermissions);
  await syncRolePermissionsToUsers(settings.rolePermissions.toObject());
  return res.json({ success: true, message: "RBAC settings updated", data: settings.rolePermissions });
};

export const updateSecuritySettings = async (req, res) => {
  const incoming = pickObject(parseMaybeJson(req.body.security, req.body));
  const settings = await getSystemSettings();
  const patch = {
    ...toPlain(settings.security),
    ...incoming,
    passwordPolicy: {
      ...toPlain(settings.security.passwordPolicy),
      ...(incoming.passwordPolicy || {}),
    },
  };
  const errorMessage = validateSecurity(patch);
  if (errorMessage) return res.status(422).json({ success: false, message: errorMessage });
  settings.security = patch;
  await settings.save();
  await refreshSystemSettingsCache();
  return res.json({ success: true, message: "Security settings updated", data: settings.security });
};

export const updateNotificationSettings = async (req, res) => {
  const incoming = pickObject(parseMaybeJson(req.body.notifications, req.body));
  const settings = await updateSection("notifications", incoming);
  return res.json({ success: true, message: "Notification settings updated", data: settings.notifications });
};

export const updatePreferenceSettings = async (req, res) => {
  const incoming = pickObject(parseMaybeJson(req.body.preferences, req.body));
  const settings = await updateSection("preferences", incoming);
  return res.json({ success: true, message: "System preferences updated", data: settings.preferences });
};

export const updateDocumentSettings = async (req, res) => {
  const incoming = pickObject(parseMaybeJson(req.body.documents, req.body));
  const settings = await getSystemSettings();
  const patch = {
    ...toPlain(settings.documents),
    ...incoming,
    candidateFields: normalizeCandidateDocumentFields(incoming.candidateFields ?? settings.documents?.candidateFields),
    certificateTypes: normalizeCertificateTypes(incoming.certificateTypes ?? settings.documents?.certificateTypes),
  };
  const errorMessage = validateDocuments(patch);
  if (errorMessage) return res.status(422).json({ success: false, message: errorMessage });
  settings.documents = patch;
  await settings.save();
  await refreshSystemSettingsCache();
  return res.json({ success: true, message: "Document settings updated", data: settings.documents });
};

export const updateAuditSettings = async (req, res) => {
  const incoming = pickObject(parseMaybeJson(req.body.audit, req.body));
  const settings = await updateSection("audit", incoming);
  await cleanupAuditLogs();
  return res.json({ success: true, message: "Audit settings updated", data: settings.audit });
};

export const resetDefaults = async (_req, res) => {
  const settings = await resetSystemSettingsToDefault();
  await syncRolePermissionsToUsers(settings.rolePermissions.toObject());
  return res.json({ success: true, message: "Settings reset to default values", data: settings });
};

export const exportAuditLogs = async (_req, res) => {
  const rows = await AuditLog.find().sort({ createdAt: -1 }).lean();
  const parser = new Parser({
    fields: ["createdAt", "actorName", "actorEmail", "action", "targetType", "targetId", "metadata"],
  });
  const csv = parser.parse(rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=audit-logs.csv");
  return res.send(csv);
};

export const updateProfile = async (req, res) => {
  const payload = {
    name: String(req.body.name || "").trim(),
    email: String(req.body.email || "").toLowerCase().trim(),
    phone: String(req.body.phone || "").trim(),
  };

  if (!payload.name || !payload.email) {
    return res.status(422).json({ success: false, message: "Name and email are required." });
  }

  const existing = await User.findOne({ email: payload.email, _id: { $ne: req.user._id } });
  if (existing) {
    return res.status(409).json({ success: false, message: "Email is already in use by another account." });
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  user.name = payload.name;
  user.email = payload.email;
  user.phone = payload.phone;

  if (req.file) {
    const updatedUser = await setUserProfileImage({
      userId: user._id,
      imageUrl: buildUploadsPublicPath("settings", req.file.filename),
    });
    user.profilePhotoUrl = updatedUser?.profilePhotoUrl || "";
    user.profileImage = updatedUser?.profileImage || "";
  }

  await user.save();
  return res.json({
    success: true,
    message: "Profile updated successfully",
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profilePhotoUrl: user.profilePhotoUrl,
      profileImage: user.profileImage,
      role: user.role,
      accessRole: user.accessRole,
      twoFactorEnabled: user.twoFactorEnabled,
    },
  });
};

export const changePassword = async (req, res) => {
  const { currentPassword = "", newPassword = "" } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ success: false, message: "User not found." });

  const isCurrentValid = await bcrypt.compare(String(currentPassword), user.password);
  if (!isCurrentValid) {
    return res.status(401).json({ success: false, message: "Current password is incorrect." });
  }

  const settings = await getSystemSettings({ lean: true });
  const policy = settings.security?.passwordPolicy || {};
  const minLength = Number(policy.minLength || 8);

  if (String(newPassword).length < minLength) {
    return res.status(422).json({ success: false, message: `Password must be at least ${minLength} characters.` });
  }
  if (policy.requireUppercase && !/[A-Z]/.test(String(newPassword))) {
    return res.status(422).json({ success: false, message: "Password must include at least one uppercase letter." });
  }
  if (policy.requireNumber && !/[0-9]/.test(String(newPassword))) {
    return res.status(422).json({ success: false, message: "Password must include at least one number." });
  }
  if (policy.requireSpecial && !/[^A-Za-z0-9]/.test(String(newPassword))) {
    return res.status(422).json({ success: false, message: "Password must include at least one special character." });
  }

  user.password = await bcrypt.hash(String(newPassword), 10);
  await user.save();
  return res.json({ success: true, message: "Password changed successfully." });
};
