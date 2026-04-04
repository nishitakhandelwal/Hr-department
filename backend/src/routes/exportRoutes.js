import { Router } from "express";
import { query } from "express-validator";
import { exportModuleData } from "../controllers/exportController.js";
import { authorizeModule, protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

router.get(
  "/",
  protect,
  authorizeModule("reports"),
  [
    query("module").isString().notEmpty().withMessage("module is required."),
    query("type").optional().isIn(["csv", "excel", "pdf"]).withMessage("type must be csv, excel, or pdf."),
    query("filters").optional().isString().withMessage("filters must be a JSON string."),
  ],
  validateRequest,
  asyncHandler(exportModuleData)
);

router.post("/", protect, authorizeModule("reports"), asyncHandler(exportModuleData));

export default router;
