import path from "path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { s3, s3BucketName, s3Region, validateAwsConfig } from "../config/s3.js";

const getFileExtension = (filename = "") => path.extname(filename).toLowerCase();

const resolveContentType = (file = {}) => {
  const detectedMimeType = String(file.mimetype || "").trim().toLowerCase();
  if (detectedMimeType) return detectedMimeType;

  switch (getFileExtension(file.originalname)) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
};

const sanitizeBaseName = (filename = "") =>
  path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "file";

const buildObjectKey = (folder, originalName) => {
  const extension = getFileExtension(originalName);
  const safeBaseName = sanitizeBaseName(originalName);
  return `${folder}${uuidv4()}-${safeBaseName}${extension}`;
};

const encodeS3KeyForUrl = (key) => key.split("/").map((segment) => encodeURIComponent(segment)).join("/");

const buildPublicFileUrl = (key) =>
  `https://${s3BucketName}.s3.${s3Region}.amazonaws.com/${encodeS3KeyForUrl(key)}`;

export const uploadFileToS3 = async ({ file, folder }) => {
  validateAwsConfig();

  if (!file) {
    const error = new Error("No file provided for upload.");
    error.statusCode = 400;
    throw error;
  }

  if (!file.buffer || file.buffer.length === 0) {
    const error = new Error("Uploaded file buffer is empty.");
    error.statusCode = 400;
    throw error;
  }

  const key = buildObjectKey(folder, file.originalname);
  const contentType = resolveContentType(file);

  console.log("[S3 Upload Debug] object", {
    key,
    contentType,
    size: file.size || file.buffer.length,
    originalName: file.originalname,
  });

  const command = new PutObjectCommand({
    Bucket: s3BucketName,
    Key: key,
    Body: file.buffer,
    ContentType: contentType,
    ContentDisposition: contentType.startsWith("image/") ? "inline" : undefined,
  });

  await s3.send(command);

  return {
    key,
    url: buildPublicFileUrl(key),
    bucket: s3BucketName,
    region: s3Region,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
};
