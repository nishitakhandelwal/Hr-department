import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { SystemSettings } from "../models/SystemSettings.js";
import { User } from "../models/User.js";
import { AuditLog } from "../models/AuditLog.js";
import { uploadsDir } from "../utils/paths.js";

const SETTINGS_KEY = "global";

const DEFAULT_ROLE_PERMISSIONS = {
  super_admin: {
    dashboard: true,
    candidates: true,
    employees: true,
    attendance: true,
    payroll: true,
    letters: true,
    departments: true,
    reports: true,
    userManagement: true,
    settings: true,
  },
  admin: {
    dashboard: true,
    candidates: true,
    employees: true,
    attendance: true,
    payroll: true,
    letters: true,
    departments: true,
    reports: true,
    userManagement: true,
    settings: true,
  },
  hr_manager: {
    dashboard: true,
    candidates: true,
    employees: true,
    attendance: true,
    payroll: false,
    letters: true,
    departments: false,
    reports: true,
    userManagement: false,
    settings: false,
  },
  recruiter: {
    dashboard: true,
    candidates: true,
    employees: false,
    attendance: false,
    payroll: false,
    letters: false,
    departments: false,
    reports: false,
    userManagement: false,
    settings: false,
  },
  employee: {
    dashboard: true,
    candidates: false,
    employees: false,
    attendance: true,
    payroll: true,
    letters: true,
    departments: false,
    reports: false,
    userManagement: false,
    settings: false,
  },
  candidate: {
    dashboard: true,
    candidates: false,
    employees: false,
    attendance: false,
    payroll: false,
    letters: false,
    departments: false,
    reports: false,
    userManagement: false,
    settings: false,
  },
};

const DEFAULT_SETTINGS = {
  key: SETTINGS_KEY,
  company: {
    companyName: "Arihant Dream Infra Project Ltd.",
    companyLogoUrl: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    description: "",
  },
  rolePermissions: DEFAULT_ROLE_PERMISSIONS,
  security: {
    otpLoginEnabled: true,
    twoFactorEnforced: false,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireNumber: true,
      requireSpecial: false,
    },
    sessionTimeoutMinutes: 60,
    maxLoginAttempts: 5,
  },
  notifications: {
    emailNotificationsEnabled: true,
    candidateApplicationAlerts: true,
    interviewSchedulingAlerts: true,
    offerLetterNotifications: true,
    systemAnnouncements: true,
  },
  preferences: {
    theme: "light",
    defaultDashboardPage: "/admin/dashboard",
    language: "en",
    timezone: "Asia/Kolkata",
    dateFormat: "DD/MM/YYYY",
    currencyFormat: "INR",
  },
  documents: {
    allowedFileTypes: ["application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    maxUploadSizeMb: 10,
    storageLocation: "uploads",
    namingFormat: "{timestamp}-{original}",
  },
  audit: {
    loggingEnabled: true,
    retentionDays: 180,
  },
  payroll: {
    workingDaysMode: "weekdays",
    fixedWorkingDays: 26,
    standardDailyHours: 8,
    includePaidLeaveInWages: true,
    latePenaltyAmount: 0,
    absentPenaltyAmount: 0,
    overtimeMultiplier: 1,
    pf: {
      enabled: true,
      employeeRate: 12,
      employerRate: 12,
      wageLimit: 15000,
    },
    esi: {
      enabled: false,
      employeeRate: 0.75,
      employerRate: 3.25,
      wageLimit: 21000,
    },
  },
};

let cache = null;
let cacheTs = 0;
const CACHE_TTL_MS = 30 * 1000;

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const oldCollectionName = "systemsettings";

const migrateLegacySettingsIfRequired = async () => {
  const db = mongoose.connection.db;
  if (!db) return;

  const currentCount = await db.collection("system_settings").countDocuments({ key: SETTINGS_KEY }, { limit: 1 });
  if (currentCount > 0) return;

  const legacy = await db.collection(oldCollectionName).findOne({});
  if (!legacy) return;

  const payload = {
    key: SETTINGS_KEY,
    company: {
      ...DEFAULT_SETTINGS.company,
      companyName: legacy.company?.companyName || DEFAULT_SETTINGS.company.companyName,
      companyLogoUrl: legacy.company?.companyLogoUrl || "",
      address: legacy.company?.companyAddress || "",
      contactEmail: legacy.company?.companyEmail || "",
      contactPhone: legacy.company?.contactNumber || "",
      website: legacy.company?.websiteUrl || "",
    },
    rolePermissions: {
      ...DEFAULT_ROLE_PERMISSIONS,
      ...(legacy.rolePermissions || {}),
    },
    security: {
      ...DEFAULT_SETTINGS.security,
      ...(legacy.security || {}),
      passwordPolicy: {
        ...DEFAULT_SETTINGS.security.passwordPolicy,
        ...(legacy.security?.passwordPolicy || {}),
      },
    },
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      emailNotificationsEnabled: legacy.notifications?.emailNotifications ?? true,
      candidateApplicationAlerts: legacy.notifications?.candidateApplicationAlerts ?? true,
      interviewSchedulingAlerts: legacy.notifications?.interviewAlerts ?? true,
      offerLetterNotifications: true,
      systemAnnouncements: legacy.notifications?.systemUpdates ?? true,
    },
    preferences: {
      ...DEFAULT_SETTINGS.preferences,
      ...(legacy.preferences || {}),
    },
    documents: { ...DEFAULT_SETTINGS.documents },
    audit: { ...DEFAULT_SETTINGS.audit },
    payroll: { ...DEFAULT_SETTINGS.payroll },
  };

  await db.collection("system_settings").insertOne(payload);
};

