import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { uploadsDir } from "./paths.js";

const PUBLIC_UPLOAD_FOLDERS = new Set(["profile", "settings"]);
const ACCESS_TOKEN_PURPOSE = "upload_access";

const normalizeUploadPath = (value) => String(value || "").replace(/\\/g, "/").trim();

export const getUploadRelativePath = (value) => {
  const raw = normalizeUploadPath(value);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    return getUploadRelativePath(parsed.pathname);
  } catch {
    // Treat value as a path-like string when it is not an absolute URL.
  }

  const uploadsIndex = raw.indexOf("/uploads/");
  if (uploadsIndex >= 0) {
    return decodeURIComponent(raw.slice(uploadsIndex + "/uploads/".length));
  }

  if (raw.startsWith("uploads/")) {
    return decodeURIComponent(raw.slice("uploads/".length));
  }

  return "";
};

export const isPublicUploadPath = (relativePath) => {
  const normalized = normalizeUploadPath(relativePath);
  if (!normalized) return false;
  const firstSegment = normalized.split("/")[0];
  return PUBLIC_UPLOAD_FOLDERS.has(firstSegment);
};

export const buildSignedUploadAccessUrl = (req, value, user) => {
  const relativePath = getUploadRelativePath(value);
  if (!relativePath) return value;
  if (isPublicUploadPath(relativePath)) return `/uploads/${relativePath}`;
  if (!req || !user?._id) return "";

  const token = jwt.sign(
    {
      purpose: ACCESS_TOKEN_PURPOSE,
      path: relativePath,
      userId: String(user._id),
    },
    env.jwtSecret,
    { expiresIn: "15m" },
  );

  return `${req.protocol}://${req.get("host")}/api/files/access/${token}`;
};

export const secureUploadUrls = (value, req, user) => {
  if (Array.isArray(value)) {
    return value.map((item) => secureUploadUrls(item, req, user));
  }

  if (value && typeof value === "object") {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value.toObject === "function") {
      return secureUploadUrls(value.toObject(), req, user);
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, secureUploadUrls(entry, req, user)]),
    );
  }

  if (typeof value === "string") {
    const relativePath = getUploadRelativePath(value);
    if (!relativePath) return value;
    return buildSignedUploadAccessUrl(req, value, user);
  }

  return value;
};

export const resolveSignedUploadToken = (token) => {
  const payload = jwt.verify(String(token || ""), env.jwtSecret);
  if (!payload || payload.purpose !== ACCESS_TOKEN_PURPOSE || !payload.path) {
    const error = new Error("Invalid file access token.");
    error.statusCode = 403;
    throw error;
  }
  return payload;
};

export const resolveUploadAbsolutePath = (relativePath) => {
  const normalized = normalizeUploadPath(relativePath)
    .split("/")
    .filter(Boolean)
    .join(path.sep);

  const absolutePath = path.resolve(uploadsDir, normalized);
  const uploadsRoot = `${path.resolve(uploadsDir)}${path.sep}`;
  if (!absolutePath.startsWith(uploadsRoot) && absolutePath !== path.resolve(uploadsDir)) {
    const error = new Error("Invalid file path.");
    error.statusCode = 400;
    throw error;
  }

  return absolutePath;
};

export const sendUploadedFileByToken = async (req, res) => {
  const payload = resolveSignedUploadToken(req.params.token);
  const absolutePath = resolveUploadAbsolutePath(payload.path);

  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ success: false, message: "File not found." });
  }

  return res.sendFile(absolutePath);
};
