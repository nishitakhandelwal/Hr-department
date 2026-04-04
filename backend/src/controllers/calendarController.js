import { addDays, compareAsc, endOfMonth, format, isBefore, parseISO, startOfDay, startOfMonth } from "date-fns";

import { Event } from "../models/Event.js";
import { Employee } from "../models/Employee.js";
import { getHolidaysByCountryAndYear, getSupportedCountries } from "../services/calendarService.js";

const EVENT_TYPES = {
  HOLIDAY: "holiday",
  MEETING: "meeting",
  BIRTHDAY: "birthday",
  REMINDER: "reminder",
};

const EVENT_COLORS = {
  holiday: "#10B981",
  meeting: "#0EA5E9",
  birthday: "#A855F7",
  reminder: "#F59E0B",
};

const toDateKey = (value) => format(value instanceof Date ? value : parseISO(String(value)), "yyyy-MM-dd");
const toMonthKey = (value) => format(value, "yyyy-MM");

const normalizeEvent = (event) => ({
  ...event,
  date: toDateKey(event.date),
});

const sortEventsByDate = (events) =>
  [...events].sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)) || a.title.localeCompare(b.title));

const getBirthdayEventsForRange = async (startDate, endDate) => {
  const employees = await Employee.find({}, "name personalDetails");
  const events = [];

  for (const employee of employees) {
    if (!employee.personalDetails?.dateOfBirth) continue;

    const dob = new Date(employee.personalDetails.dateOfBirth);
    if (Number.isNaN(dob.getTime())) continue;

    for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year += 1) {
      const birthdayDate = startOfDay(new Date(year, dob.getMonth(), dob.getDate()));
      if (birthdayDate < startDate || birthdayDate >= endDate) continue;

      events.push(
        normalizeEvent({
          _id: `birthday-${employee._id}-${year}`,
          title: `${employee.name}'s Birthday`,
          date: birthdayDate,
          type: EVENT_TYPES.BIRTHDAY,
          description: `${employee.name}'s birthday`,
          color: EVENT_COLORS.birthday,
          source: "system",
        })
      );
    }
  }

  return sortEventsByDate(events);
};

const getHolidayEventsForMonth = (country, year, monthKey) =>
  sortEventsByDate(
    getHolidaysByCountryAndYear(country, year)
      .map((holiday) =>
        normalizeEvent({
          _id: `holiday-${holiday.date}`,
          title: holiday.name,
          date: holiday.date,
          type: EVENT_TYPES.HOLIDAY,
          description: holiday.description,
          color: EVENT_COLORS.holiday,
          source: "system",
        })
      )
      .filter((holiday) => holiday.date.startsWith(monthKey))
  );

const getHolidayEventForDate = (country, dateKey) => {
  const holidays = getHolidaysByCountryAndYear(country, dateKey.slice(0, 4));
  const holiday = holidays.find((item) => item.date === dateKey);

  if (!holiday) return null;

  return normalizeEvent({
    _id: `holiday-${holiday.date}`,
    title: holiday.name,
    date: holiday.date,
    type: EVENT_TYPES.HOLIDAY,
    description: holiday.description,
    color: EVENT_COLORS.holiday,
    source: "system",
  });
};

const getUpcomingHolidayEvents = (country, startDate, endDate) => {
  const events = [];

  for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year += 1) {
    const holidays = getHolidaysByCountryAndYear(country, year);
    for (const holiday of holidays) {
      const holidayDate = startOfDay(parseISO(holiday.date));
      if (holidayDate < startDate || holidayDate >= endDate) continue;

      events.push(
        normalizeEvent({
          _id: `holiday-${holiday.date}`,
          title: holiday.name,
          date: holidayDate,
          type: EVENT_TYPES.HOLIDAY,
          description: holiday.description,
          color: EVENT_COLORS.holiday,
          source: "system",
        })
      );
    }
  }

  return sortEventsByDate(events);
};