const createIfMissing = async () => {
  await migrateLegacySettingsIfRequired();
  let settings = await SystemSettings.findOne({ key: SETTINGS_KEY });
  if (!settings) {
    settings = await SystemSettings.create(DEFAULT_SETTINGS);
  }
  return settings;
};

export const getSystemSettings = async ({ force = false, lean = false } = {}) => {
  const now = Date.now();
  if (!force && cache && now - cacheTs < CACHE_TTL_MS && lean) {
    return deepClone(cache);
  }
  const settingsDoc = await createIfMissing();
  const payload = settingsDoc.toObject();
  cache = payload;
  cacheTs = now;
  if (lean) return deepClone(payload);
  return settingsDoc;
};

export const refreshSystemSettingsCache = async () => getSystemSettings({ force: true, lean: true });

export const getDefaultSystemSettings = () => deepClone(DEFAULT_SETTINGS);

export const resetSystemSettingsToDefault = async () => {
  const settings = await createIfMissing();
  settings.company = deepClone(DEFAULT_SETTINGS.company);
  settings.rolePermissions = deepClone(DEFAULT_SETTINGS.rolePermissions);
  settings.security = deepClone(DEFAULT_SETTINGS.security);
  settings.notifications = deepClone(DEFAULT_SETTINGS.notifications);
  settings.preferences = deepClone(DEFAULT_SETTINGS.preferences);
  settings.documents = deepClone(DEFAULT_SETTINGS.documents);
  settings.audit = deepClone(DEFAULT_SETTINGS.audit);
  settings.payroll = deepClone(DEFAULT_SETTINGS.payroll);
  await settings.save();
  await refreshSystemSettingsCache();
  return settings;
};

const mapRoleToAccessFilter = (roleKey) => {
  if (roleKey === "super_admin" || roleKey === "admin" || roleKey === "hr_manager" || roleKey === "recruiter" || roleKey === "candidate") {
    return { accessRole: roleKey };
  }
  if (roleKey === "employee") {
    return { role: "employee", accessRole: { $nin: ["hr_manager", "recruiter"] } };
  }
  return null;
};

const toModulePermissions = (modules) => ({
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
});

export const syncRolePermissionsToUsers = async (rolePermissions) => {
  const entries = Object.entries(rolePermissions || {});
  for (const [roleKey, modules] of entries) {
    const filter = mapRoleToAccessFilter(roleKey);
    if (!filter) continue;
    await User.updateMany(
      filter,
      {
        $set: {
          "permissions.modules": toModulePermissions(modules || {}),
        },
      }
    );
  }
};

export const buildUploadPath = (storageLocation = "uploads") => {
  const safeSegment = String(storageLocation || "uploads").replace(/[^a-zA-Z0-9/_-]/g, "");
  if (!safeSegment || safeSegment === "uploads") return uploadsDir;
  return path.join(uploadsDir, safeSegment.replace(/^\/+/, ""));
};

export const buildFileName = (namingFormat, originalName) => {
  const ext = path.extname(originalName || "");
  const base = path.basename(originalName || "file", ext).replace(/[^a-zA-Z0-9._-]/g, "_");
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const format = String(namingFormat || "{timestamp}-{original}");
  const generated = format
    .replaceAll("{timestamp}", String(stamp))
    .replaceAll("{original}", base)
    .replaceAll("{random}", random)
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  const finalName = generated || `${stamp}-${base}`;
  return `${finalName}${ext}`;
};

export const ensureStoragePath = (targetPath) => {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
};

export const cleanupAuditLogs = async () => {
  const settings = await getSystemSettings({ lean: true });
  if (!settings.audit?.retentionDays || settings.audit.retentionDays <= 0) return;
  const threshold = new Date(Date.now() - Number(settings.audit.retentionDays) * 24 * 60 * 60 * 1000);
  await AuditLog.deleteMany({ createdAt: { $lt: threshold } });
};

export const isAuditLoggingEnabled = async () => {
  const settings = await getSystemSettings({ lean: true });
  return settings.audit?.loggingEnabled !== false;
};

export const resolveRoleKeyForUser = (user) => {
  if (!user) return "candidate";
  if (user.accessRole && DEFAULT_ROLE_PERMISSIONS[user.accessRole]) return user.accessRole;
  if (user.role === "employee") return "employee";
  if (user.role === "candidate") return "candidate";
  return "admin";
};
