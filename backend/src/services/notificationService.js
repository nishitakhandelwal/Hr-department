import crypto from "crypto";
import { Notification } from "../models/Notification.js";

const toString = (value) => String(value ?? "").trim();

const buildNotificationDedupeKey = ({ userId, title, message, type, dedupeScope = "generic", dedupeDate = new Date() }) => {
  const dayKey = new Date(dedupeDate);
  dayKey.setHours(0, 0, 0, 0);
  const raw = [toString(userId), toString(type), toString(title), toString(message), toString(dedupeScope), dayKey.toISOString()].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
};

export const createNotificationRecord = async ({ userId, title, message, type = "general", dedupeScope = "", dedupeDate = new Date() }) => {
  if (!userId) return null;
  const payload = {
    userId,
    title: toString(title),
    message: toString(message),
    type: toString(type) || "general",
    read: false,
  };

  if (!dedupeScope) {
    return Notification.create(payload);
  }

  const dedupeKey = buildNotificationDedupeKey({ userId, title, message, type, dedupeScope, dedupeDate });
  try {
    return await Notification.findOneAndUpdate(
      { dedupeKey },
      { $setOnInsert: { ...payload, dedupeKey } },
      { upsert: true, new: true }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return Notification.findOne({ dedupeKey });
    }
    throw error;
  }
};

export const createNotificationBatch = async ({ userIds, title, message, type = "general", dedupeScope = "", dedupeDate = new Date() }) => {
  const uniqueUserIds = [...new Set((userIds || []).map((item) => toString(item)).filter(Boolean))];
  const created = [];
  for (const userId of uniqueUserIds) {
    const row = await createNotificationRecord({ userId, title, message, type, dedupeScope, dedupeDate });
    if (row) created.push(row);
  }
  return created;
};

export const deleteExpiredNotifications = async () => {
  const threshold = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  const result = await Notification.deleteMany({ createdAt: { $lt: threshold } });
  return result.deletedCount || 0;
};
