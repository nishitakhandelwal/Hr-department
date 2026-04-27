import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import candidateRoutes from "./routes/candidateRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import payrollRoutes from "./routes/payrollRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import offboardingRoutes from "./routes/offboardingRoutes.js";
import letterRoutes from "./routes/letterRoutes.js";
import exportRoutes from "./routes/exportRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import configRoutes from "./routes/configRoutes.js";
import internshipRoutes from "./routes/internshipRoutes.js";
import joiningFormRoutes from "./routes/joiningFormRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import holidayRoutes from "./routes/holidayRoutes.js";
import calendarRoutes from "./routes/calendarRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import { uploadCandidateVideo as uploadCandidateVideoController } from "./controllers/candidateController.js";
import { asyncHandler } from "./middleware/asyncHandler.js";
import { authorize, protect } from "./middleware/authMiddleware.js";
import { sendEmail } from "./services/emailService.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { uploadCandidateVideo as uploadCandidateVideoFile } from "./middleware/uploadMiddleware.js";
import { uploadsDir } from "./utils/paths.js";

const app = express();

app.disable("x-powered-by");
app.set("etag", "strong");
app.set("trust proxy", 1);

const allowedOrigins = new Set([
  env.clientUrl,
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
]);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
if (env.nodeEnv !== "test") {
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
}

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

app.post(
  "/api/upload-video",
  protect,
  authorize("candidate"),
  uploadCandidateVideoFile,
  asyncHandler(uploadCandidateVideoController)
);

app.use(
  "/uploads",
  express.static(uploadsDir, {
    etag: true,
    immutable: true,
    maxAge: "30d",
  })
);

app.get("/test", (_req, res) => {
  res.send("Backend working");
});

app.get("/api/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    success: true,
    message: "API is healthy",
  });
});

if (env.nodeEnv !== "production") {
  app.get("/api/test-email", protect, authorize("admin"), async (req, res) => {
    const to = String(req.query.to || env.brevo.senderEmail || process.env.BREVO_SENDER_EMAIL || "").trim();
    if (!to) {
      return res.status(400).json({
        success: false,
        message: "Missing recipient email. Provide ?to=... or configure BREVO_SENDER_EMAIL.",
      });
    }

    const subject = "Arihant Dream Infra Project Ltd. - Test Email";
    const html = `
      <h2>Arihant Dream Infra Project Ltd. Email Test</h2>
      <p>This is a test email from <strong>/api/test-email</strong>.</p>
      <p>Sent at: ${new Date().toISOString()}</p>
    `;

    const result = await sendEmail(to, subject, html);
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Test email failed to send.",
        data: result,
      });
    }

    return res.json({
      success: true,
      message: `Test email sent successfully to ${to}.`,
      data: result,
    });
  });
}

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/candidate", candidateRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/offboarding", offboardingRoutes);
app.use("/api/letters", letterRoutes);
app.use("/api/exports", exportRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/config", configRoutes);
app.use("/api/internships", internshipRoutes);
app.use("/api/joining-forms", joiningFormRoutes);
app.use("/api", uploadRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
