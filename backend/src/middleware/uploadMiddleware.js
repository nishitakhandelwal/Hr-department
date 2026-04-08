import fs from "fs";
import path from "path";
import multer from "multer";
import { uploadsDir } from "../utils/paths.js";
import { buildFileName, buildUploadPath, ensureStoragePath, getSystemSettings } from "../services/systemSettingsService.js";

ensureStoragePath(uploadsDir);

const createStorage = (subDir = "", useDynamicDocumentPath = false) =>
  multer.diskStorage({
    destination: async (_req, _file, cb) => {
      let targetDir = subDir ? path.join(uploadsDir, subDir) : uploadsDir;
      if (useDynamicDocumentPath) {
        const settings = await getSystemSettings({ lean: true });
        targetDir = buildUploadPath(settings.documents?.storageLocation || "uploads");
      }
      ensureStoragePath(targetDir);
      cb(null, targetDir);
    },
    filename: async (_req, file, cb) => {
      const settings = await getSystemSettings({ lean: true });
      cb(null, buildFileName(settings.documents?.namingFormat, file.originalname));
    },
  });

const createTimestampedStorage = (subDir = "") =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      const targetDir = subDir ? path.join(uploadsDir, subDir) : uploadsDir;
      ensureStoragePath(targetDir);
      cb(null, targetDir);
    },
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname || "").toLowerCase() || ".png";
      const safeExtension = [".jpg", ".jpeg", ".png", ".webp"].includes(extension) ? extension : ".png";
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`);
    },
  });

const storage = createStorage("", true);

const isMimeAllowed = async (mimetype, fallbackMimeTypes) => {
  const settings = await getSystemSettings({ lean: true });
  const allowedMimeTypes = settings.documents?.allowedFileTypes || fallbackMimeTypes;
  return Array.isArray(allowedMimeTypes) && allowedMimeTypes.includes(mimetype);
};

const fileFilter = async (_req, file, cb) => {
  const isAllowed = await isMimeAllowed(file.mimetype, ["application/pdf", "image/jpeg", "image/png"]);
  if (!isAllowed) {
    const error = new Error("File type is not allowed by system document settings.");
    error.statusCode = 400;
    return cb(error, false);
  }
  cb(null, true);
};

const resumeFileFilter = async (_req, file, cb) => {
  const isAllowed = await isMimeAllowed(file.mimetype, [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
  if (!isAllowed) {
    const error = new Error("File type is not allowed by system document settings.");
    error.statusCode = 400;
    return cb(error, false);
  }
  cb(null, true);
};

const imageFileFilter = (_req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png"];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = new Error("Only JPG and PNG images are allowed.");
    error.statusCode = 400;
    return cb(error, false);
  }
  cb(null, true);
};

const videoFileFilter = (_req, file, cb) => {
  const allowedMimeTypes = ["video/mp4", "video/webm", "video/quicktime"];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = new Error("Only MP4, WEBM, and MOV videos are allowed.");
    error.statusCode = 400;
    return cb(error, false);
  }
  cb(null, true);
};

export const uploadResume = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
});

export const uploadStage2Resume = multer({
  storage,
  fileFilter: resumeFileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
}).single("resume");

export const uploadCandidatePortalDocuments = multer({
  storage,
  fileFilter: resumeFileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
}).any();

export const uploadCandidateVideo = multer({
  storage: createStorage("candidate-videos"),
  fileFilter: videoFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
}).single("video");

export const uploadCandidateDocuments = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
}).fields([
  { name: "resume", maxCount: 1 },
  { name: "offerLetter", maxCount: 1 },
  { name: "aadhaarPan", maxCount: 1 },
  { name: "educationalCertificates", maxCount: 1 },
  { name: "bankDocuments", maxCount: 1 },
  { name: "relievingLetter", maxCount: 1 },
]);

export const uploadProfilePhoto = multer({
  storage: createStorage("settings"),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
}).single("profilePhoto");

export const uploadProfileImage = multer({
  storage: createTimestampedStorage("profile"),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
}).single("profileImage");

export const uploadEmployeePhoto = multer({
  storage: createTimestampedStorage("profile"),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
}).single("photo");

export const uploadCompanyLogo = multer({
  storage: createStorage("settings"),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
}).single("companyLogo");

export const uploadJoiningFormDocuments = multer({
  storage,
  fileFilter: resumeFileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
}).fields([
  { name: "resume", maxCount: 1 },
  { name: "photograph", maxCount: 1 },
  { name: "certificates", maxCount: 1 },
  { name: "idProof", maxCount: 1 },
]);
