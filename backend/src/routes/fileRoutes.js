import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { protect } from "../middleware/authMiddleware.js";
import { sendUploadedFileByToken } from "../utils/uploadAccess.js";

const router = Router();

router.get("/access/:token", protect, asyncHandler(sendUploadedFileByToken));

export default router;
