import express from "express";
import {
  getCalendarEvents,
  getEventsByDate,
  getUpcomingEvents,
  getHolidays,
  getSupportedCountriesList,
} from "../controllers/calendarController.js";

const router = express.Router();

// Public routes
router.get("/events", getCalendarEvents);
router.get("/events-by-date/:date", getEventsByDate);
router.get("/upcoming", getUpcomingEvents);
router.get("/holidays", getHolidays);
router.get("/supported-countries", getSupportedCountriesList);

export default router;
