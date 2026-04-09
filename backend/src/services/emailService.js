import SibApiV3Sdk from "sib-api-v3-sdk";
import { env } from "../config/env.js";
import { buildOtpEmailLayout } from "../layouts/email/index.js";

let transactionalEmailApi = null;

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toEmailAddress = (value) => String(value || "").trim().toLowerCase();

const normalizeRecipients = (input) => {
  const recipients = Array.isArray(input) ? input : [input];

  return recipients
    .map((recipient) => {
      if (typeof recipient === "string") {
        const email = toEmailAddress(recipient);
        return email ? { email } : null;
      }

      const email = toEmailAddress(recipient?.email);
      if (!email) return null;

      return recipient?.name
        ? { email, name: String(recipient.name).trim() }
        : { email };
    })
    .filter(Boolean);
};

const normalizeAttachments = (attachments = []) =>
  (Array.isArray(attachments) ? attachments : [])
    .map((attachment) => {
      const name = String(attachment?.name || attachment?.filename || "").trim();
      const rawContent = attachment?.content;
      if (!name || !rawContent) return null;

      const content = Buffer.isBuffer(rawContent) ? rawContent.toString("base64") : String(rawContent);

      return {
        name,
        content,
      };
    })
    .filter(Boolean);

const resolveSender = (override = {}) => {
  const email = toEmailAddress(override?.email || env.brevo.senderEmail);
  const name = String(override?.name || env.brevo.senderName || "").trim();

  if (!env.brevo.apiKey) {
    const error = new Error("BREVO_API_KEY is missing.");
    error.code = "BREVO_API_KEY_MISSING";
    throw error;
  }

  if (!email) {
    const error = new Error("BREVO_SENDER_EMAIL is missing.");
    error.code = "BREVO_SENDER_EMAIL_MISSING";
    throw error;
  }

  return name ? { email, name } : { email };
};

const getBrevoClient = () => {
  if (transactionalEmailApi) {
    return transactionalEmailApi;
  }

  const client = SibApiV3Sdk.ApiClient.instance;
  client.authentications["api-key"].apiKey = env.brevo.apiKey;
  transactionalEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
  return transactionalEmailApi;
};

const extractBrevoError = (error) => {
  const body = error?.response?.body || error?.body || null;
  const status =
    error?.response?.statusCode ||
    error?.statusCode ||
    error?.status ||
    body?.code ||
    null;
  const message =
    body?.message ||
    error?.message ||
    "Unknown Brevo email error.";

  return {
    status,
    body,
    message,
    code: error?.code || "BREVO_EMAIL_SEND_FAILED",
  };
};

const isRetryableError = (details) => {
  const status = Number(details?.status || 0);
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
};

const normalizeSendArgs = (toOrPayload, subjectArg, htmlArg) => {
  if (typeof toOrPayload === "object" && toOrPayload !== null && !Array.isArray(toOrPayload)) {
    return {
      to: toOrPayload.to,
      subject: String(toOrPayload.subject || "").trim(),
      html: String(toOrPayload.html || toOrPayload.htmlContent || "").trim(),
      text: String(toOrPayload.text || "").trim(),
      attachments: normalizeAttachments(toOrPayload.attachments),
      sender: toOrPayload.sender || null,
      tags: Array.isArray(toOrPayload.tags) ? toOrPayload.tags.filter(Boolean) : [],
      replyTo: toOrPayload.replyTo || null,
      maxRetries: Number.isFinite(Number(toOrPayload.maxRetries)) ? Number(toOrPayload.maxRetries) : DEFAULT_MAX_RETRIES,
    };
  }

  return {
    to: toOrPayload,
    subject: String(subjectArg || "").trim(),
    html: String(htmlArg || "").trim(),
    text: "",
    attachments: [],
    sender: null,
    tags: [],
    replyTo: null,
    maxRetries: DEFAULT_MAX_RETRIES,
  };
};

export const sendEmail = async (toOrPayload, subjectArg = "", htmlArg = "") => {
  const payload = normalizeSendArgs(toOrPayload, subjectArg, htmlArg);
  const to = normalizeRecipients(payload.to);
  const sender = resolveSender(payload.sender);

  if (!to.length) {
    return {
      success: false,
      code: "BREVO_RECIPIENT_MISSING",
      error: "Recipient email is required.",
    };
  }

  if (!payload.subject) {
    return {
      success: false,
      code: "BREVO_SUBJECT_MISSING",
      error: "Email subject is required.",
    };
  }

  if (!payload.html && !payload.text) {
    return {
      success: false,
      code: "BREVO_CONTENT_MISSING",
      error: "Email html or text content is required.",
    };
  }

  const requestBody = {
    sender,
    to,
    subject: payload.subject,
    htmlContent: payload.html || undefined,
    textContent: payload.text || undefined,
    attachment: payload.attachments.length ? payload.attachments : undefined,
    tags: payload.tags.length ? payload.tags : undefined,
    replyTo: payload.replyTo?.email ? payload.replyTo : undefined,
  };

  const maxAttempts = Math.max(1, payload.maxRetries + 1);
  const api = getBrevoClient();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      console.log("[emailService] Sending email via Brevo", {
        to: to.map((item) => item.email),
        subject: payload.subject,
        attempt,
        maxAttempts,
      });

      const response = await api.sendTransacEmail(requestBody);

      console.log("[emailService] Email sent successfully", {
        to: to.map((item) => item.email),
        subject: payload.subject,
        attempt,
        messageId: response?.messageId || "",
      });

      return {
        success: true,
        provider: "brevo",
        messageId: response?.messageId || "",
      };
    } catch (error) {
      const details = extractBrevoError(error);
      const retryable = isRetryableError(details);

      console.error("[emailService] Brevo send failed", {
        to: to.map((item) => item.email),
        subject: payload.subject,
        attempt,
        maxAttempts,
        retryable,
        status: details.status,
        code: details.code,
        message: details.message,
        body: details.body,
      });

      if (!retryable || attempt >= maxAttempts) {
        return {
          success: false,
          provider: "brevo",
          code: details.code,
          statusCode: Number(details.status || 502),
          error: details.message,
          details,
        };
      }

      await sleep(DEFAULT_RETRY_DELAY_MS * attempt);
    }
  }

  return {
    success: false,
    provider: "brevo",
    code: "BREVO_EMAIL_SEND_FAILED",
    error: "Email sending failed after retries.",
  };
};

export const sendOtpEmail = async ({
  to,
  otp,
  expiresInMinutes = 5,
  subject,
  heading = "Login Verification Code",
  purpose = "verification code",
  maxRetries = DEFAULT_MAX_RETRIES,
}) => {
  const layout = buildOtpEmailLayout({
    otp,
    expiresInMinutes,
    heading,
    purpose,
  });

  return sendEmail({
    to,
    subject: subject || layout.subject,
    html: layout.html,
    text: layout.text,
    tags: ["otp"],
    maxRetries,
  });
};

export const sendEmailHtml = async (to, subject, htmlContent) => sendEmail(to, subject, htmlContent);

export const sendBrevoEmail = sendEmail;
export const sendBrevoOtpEmail = sendOtpEmail;
