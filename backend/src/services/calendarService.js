import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const holidaysPath = join(__dirname, "../data/holidays.json");

let holidayData = {};

export const initializeHolidayData = () => {
  try {
    const data = fs.readFileSync(holidaysPath, "utf-8");
    holidayData = JSON.parse(data);
    
    const totalHolidays = Object.values(holidayData).reduce((sum, country) => {
      return sum + Object.values(country).reduce((yearSum, year) => yearSum + Object.keys(year).length, 0);
    }, 0);
    
    console.log(`✓ Loaded ${totalHolidays} holidays for ${Object.keys(holidayData).join(", ")}`);
  } catch (error) {
    console.error("Failed to load holidays.json:", error);
  }
};

export const getHolidaysByCountryAndYear = (country, year) => {
  if (!holidayData[country] || !holidayData[country][year]) {
    return [];
  }
  
  return Object.entries(holidayData[country][year]).map(([date, data]) => ({
    date,
    ...data,
  }));
};

export const getHolidaysByDateRange = (startDate, endDate, country) => {
  const holidays = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
    const yearHolidays = getHolidaysByCountryAndYear(country, year);
    for (const holiday of yearHolidays) {
      const holidayDate = new Date(holiday.date);
      if (holidayDate >= start && holidayDate <= end) {
        holidays.push(holiday);
      }
    }
  }
  
  return holidays.sort((a, b) => new Date(a.date) - new Date(b.date));
};

export const getUpcomingHolidays = (days, country) => {
  const today = new Date();
  const endDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  return getHolidaysByDateRange(today, endDate, country);
};

export const isHoliday = (date, country) => {
  const dateString = date instanceof Date ? date.toISOString().split("T")[0] : date;
  const year = dateString.split("-")[0];
  const holidays = getHolidaysByCountryAndYear(country, year);
  return holidays.some((h) => h.date === dateString);
};

export const getSupportedCountries = () => {
  return Object.keys(holidayData);
};
