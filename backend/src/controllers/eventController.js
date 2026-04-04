import mongoose from "mongoose";
import { Event } from "../models/Event.js";
import { Holiday } from "../models/Holiday.js";

const EVENT_TYPES = new Set(["holiday", "birthday", "meeting", "reminder"]);

const NATIONAL_HOLIDAYS = [
  { month: 0, day: 26, title: "Republic Day" },
  { month: 7, day: 15, title: "Independence Day" },
  { month: 9, day: 2, title: "Gandhi Jayanti" },
];

const toObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "_id" in value) return String(value._id || "");
  return String(value);
};

const normalizeEventDate = (value) => {
  const parsed = value instanceof Date ? new Date(value) : new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error("A valid event date is required.");
    error.statusCode = 400;
    throw error;
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12, 0, 0, 0));
};

const buildRange = (monthValue, yearValue) => {
  const now = new Date();
  const month = Number(monthValue || now.getUTCMonth() + 1);
  const year = Number(yearValue || now.getUTCFullYear());
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.getUTCMonth() + 1;
  const safeYear = Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : now.getUTCFullYear();

  return {
    month: safeMonth,
    year: safeYear,
    start: new Date(Date.UTC(safeYear, safeMonth - 1, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(safeYear, safeMonth, 0, 23, 59, 59, 999)),
    queryStart: new Date(Date.UTC(safeYear, safeMonth - 1, -7, 0, 0, 0, 0)),
    queryEnd: new Date(Date.UTC(safeYear, safeMonth, 7, 23, 59, 59, 999)),
  };
};

const serializeHoliday = (holiday, year) => {
  const date = new Date(Date.UTC(year, holiday.month, holiday.day, 12, 0, 0, 0));
  return {
    _id: `holiday-${year}-${holiday.month + 1}-${holiday.day}`,
    title: holiday.title,
    date,
    type: "holiday",
    userId: null,
    createdBy: null,
    timeLabel: "",
    details: "National holiday",
    source: "system",
    canEdit: false,
    canDelete: false,
  };
};

const toClientEvent = (event, req) => {
  const userId = toObjectIdString(event.userId);
  const isAdmin = req.user?.role === "admin";
  const isOwner = userId && userId === String(req.user?._id || req.user?.id || "");
  const canManage = isAdmin || (req.user?.role === "employee" && isOwner && event.type === "reminder");

  return {
    _id: String(event._id),
    title: event.title,
    date: event.date,
    type: event.type,
    userId: userId || null,
    createdBy: toObjectIdString(event.createdBy) || null,
    timeLabel: event.timeLabel || "",
    details: event.details || "",
    source: "manual",
    canEdit: canManage,
    canDelete: canManage,
  };
};

const ensureEventPermissions = (req, eventType) => {
  if (req.user?.role === "admin") {
    return;
  }

  if (req.user?.role !== "employee") {
    const error = new Error("Forbidden");
    error.statusCode = 403;
    throw error;
  }

  if (eventType !== "reminder") {
    const error = new Error("Employees can only create personal reminders.");
    error.statusCode = 403;
    throw error;
  }
};

export const getEvents = async (req, res) => {
  const { queryStart, queryEnd, year } = buildRange(req.query.month, req.query.year);
  const visibilityFilter =
    req.user?.role === "admin"
      ? {}
      : {
          $or: [{ userId: null }, { userId: req.user._id }],
        };

  const storedEvents = await Event.find({
    ...visibilityFilter,
    date: { $gte: queryStart, $lte: queryEnd },
  })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  // Fetch holidays from database
  const databaseHolidays = await Holiday.find({
    date: { $gte: queryStart, $lte: queryEnd },
  })
    .sort({ date: 1 })
    .lean();

  const convertedHolidays = databaseHolidays.map((holiday) => ({
    _id: String(holiday._id),
    title: holiday.name,
    date: holiday.date,
    type: "holiday",
    userId: null,
    createdBy: null,
    timeLabel: "",
    details: holiday.description || "Holiday",
    source: holiday.source || "system",
    canEdit: false,
    canDelete: false,
  }));

  const events = [
    ...convertedHolidays,
    ...storedEvents.map((event) => toClientEvent(event, req)),
  ];

  return res.json({
    success: true,
    message: "Fetched events successfully.",
    data: events,
  });
};

export const createEvent = async (req, res) => {
  const title = String(req.body.title || "").trim();
  const type = String(req.body.type || "").trim();

  if (!title) {
    return res.status(400).json({ success: false, message: "Event title is required.", data: null });
  }
  if (!EVENT_TYPES.has(type)) {
    return res.status(400).json({ success: false, message: "Invalid event type.", data: null });
  }

  ensureEventPermissions(req, type);

  const payload = {
    title,
    type,
    date: normalizeEventDate(req.body.date),
    timeLabel: String(req.body.timeLabel || "").trim(),
    details: String(req.body.details || "").trim(),
    createdBy: req.user?._id || null,
    userId: null,
  };

  if (req.user?.role === "admin" && mongoose.isValidObjectId(String(req.body.userId || ""))) {
    payload.userId = req.body.userId;
  }

  if (req.user?.role === "employee") {
    payload.userId = req.user._id;
  }

  const event = await Event.create(payload);
  return res.status(201).json({
    success: true,
    message: "Event created successfully.",
    data: toClientEvent(event.toObject(), req),
  });
};

export const updateEvent = async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    return res.status(404).json({ success: false, message: "Event not found.", data: null });
  }

  const isAdmin = req.user?.role === "admin";
  const isOwner = toObjectIdString(event.userId) === String(req.user?._id || req.user?.id || "");
  if (!isAdmin && !(req.user?.role === "employee" && isOwner && event.type === "reminder")) {
    return res.status(403).json({ success: false, message: "You cannot edit this event.", data: null });
  }

  const nextType = String(req.body.type || event.type).trim();
  if (!EVENT_TYPES.has(nextType)) {
    return res.status(400).json({ success: false, message: "Invalid event type.", data: null });
  }
  if (!isAdmin && nextType !== "reminder") {
    return res.status(403).json({ success: false, message: "Employees can only manage reminders.", data: null });
  }

  event.title = String(req.body.title || event.title).trim() || event.title;
  event.type = nextType;
  event.date = normalizeEventDate(req.body.date || event.date);
  event.timeLabel = String(req.body.timeLabel ?? event.timeLabel ?? "").trim();
  event.details = String(req.body.details ?? event.details ?? "").trim();
  event.userId = isAdmin && mongoose.isValidObjectId(String(req.body.userId || ""))
    ? req.body.userId
    : isAdmin && req.body.userId === null
    ? null
    : event.userId;

  await event.save();

  return res.json({
    success: true,
    message: "Event updated successfully.",
    data: toClientEvent(event.toObject(), req),
  });
};

export const deleteEvent = async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    return res.status(404).json({ success: false, message: "Event not found.", data: null });
  }

  const isAdmin = req.user?.role === "admin";
  const isOwner = toObjectIdString(event.userId) === String(req.user?._id || req.user?.id || "");
  if (!isAdmin && !(req.user?.role === "employee" && isOwner && event.type === "reminder")) {
    return res.status(403).json({ success: false, message: "You cannot delete this event.", data: null });
  }

  await event.deleteOne();
  return res.json({ success: true, message: "Event deleted successfully.", data: { _id: req.params.id } });
};
