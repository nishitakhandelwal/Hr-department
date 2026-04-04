import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");
const projectRoot = path.resolve(backendRoot, "..");

const envFiles = [
  path.join(backendRoot, ".env"),
  path.join(projectRoot, ".env"),
];

for (const envPath of envFiles) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const requiredVars = ["JWT_SECRET"];

for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const nodeEnv = process.env.NODE_ENV || "development";
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/hr_harmony_hub";

export const env = {
  nodeEnv,
  port: Number(process.env.PORT || process.env.BACKEND_PORT || 5000),
  mongoUri,
  mongoFallbackUri: process.env.MONGODB_FALLBACK_URI || "mongodb://127.0.0.1:27017/hr_harmony_hub",
  allowStartWithoutDb:
    String(process.env.ALLOW_START_WITHOUT_DB || (nodeEnv !== "production" ? "true" : "false")) === "true",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || "1d",
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  clientUrl: process.env.CLIENT_URL || "http://localhost:8080",
  smtp: {
    host: process.env.SMTP_HOST || process.env.EMAIL_HOST,
    port: Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
    from: process.env.SMTP_FROM || process.env.EMAIL_FROM || "no-reply@hrharmonyhub.com",
  },
  brevo: {
    apiKey: process.env.BREVO_API_KEY || "",
    senderEmail:
      process.env.BREVO_SENDER_EMAIL ||
      process.env.SMTP_FROM ||
      process.env.EMAIL_FROM ||
      "no-reply@hrharmonyhub.com",
    senderName: process.env.BREVO_SENDER_NAME || "HR Harmony Hub",
  },
  otp: {
    ttlMinutes: Number(process.env.OTP_TTL_MINUTES || 5),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 3),
    resendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 30),
  },
  sms: {
    provider: String(process.env.SMS_PROVIDER || "").trim().toLowerCase(),
    mockMode: String(process.env.SMS_MOCK_MODE || (nodeEnv !== "production" ? "true" : "false")) === "true",
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER || "",
    msg91AuthKey: process.env.MSG91_AUTH_KEY || "",
    msg91TemplateId: process.env.MSG91_TEMPLATE_ID || "",
    msg91SenderId: process.env.MSG91_SENDER_ID || "",
    fast2SmsApiKey: process.env.FAST2SMS_API_KEY || "",
    fast2SmsRoute: process.env.FAST2SMS_ROUTE || "otp",
  },
};
