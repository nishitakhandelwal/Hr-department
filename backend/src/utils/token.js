import crypto from "crypto";

export const hashSha256 = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");

export const generateSecureToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");
