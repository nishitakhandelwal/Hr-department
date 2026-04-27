import multer from "multer";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const uploadProfileImageMemory = upload.single("profileImage");
export const uploadProfilePhotoMemory = upload.single("profilePhoto");
export const uploadStage2ResumeMemory = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
}).single("resume");
export const uploadCandidatePortalDocumentsMemory = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
}).any();
