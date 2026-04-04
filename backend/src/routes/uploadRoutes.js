import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadProfileImage as uploadProfileImageFile } from "../middleware/uploadMiddleware.js";
import { uploadProfileImageViaSharedRoute } from "../controllers/authController.js";

const router = Router();

router.post("/upload-profile", protect, uploadProfileImageFile, asyncHandler(uploadProfileImageViaSharedRoute));

export default router;
