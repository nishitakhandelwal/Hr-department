import { UserActivity } from "../models/UserActivity.js";

const IMPORTANT_ACTIONS = new Set([
  "User Logged In",
  "User Logged Out",
  "Password Reset",
  "Created user",
  "Invited user",
  "Updated user",
  "Changed user role",
]);

const toString = (value) => String(value ?? "").trim();

export const recordUserActivity = async ({ user, action, details = "", ipAddress = "" }) => {
  if (!user?._id) return null;
  const normalizedAction = toString(action);
  if (!IMPORTANT_ACTIONS.has(normalizedAction)) return null;

  return UserActivity.create({
    userId: user._id,
    userName: toString(user.name),
    userEmail: toString(user.email),
    userRole: toString(user.accessRole || user.role),
    action: normalizedAction,
    details: toString(details),
    ipAddress: toString(ipAddress),
  });
};

export const deleteExpiredUserActivities = async () => {
  const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await UserActivity.deleteMany({ createdAt: { $lt: threshold } });
  return result.deletedCount || 0;
};
