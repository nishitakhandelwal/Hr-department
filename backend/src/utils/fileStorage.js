import fs from "fs";
import path from "path";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3, s3BucketName } from "../config/s3.js";
import { serverRoot } from "./paths.js";

const toLocalPathFromUrl = (fileUrl) => {
  if (!fileUrl) return "";

  try {
    const rawValue = String(fileUrl).trim();
    const url = rawValue.startsWith("/")
      ? new URL(`http://local${rawValue}`)
      : new URL(rawValue);
    const decodedPath = decodeURIComponent(url.pathname || "");
    if (!decodedPath.startsWith("/uploads/")) return "";
    const normalizedPath = path.normalize(decodedPath).replace(/^([/\\])+/, "");
    const absolutePath = path.resolve(serverRoot, normalizedPath);
    if (!absolutePath.startsWith(serverRoot)) return "";
    return absolutePath;
  } catch {
    return "";
  }
};

export const deleteFileByPublicUrl = async (fileUrl) => {
  const rawValue = String(fileUrl || "").trim();
  if (!rawValue) return;

  try {
    const parsed = new URL(rawValue);
    const isS3Url =
      parsed.hostname === `${s3BucketName}.s3.amazonaws.com` ||
      parsed.hostname === `${s3BucketName}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    if (isS3Url) {
      const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
      if (!key) return;
      await s3.send(
        new DeleteObjectCommand({
          Bucket: s3BucketName,
          Key: key,
        })
      );
      return;
    }
  } catch {
    // Fall back to local file deletion.
  }

  const filePath = toLocalPathFromUrl(fileUrl);
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // Ignore delete failures for non-existing files.
  }
};
