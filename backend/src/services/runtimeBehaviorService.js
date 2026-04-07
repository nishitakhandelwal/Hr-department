import fs from "fs";
import { User } from "../models/User.js";
import { AuditLog } from "../models/AuditLog.js";
import { getSystemSettings, isAuditLoggingEnabled } from "./systemSettingsService.js";
import { createNotificationBatch } from "./notificationService.js";

const notificationFlagMap = {
  candidateApplicationAlerts: "candidateApplicationAlerts",
  interviewSchedulingAlerts: "interviewSchedulingAlerts",
  offerLetterNotifications: "offerLetterNotifications",
  systemAnnouncements: "systemAnnouncements",
};

export const validateUploadedFileAgainstSettings = async (file) => {
  if (!file) return { valid: true };
  const settings = await getSystemSettings({ lean: true });
  const allowed = settings.documents?.allowedFileTypes || [];
  const maxMb = Number(settings.documents?.maxUploadSizeMb || 10);
  const maxBytes = maxMb * 1024 * 1024;
  if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(file.mimetype)) {
    return { valid: false, message: "Uploaded file type is not allowed by current document settings." };
  }
  if (file.size > maxBytes) {
    return { valid: false, message: `File exceeds max allowed upload size of ${maxMb} MB.` };
  }
  return { valid: true };
};

export const removeUploadedFileIfExists = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best effort cleanup
  }
};

export const createSystemNotification = async ({ title, message, type, settingKey }) => {
  const settings = await getSystemSettings({ lean: true });
  if (settings.notifications?.[settingKey] === false) return null;
  const admins = await User.find({ role: "admin", isActive: true }).select("_id").lean();
  if (!admins.length) return [];
  return createNotificationBatch({
    userIds: admins.map((admin) => admin._id),
    title,
    message,
    type,
    dedupeScope: `system:${settingKey}`,
  });
};

export const maybeSendEmailBySettings = async (senderFn) => {
  const settings = await getSystemSettings({ lean: true });
  if (settings.notifications?.emailNotificationsEnabled === false) {
    return { success: false, skipped: true, message: "Email notifications are disabled in system settings." };
  }
  return senderFn();
};

export const createAuditLogIfEnabled = async (payload) => {
  const enabled = await isAuditLoggingEnabled();
  if (!enabled) return null;
  return AuditLog.create(payload);
};

export const assertNotificationSettingKey = (key) => {
  if (!notificationFlagMap[key]) {
    throw new Error("Invalid notification setting key.");
  }
  return notificationFlagMap[key];
};
