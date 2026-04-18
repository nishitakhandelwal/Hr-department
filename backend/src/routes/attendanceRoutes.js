import { Router } from "express";
import { body, param } from "express-validator";
import {
  adminOverrideAttendance,
  createAttendance,
  deleteAttendance,
  getAttendance,
  getAttendanceCorrectionRequests,
  markGeoAttendance,
  requestAttendanceCorrection,
  reviewAttendanceCorrection,
  updateAttendance,
  validateAttendanceLocation,
} from "../controllers/attendanceController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, authorizeModule, protect } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();
router.use(protect, authorize("admin", "employee"));

router.get("/", asyncHandler(getAttendance));
router.post("/", authorize("admin", "employee"), authorizeModule("attendance"), asyncHandler(createAttendance));
router.post(
  "/validate-location",
  authorize("employee"),
  authorizeModule("attendance"),
  [
    body("latitude").isFloat({ min: -90, max: 90 }).withMessage("Latitude must be between -90 and 90."),
    body("longitude").isFloat({ min: -180, max: 180 }).withMessage("Longitude must be between -180 and 180."),
  ],
  validateRequest,
  asyncHandler(validateAttendanceLocation)
);
router.post(
  "/mark",
  authorize("employee"),
  authorizeModule("attendance"),
  [
    body("action").isIn(["check-in", "check-out"]).withMessage("Action must be check-in or check-out."),
    body("latitude").isFloat({ min: -90, max: 90 }).withMessage("Latitude must be between -90 and 90."),
    body("longitude").isFloat({ min: -180, max: 180 }).withMessage("Longitude must be between -180 and 180."),
  ],
  validateRequest,
  asyncHandler(markGeoAttendance)
);
router.post(
  "/override",
  authorize("admin"),
  authorizeModule("attendance"),
  [
    body("employeeId").isMongoId().withMessage("Valid employee is required."),
    body("date").notEmpty().withMessage("Date is required."),
    body("checkIn").optional({ nullable: true }).isString().withMessage("Check-in time must be text."),
    body("checkOut").optional({ nullable: true }).isString().withMessage("Check-out time must be text."),
    body("status").optional().isIn(["present", "late", "absent", "leave"]).withMessage("Invalid attendance status."),
    body("hoursWorked").optional().isNumeric().withMessage("Hours worked must be numeric."),
  ],
  validateRequest,
  asyncHandler(adminOverrideAttendance)
);
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