export const getCalendarEvents = async (req, res) => {
  try {
    const { month = new Date().getMonth() + 1, year = new Date().getFullYear(), country = "IN" } = req.query;

    const monthStart = startOfMonth(new Date(Number(year), Number(month) - 1, 1));
    const monthEndExclusive = addDays(endOfMonth(monthStart), 1);
    const monthKey = toMonthKey(monthStart);

    const holidayEvents = getHolidayEventsForMonth(country, String(year), monthKey);
    const birthdayEvents = await getBirthdayEventsForRange(monthStart, monthEndExclusive);

    const dbEvents = await Event.find(
      {
        date: {
          $gte: monthStart,
          $lt: monthEndExclusive,
        },
      },
      "title date type timeLabel details"
    );

    const manualEvents = dbEvents
      .map((event) =>
        normalizeEvent({
          _id: event._id,
          title: event.title,
          date: startOfDay(new Date(event.date)),
          type: event.type || EVENT_TYPES.MEETING,
          time: event.timeLabel,
          description: event.details,
          color: EVENT_COLORS[event.type || EVENT_TYPES.MEETING],
          source: "manual",
        })
      )
      .filter((event) => event.date.startsWith(monthKey));

    const allEvents = sortEventsByDate([...holidayEvents, ...birthdayEvents, ...manualEvents]);

    res.json({
      success: true,
      data: {
        month: Number(month),
        year: Number(year),
        country,
        events: allEvents,
        totalEvents: allEvents.length,
      },
    });
  } catch (error) {
    console.error("Error in getCalendarEvents:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getEventsByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const { country = "IN" } = req.query;

    const dateKey = toDateKey(date);
    const dayStart = startOfDay(parseISO(dateKey));
    const dayEndExclusive = addDays(dayStart, 1);

    const holidayEvent = getHolidayEventForDate(country, dateKey);
    const birthdayEvents = await getBirthdayEventsForRange(dayStart, dayEndExclusive);

    const dbEvents = await Event.find(
      {
        date: {
          $gte: dayStart,
          $lt: dayEndExclusive,
        },
      },
      "title date type timeLabel details"
    );

    const manualEvents = dbEvents.map((event) =>
      normalizeEvent({
        _id: event._id,
        title: event.title,
        date: startOfDay(new Date(event.date)),
        type: event.type || EVENT_TYPES.MEETING,
        time: event.timeLabel,
        description: event.details,
        color: EVENT_COLORS[event.type || EVENT_TYPES.MEETING],
        source: "manual",
      })
    );

    const allEvents = sortEventsByDate([
      ...(holidayEvent ? [holidayEvent] : []),
      ...birthdayEvents,
      ...manualEvents,
    ]).filter((event) => event.date === dateKey);

    res.json({
      success: true,
      data: {
        date: dateKey,
        events: allEvents,
        totalEvents: allEvents.length,
      },
    });
  } catch (error) {
    console.error("Error in getEventsByDate:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getUpcomingEvents = async (req, res) => {
  try {
    const { days = 14, country = "IN" } = req.query;
    const today = startOfDay(new Date());
    const endDateExclusive = addDays(today, Number(days));

    const holidayEvents = getUpcomingHolidayEvents(country, today, endDateExclusive);
    const birthdayEvents = await getBirthdayEventsForRange(today, endDateExclusive);

    const dbEvents = await Event.find(
      {
        date: {
          $gte: today,
          $lt: endDateExclusive,
        },
      },
      "title date type timeLabel details"
    );

    const manualEvents = dbEvents.map((event) =>
      normalizeEvent({
        _id: event._id,
        title: event.title,
        date: startOfDay(new Date(event.date)),
        type: event.type || EVENT_TYPES.MEETING,
        time: event.timeLabel,
        description: event.details,
        color: EVENT_COLORS[event.type || EVENT_TYPES.MEETING],
        source: "manual",
      })
    );

    const futureEvents = sortEventsByDate([...holidayEvents, ...birthdayEvents, ...manualEvents]).filter(
      (event) => !isBefore(parseISO(event.date), today)
    );

    const groupedByDate = futureEvents.reduce((acc, event) => {
      if (!acc[event.date]) {
        acc[event.date] = {
          date: event.date,
          isToday: event.date === toDateKey(today),
          isTomorrow: event.date === toDateKey(addDays(today, 1)),
          events: [],
          totalEvents: 0,
        };
      }

      acc[event.date].events.push(event);
      acc[event.date].totalEvents += 1;
      return acc;
    }, {});

    const upcomingDays = Object.values(groupedByDate).sort((a, b) => compareAsc(parseISO(a.date), parseISO(b.date)));

    res.json({
      success: true,
      data: {
        days: Number(days),
        country,
        totalEvents: futureEvents.length,
        upcomingDays,
        allEvents: futureEvents,
      },
    });
  } catch (error) {
    console.error("Error in getUpcomingEvents:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getHolidays = async (req, res) => {
  try {
    const { year = new Date().getFullYear(), country = "IN" } = req.query;
    const holidays = getHolidaysByCountryAndYear(country, String(year)).map((holiday) => ({
      date: holiday.date,
      name: holiday.name,
      description: holiday.description,
    }));

    res.json({
      success: true,
      data: {
        year: Number(year),
        country,
        totalHolidays: holidays.length,
        holidays,
      },
    });
  } catch (error) {
    console.error("Error in getHolidays:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const getSupportedCountriesList = async (_req, res) => {
  try {
    const countries = getSupportedCountries();

    res.json({
      success: true,
      data: {
        countries,
        total: countries.length,
      },
    });
  } catch (error) {
    console.error("Error in getSupportedCountriesList:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
