import { Router } from "express";
import { param } from "express-validator";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

router.use(protect, authorize("admin", "candidate", "employee"));

router.get("/", asyncHandler(getNotifications));
router.patch("/read-all", asyncHandler(markAllNotificationsRead));
router.patch(
  "/:id/read",
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(markNotificationRead)
);
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(deleteNotification)
);

export default router;
