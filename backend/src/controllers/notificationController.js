import { Notification } from "../models/Notification.js";

export const getNotifications = async (req, res) => {
  const data = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 });
  return res.json({ success: true, message: "Fetched notifications", data });
};

export const markNotificationRead = async (req, res) => {
  const row = await Notification.findOne({ _id: req.params.id, userId: req.user.id });
  if (!row) {
    return res.status(404).json({ success: false, message: "Notification not found" });
  }
  row.read = true;
  await row.save();

  return res.json({ success: true, message: "Notification marked as read", data: row });
};

export const markAllNotificationsRead = async (req, res) => {
  await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
  return res.json({ success: true, message: "All notifications marked as read", data: null });
};

export const deleteNotification = async (req, res) => {
  const row = await Notification.findOne({ _id: req.params.id, userId: req.user.id });
  if (!row) {
    return res.status(404).json({ success: false, message: "Notification not found" });
  }
  await row.deleteOne();

  return res.json({ success: true, message: "Notification deleted", data: row });
};
