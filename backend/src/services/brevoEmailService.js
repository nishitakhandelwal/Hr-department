import SibApiV3Sdk from "sib-api-v3-sdk";
import { env } from "../config/env.js";

let transactionalEmailApi = null;

const getBrevoClient = () => {
  if (!env.brevo.apiKey) {
    const error = new Error("BREVO_API_KEY is missing.");
    error.code = "BREVO_API_KEY_MISSING";
    throw error;
  }

  if (!env.brevo.senderEmail) {
    const error = new Error("BREVO_SENDER_EMAIL is missing.");
    error.code = "BREVO_SENDER_EMAIL_MISSING";
    throw error;
  }

  if (transactionalEmailApi) {
    return transactionalEmailApi;
  }

  const client = SibApiV3Sdk.ApiClient.instance;
  client.authentications["api-key"].apiKey = env.brevo.apiKey;
  transactionalEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
  return transactionalEmailApi;
};

const extractBrevoErrorDetails = (error) => {
  const responseBody = error?.response?.body || error?.response?.text || error?.body || null;
  const responseStatus = error?.response?.statusCode || error?.statusCode || error?.status || null;
  const responseHeaders = error?.response?.headers || null;
  const apiMessage =
    responseBody?.message ||
    responseBody?.code ||
    error?.message ||
    "Unknown Brevo error";

  return {
    message: apiMessage,
    status: responseStatus,
    body: responseBody,
    headers: responseHeaders,
  };
};

export const sendBrevoEmail = async ({ to, subject, html, text = "", attachments = [] }) => {
  const api = getBrevoClient();

  const filteredAttachments = Array.isArray(attachments)
    ? attachments
        .filter((item) => item?.content && item?.name)
        .map((item) => ({
          name: item.name,
          content: item.content,
        }))
    : [];

  const payload = {
    sender: {
      name: env.brevo.senderName,
      email: env.brevo.senderEmail,
    },
    to: [{ email: String(to || "").trim() }],
    subject,
    htmlContent: html,
    textContent: text || undefined,
    ...(filteredAttachments.length > 0 ? { attachment: filteredAttachments } : {}),
  };

  try {
    const response = await api.sendTransacEmail(payload);

    console.log("[Brevo] Email sent successfully", {
      to,
      subject,
      sender: env.brevo.senderEmail,
      messageId: response?.messageId || "",
    });

    return {
      success: true,
      provider: "brevo",
      messageId: response?.messageId || "",
    };
  } catch (error) {
    const details = extractBrevoErrorDetails(error);
    console.error("[Brevo] Email send failed", {
      to,
      subject,
      sender: env.brevo.senderEmail,
      status: details.status,
      message: details.message,
      body: details.body,
      headers: details.headers,
      stack: error?.stack,
    });

    const sendError = new Error(`Failed to send email via Brevo: ${details.message}`);
    sendError.statusCode = 502;
    sendError.code = "BREVO_EMAIL_SEND_FAILED";
    sendError.details = details;
    throw sendError;
  }
};

export const sendBrevoOtpEmail = async ({
  to,
  otp,
  expiresInMinutes = 5,
  subject = "Your Login OTP",
  heading = "HR Harmony Hub Login Verification",
  purpose = "OTP",
}) => {
  try {
    return await sendBrevoEmail({
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2>${heading}</h2>
          <p>Your ${purpose} is:</p>
          <h1 style="letter-spacing: 6px;">${otp}</h1>
          <p>This OTP expires in ${expiresInMinutes} minutes.</p>
          <p>If you did not request this, ignore this email.</p>
        </div>
      `,
      text: `Your ${purpose} is ${otp}. It expires in ${expiresInMinutes} minutes.`,
    });
  } catch (error) {
    return {
      success: false,
      provider: "brevo",
      error: error instanceof Error ? error.message : "Failed to send OTP email via Brevo.",
      code: error?.code || "BREVO_OTP_SEND_FAILED",
    };
  }
};
