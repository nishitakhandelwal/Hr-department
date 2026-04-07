import { CronJob } from "cron";
import { Event } from "../models/Event.js";
import { Holiday } from "../models/Holiday.js";
import { User } from "../models/User.js";
import { sendEmail } from "./emailService.js";
import { format, addDays, startOfDay } from "date-fns";
import { buildMessageEmailLayout } from "../layouts/email/index.js";
import { createNotificationRecord } from "./notificationService.js";

let scheduledJob = null;

/**
 * Get events happening tomorrow
 */
async function getTomorrowEvents() {
  const tomorrow = addDays(startOfDay(new Date()), 1);
  const endOfTomorrow = addDays(tomorrow, 1);

  const events = await Event.find({
    date: {
      $gte: tomorrow,
      $lt: endOfTomorrow,
    },
  }).lean();

  return events;
}

/**
 * Get holidays happening tomorrow
 */
async function getTomorrowHolidays(country = "IN") {
  const tomorrow = addDays(startOfDay(new Date()), 1);
  const endOfTomorrow = addDays(tomorrow, 1);

  const holidays = await Holiday.find({
    country,
    date: {
      $gte: tomorrow,
      $lt: endOfTomorrow,
    },
  }).lean();

  return holidays;
}

/**
 * Get birthdays tomorrow
 */
async function getTomorrowBirthdays() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const events = await Event.find({
    type: "birthday",
    date: {
      $gte: startOfDay(tomorrow),
      $lt: addDays(tomorrow, 1),
    },
  })
    .populate("userId", "firstName lastName email")
    .lean();

  return events;
}

/**
 * Create in-app notification for a user
 */
async function createScheduledNotification(userId, title, message, type = "event", dedupeDate = new Date()) {
  try {
    return await createNotificationRecord({
      userId,
      title,
      message,
      type,
      dedupeScope: `scheduler:${type}`,
      dedupeDate,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

/**
 * Send email notification
 */
async function sendEmailNotification(userEmail, subject, message) {
  try {
    const notificationEmail = buildMessageEmailLayout({
      subject,
      title: subject,
      message,
      eyebrow: "Automated notification",
    });

    await sendEmail(userEmail, notificationEmail.subject, notificationEmail.html);
    return true;
  } catch (error) {
    console.error("Error sending email notification:", error);
    return false;
  }
}

/**
 * Process event notifications for tomorrow
 */
async function processEventNotifications() {
  try {
    console.log("[Notification Scheduler] Processing event notifications for tomorrow...");

    const tomorrow = addDays(startOfDay(new Date()), 1);
    const formattedDate = format(tomorrow, "MMMM d, yyyy");

    // Get all users
    const users = await User.find({}, "_id email firstName lastName role").lean();

    if (users.length === 0) {
      console.log("[Notification Scheduler] No users found");
      return;
    }

    // Get events and holidays for tomorrow
    const [tomorrowEvents, tomorrowHolidays] = await Promise.all([
      getTomorrowEvents(),
      getTomorrowHolidays(),
    ]);

    // Process events for each user
    for (const user of users) {
      const notifications = [];

      // Filter events visible to this user
      const visibleEvents = tomorrowEvents.filter(
        (event) => !event.userId || event.userId.toString() === user._id.toString()
      );

      // Add holiday notifications
      for (const holiday of tomorrowHolidays) {
        const title = "Holiday Tomorrow";
        const message = `Tomorrow is ${holiday.title} 🇮🇳`;

        notifications.push({
          userId: user._id,
          title,
          message,
          type: "holiday",
        });
      }

      // Add event notifications
      for (const event of visibleEvents) {
        let title = "Event Tomorrow";
        let message = "";

        if (event.type === "birthday") {
          title = "Birthday Tomorrow 🎂";
          message = `Don't forget! Tomorrow is ${event.title}'s birthday.`;
        } else if (event.type === "meeting") {
          title = "Meeting Tomorrow";
          message = `${event.title}${event.timeLabel ? " at " + event.timeLabel : ""}`;
        } else if (event.type === "reminder") {
          title = "Reminder Tomorrow";
          message = `Reminder: ${event.title}`;
        }

        notifications.push({
          userId: user._id,
          title,
          message,
          type: event.type,
        });
      }

      // Bulk create notifications
      if (notifications.length > 0) {
        for (const notification of notifications) {
          await createScheduledNotification(notification.userId, notification.title, notification.message, notification.type, tomorrow);
        }

        // Send email notification for holidays and important events
        const importance = notifications.some((n) => ["holiday", "meeting"].includes(n.type));
        if (importance && user.email) {
          const summary = notifications
            .map((n) => `• ${n.title}: ${n.message}`)
            .join("\n");

          await sendEmailNotification(
            user.email,
            "Tomorrow's Schedule - Arihant Dream Infra Project Ltd.",
            `<p>Here's what's coming up tomorrow:</p><pre>${summary}</pre>`
          );
        }
      }
    }

    console.log("[Notification Scheduler] Event notifications processed successfully");
  } catch (error) {
    console.error("[Notification Scheduler] Error processing event notifications:", error);
  }
}

/**
 * Start the notification scheduler
 * Runs daily at 8:00 AM
 */
export function startNotificationScheduler() {
  if (scheduledJob) {
    console.log("[Notification Scheduler] Already running");
    return;
  }

  try {
    // Schedule to run every day at 8:00 AM
    scheduledJob = new CronJob(
      "0 8 * * *",
      async () => {
        console.log("[Notification Scheduler] Running scheduled task at", new Date().toISOString());
        await processEventNotifications();
      },
      null,
      true,
      "UTC"
    );

    console.log("[Notification Scheduler] Started successfully (runs daily at 8:00 AM UTC)");

    // Run once on startup for testing (optional, can be removed)
    // Uncomment the line below to test notifications on server start
    // processEventNotifications();
  } catch (error) {
    console.error("[Notification Scheduler] Failed to start:", error);
  }
}

/**
 * Stop the notification scheduler
 */
export function stopNotificationScheduler() {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    console.log("[Notification Scheduler] Stopped");
  }
}

/**
 * Manually trigger notifications (for testing)
 */
export async function triggerManualNotifications() {
  try {
    console.log("[Notification Scheduler] Manual trigger initiated");
    await processEventNotifications();
    return { success: true, message: "Notifications triggered successfully" };
  } catch (error) {
    console.error("[Notification Scheduler] Manual trigger error:", error);
    return { success: false, message: error.message };
  }
}
