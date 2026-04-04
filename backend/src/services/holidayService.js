import axios from "axios";
import { Holiday } from "../models/Holiday.js";

const NAGER_DATE_API = "https://date.nager.at/api/v3";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const holidayService = {
  /**
   * Fetch holidays from Nager.Date API and cache them
   */
  async fetchAndCacheHolidays(country = "IN", year = null) {
    try {
      const targetYear = year || new Date().getFullYear();
      
      // Check if holidays are already cached for this year
      const existingHolidays = await Holiday.findOne({
        country,
        date: {
          $gte: new Date(targetYear, 0, 1),
          $lte: new Date(targetYear, 11, 31),
        },
        source: "api",
      });

      if (existingHolidays) {
        console.log(`Holidays for ${country} ${targetYear} already cached`);
        return await this.getHolidaysByCountryAndYear(country, targetYear);
      }

      // Fetch from Nager.Date API
      const response = await axios.get(
        `${NAGER_DATE_API}/PublicHolidays/${targetYear}/${country}`,
        { timeout: 10000 }
      );

      const holidays = response.data || [];
      
      // Delete old entries for this country/year to avoid duplicates
      await Holiday.deleteMany({
        country,
        date: {
          $gte: new Date(targetYear, 0, 1),
          $lte: new Date(targetYear, 11, 31),
        },
        source: "api",
      });

      // Insert new holidays
      const holidaysToInsert = holidays.map((holiday) => ({
        title: holiday.name,
        date: new Date(holiday.date),
        country,
        type: holiday.types?.includes("Public") ? "public" : "optional",
        source: "api",
        externalId: `${country}-${holiday.date}-${holiday.name}`,
      }));

      if (holidaysToInsert.length > 0) {
        await Holiday.insertMany(holidaysToInsert);
        console.log(`Cached ${holidaysToInsert.length} holidays for ${country} ${targetYear}`);
      }

      return holidaysToInsert;
    } catch (error) {
      console.error("Error fetching holidays from API:", error.message);
      // Return default holidays if API fails
      return await this.getDefaultHolidays(country, year);
    }
  },

  /**
   * Get default holidays for supported countries
   */
  getDefaultHolidaysData(country = "IN") {
    const defaultHolidays = {
      IN: [
        { month: 0, day: 26, title: "Republic Day" },
        { month: 2, day: 8, title: "Maha Shivaratri" },
        { month: 3, day: 11, title: "Eid ul-Fitr" },
        { month: 3, day: 14, title: "Dr. B.R. Ambedkar Jayanti" },
        { month: 3, day: 17, title: "Ram Navami" },
        { month: 3, day: 21, title: "Mahavir Jayanti" },
        { month: 4, day: 23, title: "Buddha Purnima" },
        { month: 6, day: 17, title: "Muharram" },
        { month: 7, day: 15, title: "Independence Day" },
        { month: 8, day: 7, title: "Janmashtami" },
        { month: 8, day: 16, title: "Milad un-Nabi" },
        { month: 9, day: 2, title: "Gandhi Jayanti" },
        { month: 9, day: 8, title: "Dussehra" },
        { month: 10, day: 1, title: "Diwali" },
        { month: 10, day: 2, title: "Govardhan Puja" },
        { month: 10, day: 3, title: "Bhai Dooj" },
        { month: 10, day: 15, title: "Prakash Parv" },
        { month: 11, day: 25, title: "Christmas" },
      ],
      US: [
        { month: 0, day: 1, title: "New Year's Day" },
        { month: 0, day: 20, title: "Martin Luther King Jr. Day" },
        { month: 1, day: 17, title: "Presidents' Day" },
        { month: 4, day: 27, title: "Memorial Day" },
        { month: 6, day: 4, title: "Independence Day" },
        { month: 8, day: 2, title: "Labor Day" },
        { month: 10, day: 11, title: "Veterans Day" },
        { month: 10, day: 28, title: "Thanksgiving" },
        { month: 11, day: 25, title: "Christmas" },
      ],
      UK: [
        { month: 0, day: 1, title: "New Year's Day" },
        { month: 3, day: 10, title: "Easter Monday" },
        { month: 4, day: 6, title: "Early May Bank Holiday" },
        { month: 5, day: 3, title: "Spring Bank Holiday" },
        { month: 7, day: 31, title: "Summer Bank Holiday" },
        { month: 11, day: 25, title: "Christmas" },
        { month: 11, day: 26, title: "Boxing Day" },
      ],
    };

    return defaultHolidays[country] || defaultHolidays.IN;
  },

  /**
   * Get default holidays and store them in DB if not present
   */
  async getDefaultHolidays(country = "IN", year = null) {
    const targetYear = year || new Date().getFullYear();
    const defaultData = this.getDefaultHolidaysData(country);

    // Check if default holidays are already cached
    const existing = await Holiday.countDocuments({
      country,
      date: {
        $gte: new Date(targetYear, 0, 1),
        $lte: new Date(targetYear, 11, 31),
      },
      source: "system",
    });

    if (existing > 0) {
      return await this.getHolidaysByCountryAndYear(country, targetYear);
    }

    // Insert default holidays
    const holidaysToInsert = defaultData.map((holiday) => ({
      title: holiday.title,
      date: new Date(targetYear, holiday.month, holiday.day),
      country,
      type: "public",
      source: "system",
    }));

    if (holidaysToInsert.length > 0) {
      await Holiday.insertMany(holidaysToInsert);
    }

    return holidaysToInsert;
  },

  /**
   * Get all holidays for a specific country and year
   */
  async getHolidaysByCountryAndYear(country = "IN", year = null) {
    const targetYear = year || new Date().getFullYear();

    const holidays = await Holiday.find({
      country,
      date: {
        $gte: new Date(targetYear, 0, 1),
        $lte: new Date(targetYear, 11, 31),
      },
    })
      .sort({ date: 1 })
      .lean();

    return holidays;
  },

  /**
   * Get all holidays for a specific period
   */
  async getHolidaysByDateRange(startDate, endDate, country = "IN") {
    return Holiday.find({
      country,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    })
      .sort({ date: 1 })
      .lean();
  },

  /**
   * Get holidays for next N days
   */
  async getUpcomingHolidays(days = 7, country = "IN") {
    const today = new Date();
    const future = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

    return Holiday.find({
      country,
      date: {
        $gte: today,
        $lte: future,
      },
    })
      .sort({ date: 1 })
      .lean();
  },

  /**
   * Add a custom holiday (admin only)
   */
  async addCustomHoliday(title, date, country = "IN") {
    const holiday = new Holiday({
      title,
      date: new Date(date),
      country,
      type: "public",
      source: "manual",
      isCustom: true,
    });

    await holiday.save();
    return holiday;
  },

  /**
   * Delete a custom holiday
   */
  async deleteCustomHoliday(holidayId) {
    return Holiday.findByIdAndDelete(holidayId);
  },

  /**
   * Check if a date is a holiday
   */
  async isHoliday(date, country = "IN") {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const holiday = await Holiday.findOne({
      country,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    return !!holiday;
  },
};

/**
 * Initialize default holidays for India, US, and UK for current and next year
 */
export const initializeDefaultHolidays = async () => {
  try {
    const currentYear = new Date().getFullYear();
    const countries = ["IN", "US", "UK"];
    
    for (const country of countries) {
      for (const year of [currentYear, currentYear + 1]) {
        await holidayService.getDefaultHolidays(country, year);
      }
    }
    
    console.log("[Holiday Service] Default holidays initialized successfully");
  } catch (error) {
    console.error("[Holiday Service] Error initializing default holidays:", error.message);
  }
};
