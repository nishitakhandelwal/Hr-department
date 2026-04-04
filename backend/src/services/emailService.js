import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let cachedTransporter = null;
let hasVerifiedTransporter = false;

const resolveSmtpConfig = () => {
  const host = env.smtp.host || process.env.EMAIL_HOST || "smtp.gmail.com";
  const port = Number(env.smtp.port || process.env.EMAIL_PORT || 587);
  const secure = port === 465;
  const user = env.smtp.user || process.env.EMAIL_USER;
  const pass = env.smtp.pass || process.env.EMAIL_PASS;
  const from = env.smtp.from || process.env.EMAIL_FROM || user;
  return { host, port, secure, user, pass, from };
};

const createTransporter = () => {
  if (cachedTransporter) return cachedTransporter;
  const smtp = resolveSmtpConfig();

  if (!smtp.user || !smtp.pass) {
    throw new Error("Email configuration is missing. Set EMAIL_USER and EMAIL_PASS environment variables.");
  }

  cachedTransporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    service: smtp.host === "smtp.gmail.com" ? "gmail" : undefined,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });
  console.log("[emailService] SMTP transporter initialized", {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    user: smtp.user,
  });
  return cachedTransporter;
};

const normalizeSendArgs = (toOrPayload, subjectArg, htmlContentArg) => {
  if (typeof toOrPayload === "object" && toOrPayload !== null) {
    return {
      to: toOrPayload.to,
      subject: toOrPayload.subject,
      html: toOrPayload.html || toOrPayload.htmlContent || "",
      text: toOrPayload.text || "",
      attachments: Array.isArray(toOrPayload.attachments) ? toOrPayload.attachments : [],
    };
  }
  return {
    to: toOrPayload,
    subject: subjectArg,
    html: htmlContentArg || "",
    text: "",
    attachments: [],
  };
};

export const sendEmail = async (toOrPayload, subjectArg = "", htmlContentArg = "") => {
  const payload = normalizeSendArgs(toOrPayload, subjectArg, htmlContentArg);
  const smtp = resolveSmtpConfig();

  try {
    const transporter = createTransporter();
    if (!hasVerifiedTransporter) {
      await transporter.verify();
      hasVerifiedTransporter = true;
      console.log("[emailService] SMTP connection verified successfully.");
    }

    const result = await transporter.sendMail({
      from: smtp.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text || undefined,
      attachments: payload.attachments.length > 0 ? payload.attachments : undefined,
    });

    console.log("[emailService] Email sent successfully", {
      to: payload.to,
      subject: payload.subject,
      messageId: result.messageId,
      response: result.response,
    });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("[emailService] sendEmail failed:", {
      to: payload.to,
      subject: payload.subject,
      code: error?.code,
      command: error?.command,
      response: error?.response,
      message: error?.message,
      stack: error?.stack,
    });
    return {
      success: false,
      error: error?.message || "Email sending failed.",
      code: error?.code || "EMAIL_SEND_FAILED",
    };
  }
};

export const sendEmailHtml = async (to, subject, htmlContent) => sendEmail(to, subject, htmlContent);
