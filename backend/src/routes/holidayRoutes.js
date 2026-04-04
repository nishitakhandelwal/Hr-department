import { Router } from "express";
import { body, query, param } from "express-validator";
import {
  getHolidays,
  syncHolidays,
  addCustomHoliday,
  deleteCustomHoliday,
  getUpcomingHolidays,
} from "../controllers/holidayController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

// Public endpoints - available to all authenticated users
router.get(
  "/",
  protect,
  [
    query("country").optional().isString().trim(),
    query("year").optional().isInt({ min: 2000, max: 2100 }),
    query("month").optional().isInt({ min: 1, max: 12 }),
  ],
  validateRequest,
  asyncHandler(getHolidays)
);

router.get(
  "/upcoming",
  protect,
  [
    query("days").optional().isInt({ min: 1, max: 365 }),
    query("country").optional().isString().trim(),
  ],
  validateRequest,
  asyncHandler(getUpcomingHolidays)
);

// Admin-only endpoints
router.post(
  "/sync",
  protect,
  authorize("admin"),
  [
    body("country").optional().isString().trim(),
    body("year").optional().isInt({ min: 2000, max: 2100 }),
  ],
  validateRequest,
  asyncHandler(syncHolidays)
);

router.post(
  "/custom",
  protect,
  authorize("admin"),
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("date").notEmpty().withMessage("Date is required"),
    body("country").optional().isString().trim(),
  ],
  validateRequest,
  asyncHandler(addCustomHoliday)
);

router.delete(
  "/custom/:id",
  protect,
  authorize("admin"),
  [param("id").isMongoId().withMessage("Invalid holiday id")],
  validateRequest,
  asyncHandler(deleteCustomHoliday)
);

export default router;
