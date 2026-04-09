import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendUploadedFileByToken } from "../utils/uploadAccess.js";

const router = Router();

router.get("/access/:token", asyncHandler(sendUploadedFileByToken));

export default router;
