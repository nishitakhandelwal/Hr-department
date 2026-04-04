import { Router } from "express";
import { body, param } from "express-validator";
import {
  createAttendance,
  deleteAttendance,
  getAttendance,
  getAttendanceCorrectionRequests,
  requestAttendanceCorrection,
  reviewAttendanceCorrection,
  updateAttendance,
} from "../controllers/attendanceController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, authorizeModule, protect } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();
router.use(protect, authorize("admin", "employee"));

router.get("/", asyncHandler(getAttendance));
router.post("/", authorize("admin", "employee"), authorizeModule("attendance"), asyncHandler(createAttendance));
router.put(
  "/:id",
  authorizeModule("attendance"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(updateAttendance)
);

router.post(
  "/request-correction",
  authorize("employee"),
  authorizeModule("attendance"),
  [
    body("date").notEmpty().withMessage("Date is required."),
    body("type").isIn(["check-in", "check-out"]).withMessage("Type must be check-in or check-out."),
    body("time").notEmpty().withMessage("Time is required."),
    body("reason").trim().notEmpty().withMessage("Reason is required."),
  ],
  validateRequest,
  asyncHandler(requestAttendanceCorrection)
);

router.get(
  "/correction-requests",
  authorizeModule("attendance"),
  asyncHandler(getAttendanceCorrectionRequests)
);

router.patch(
  "/correction/:id",
  authorize("admin"),
  authorizeModule("attendance"),
  [
    param("id").isMongoId().withMessage("Invalid id."),
    body("action").isIn(["approved", "rejected"]).withMessage("Action must be approved or rejected."),
    body("adminRemarks").optional().isString().withMessage("Admin remarks must be text."),
  ],
  validateRequest,
  asyncHandler(reviewAttendanceCorrection)
);

router.delete(
  "/:id",
  authorize("admin"),
  authorizeModule("attendance"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(deleteAttendance)
);

export default router;
