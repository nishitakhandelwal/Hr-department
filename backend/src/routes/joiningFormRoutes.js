import { Router } from "express";
import { body, param } from "express-validator";
import {
  deleteJoiningForm,
  getJoiningFormById,
  getMyJoiningForm,
  listJoiningForms,
  reviewJoiningForm,
  sendJoiningForm,
  submitMyJoiningForm,
} from "../controllers/joiningFormController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, authorizeModule, protect } from "../middleware/authMiddleware.js";
import { uploadJoiningFormDocuments } from "../middleware/uploadMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

router.get("/", protect, authorize("admin", "candidate", "employee"), asyncHandler(listJoiningForms));
router.get("/me", protect, authorize("candidate", "employee"), asyncHandler(getMyJoiningForm));

router.post(
  "/send/:candidateId",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [param("candidateId").isMongoId().withMessage("Invalid candidate id.")],
  validateRequest,
  asyncHandler(sendJoiningForm)
);

router.post(
  "/me/submit",
  protect,
  authorize("candidate", "employee"),
  uploadJoiningFormDocuments,
  asyncHandler(submitMyJoiningForm)
);

router.get(
  "/:id",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(getJoiningFormById)
);

router.patch(
  "/:id/review",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [
    param("id").isMongoId().withMessage("Invalid id."),
    body("action").isIn(["approve", "request_correction", "reject"]).withMessage("Invalid action."),
  ],
  validateRequest,
  asyncHandler(reviewJoiningForm)
);

router.delete(
  "/:id",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(deleteJoiningForm)
);

export default router;
