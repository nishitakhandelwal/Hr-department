import app from "./app.js";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { ensureAdmin } from "./utils/ensureAdmin.js";
import { cleanupAuditLogs, getSystemSettings } from "./services/systemSettingsService.js";
import { startNotificationScheduler } from "./services/notificationScheduler.js";
import { initializeDefaultHolidays } from "./services/holidayService.js";
import { initializeHolidayData } from "./services/calendarService.js";
import { runDataLifecycleMaintenance, startDataLifecycleScheduler } from "./services/dataLifecycleService.js";

const startHttpServer = () =>
  new Promise((resolve, reject) => {
    const server = app.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`Backend running on port ${env.port}`);
      resolve(server);
    });

    server.on("error", (err) => reject(err));
  });

const startServer = async () => {
  const dbConnected = await connectDB();

  if (dbConnected) {
    await ensureAdmin();
    await getSystemSettings({ force: true });
    await runDataLifecycleMaintenance();
    await initializeDefaultHolidays();
    initializeHolidayData();
    await cleanupAuditLogs();
    startNotificationScheduler();
    startDataLifecycleScheduler();
  } else {
    // eslint-disable-next-line no-console
    console.warn("Skipping admin seed and scheduler because database is not connected.");
  }

  try {
    await startHttpServer();
  } catch (err) {
    if (err?.code === "EADDRINUSE") {
      // eslint-disable-next-line no-console
      console.error(`Port ${env.port} is already in use by another process.`);
      // eslint-disable-next-line no-console
      console.error("Stop the other process on this port, then run `npm run dev` again.");
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
      }
      process.exit(0);
    }
    throw err;
  }
};

startServer().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});
