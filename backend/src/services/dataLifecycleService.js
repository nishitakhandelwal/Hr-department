import { CronJob } from "cron";
import { Holiday } from "../models/Holiday.js";
import { deleteExpiredNotifications } from "./notificationService.js";
import { deleteExpiredUserActivities } from "./activityLogService.js";

let dataLifecycleJob = null;

const rankHoliday = (row) => {
  const sourceRank = row.source === "manual" ? 3 : row.source === "api" ? 2 : 1;
  const customRank = row.isCustom ? 1 : 0;
  return sourceRank * 1_000_000_000 + customRank * 100_000_000 + new Date(row.updatedAt || row.createdAt || 0).getTime();
};

export const normalizeHolidayDate = (value) => {
  const parsed = value instanceof Date ? new Date(value) : new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid holiday date");
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

export const cleanupDuplicateHolidayRecords = async () => {
  const rows = await Holiday.find().sort({ createdAt: 1 }).lean();
  const keepByDate = new Map();
  const removeIds = [];

  for (const row of rows) {
    const key = normalizeHolidayDate(row.date).toISOString();
    const current = keepByDate.get(key);
    if (!current) {
      keepByDate.set(key, row);
      continue;
    }
    if (rankHoliday(row) > rankHoliday(current)) {
      removeIds.push(current._id);
      keepByDate.set(key, row);
    } else {
      removeIds.push(row._id);
    }
  }

  if (!removeIds.length) return 0;
  const result = await Holiday.deleteMany({ _id: { $in: removeIds } });
  return result.deletedCount || 0;
};

export const ensureHolidayDateUniqueIndex = async () => {
  const indexes = await Holiday.collection.indexes();
  const nonUniqueDateIndex = indexes.find((index) => index.name === "date_1" && !index.unique);
  if (nonUniqueDateIndex) {
    await Holiday.collection.dropIndex(nonUniqueDateIndex.name);
  }
  await Holiday.collection.createIndex({ date: 1 }, { unique: true, name: "holiday_date_unique" });
};

export const runDataLifecycleMaintenance = async () => {
  const [expiredActivities, expiredNotifications, duplicateHolidays] = await Promise.all([
    deleteExpiredUserActivities(),
    deleteExpiredNotifications(),
    cleanupDuplicateHolidayRecords(),
  ]);

  await ensureHolidayDateUniqueIndex();

  return {
    expiredActivities,
    expiredNotifications,
    duplicateHolidays,
  };
};

export const startDataLifecycleScheduler = () => {
  if (dataLifecycleJob) return;
  dataLifecycleJob = new CronJob(
    "0 2 * * *",
    async () => {
      try {
        const result = await runDataLifecycleMaintenance();
        console.log("[Data Lifecycle] Daily cleanup completed", result);
      } catch (error) {
        console.error("[Data Lifecycle] Daily cleanup failed:", error instanceof Error ? error.message : error);
      }
    },
    null,
    true,
    "UTC"
  );
  console.log("[Data Lifecycle] Scheduler started (runs daily at 02:00 UTC)");
};
