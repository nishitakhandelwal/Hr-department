import { holidayService } from "../services/holidayService.js";

export const getHolidays = async (req, res) => {
  try {
    const { country = "IN", year, month } = req.query;
    
    if (month && !year) {
      return res.status(400).json({
        success: false,
        message: "Year is required when month is specified",
        data: null,
      });
    }

    let holidays;

    if (month && year) {
      // Get holidays for specific month/year
      const startDate = new Date(year, parseInt(month) - 1, 1);
      const endDate = new Date(year, parseInt(month), 0);
      holidays = await holidayService.getHolidaysByDateRange(startDate, endDate, country);
    } else if (year) {
      // Get holidays for specific year
      holidays = await holidayService.getHolidaysByCountryAndYear(country, parseInt(year));
    } else {
      // Get holidays for current year
      holidays = await holidayService.getHolidaysByCountryAndYear(country);
    }

    return res.json({
      success: true,
      message: "Holidays fetched successfully",
      data: holidays,
    });
  } catch (error) {
    console.error("Error fetching holidays:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch holidays",
      data: null,
    });
  }
};

export const syncHolidays = async (req, res) => {
  try {
    const { country = "IN", year } = req.body;

    // Check admin role
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can sync holidays",
        data: null,
      });
    }

    const holidays = await holidayService.fetchAndCacheHolidays(
      country,
      year ? parseInt(year) : null
    );

    return res.json({
      success: true,
      message: `Successfully synced ${holidays.length} holidays`,
      data: holidays,
    });
  } catch (error) {
    console.error("Error syncing holidays:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync holidays",
      data: null,
    });
  }
};

export const addCustomHoliday = async (req, res) => {
  try {
    const { title, date, country = "IN" } = req.body;

    // Check admin role
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can add custom holidays",
        data: null,
      });
    }

    if (!title || !date) {
      return res.status(400).json({
        success: false,
        message: "Title and date are required",
        data: null,
      });
    }

    const holiday = await holidayService.addCustomHoliday(title, date, country);

    return res.status(201).json({
      success: true,
      message: "Custom holiday added successfully",
      data: holiday,
    });
  } catch (error) {
    console.error("Error adding custom holiday:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add custom holiday",
      data: null,
    });
  }
};

export const deleteCustomHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    // Check admin role
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can delete custom holidays",
        data: null,
      });
    }

    await holidayService.deleteCustomHoliday(id);

    return res.json({
      success: true,
      message: "Custom holiday deleted successfully",
      data: null,
    });
  } catch (error) {
    console.error("Error deleting custom holiday:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete custom holiday",
      data: null,
    });
  }
};

export const getUpcomingHolidays = async (req, res) => {
  try {
    const { days = 7, country = "IN" } = req.query;

    const holidays = await holidayService.getUpcomingHolidays(
      parseInt(days) || 7,
      country
    );

    return res.json({
      success: true,
      message: "Upcoming holidays fetched successfully",
      data: holidays,
    });
  } catch (error) {
    console.error("Error fetching upcoming holidays:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming holidays",
      data: null,
    });
  }
};
