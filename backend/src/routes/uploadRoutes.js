import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { protect } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/upload.js";
import { uploadProfileImage as uploadProfileImageFile } from "../middleware/uploadMiddleware.js";
import { uploadProfileImageViaSharedRoute } from "../controllers/authController.js";
import { uploadFile } from "../controllers/uploadController.js";

const router = Router();

router.post("/upload-profile", protect, uploadProfileImageFile, asyncHandler(uploadProfileImageViaSharedRoute));
router.post("/upload", upload.single("file"), asyncHandler(uploadFile));

export default router;
