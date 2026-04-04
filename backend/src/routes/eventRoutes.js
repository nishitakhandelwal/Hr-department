import { Router } from "express";
import { body, param, query } from "express-validator";
import { createEvent, deleteEvent, getEvents, updateEvent } from "../controllers/eventController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

router.use(protect, authorize("admin", "employee"));

router.get(
  "/",
  [
    query("month").optional().isInt({ min: 1, max: 12 }).withMessage("Month must be between 1 and 12."),
    query("year").optional().isInt({ min: 2000, max: 2100 }).withMessage("Year must be valid."),
  ],
  validateRequest,
  asyncHandler(getEvents)
);

router.post(
  "/",
  [
    body("title").trim().notEmpty().withMessage("Title is required."),
    body("date").notEmpty().withMessage("Date is required."),
    body("type").trim().isIn(["holiday", "birthday", "meeting", "reminder"]).withMessage("Invalid event type."),
    body("timeLabel").optional().isString(),
    body("details").optional().isString(),
  ],
  validateRequest,
  asyncHandler(createEvent)
);

router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid event id."),
    body("title").optional().isString(),
    body("date").optional().isString(),
    body("type").optional().isIn(["holiday", "birthday", "meeting", "reminder"]).withMessage("Invalid event type."),
    body("timeLabel").optional().isString(),
    body("details").optional().isString(),
  ],
  validateRequest,
  asyncHandler(updateEvent)
);

router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid event id.")],
  validateRequest,
  asyncHandler(deleteEvent)
);

export default router;
