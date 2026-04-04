import fs from "fs";
import path from "path";
import { serverRoot } from "./paths.js";

const toLocalPathFromUrl = (fileUrl) => {
  if (!fileUrl) return "";

  try {
    const rawValue = String(fileUrl).trim();
    const url = rawValue.startsWith("/")
      ? new URL(`http://local${rawValue}`)
      : new URL(rawValue);
    const decodedPath = decodeURIComponent(url.pathname || "");
    const normalizedPath = path.normalize(decodedPath).replace(/^([/\\])+/, "");
    const absolutePath = path.resolve(serverRoot, normalizedPath);
    if (!absolutePath.startsWith(serverRoot)) return "";
    return absolutePath;
  } catch {
    return "";
  }
};

export const deleteFileByPublicUrl = async (fileUrl) => {
  const filePath = toLocalPathFromUrl(fileUrl);
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // Ignore delete failures for non-existing files.
  }
};
