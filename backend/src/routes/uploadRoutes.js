import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { protect } from "../middleware/authMiddleware.js";
import { upload, uploadProfileImageMemory } from "../middleware/upload.js";
import { uploadProfileImageViaSharedRoute } from "../controllers/authController.js";
import { uploadFile } from "../controllers/uploadController.js";

const router = Router();

router.post("/upload-profile", protect, uploadProfileImageMemory, asyncHandler(uploadProfileImageViaSharedRoute));
router.post("/upload", upload.single("file"), asyncHandler(uploadFile));

export default router;
