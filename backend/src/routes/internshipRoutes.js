import { Router } from "express";
import { body, param } from "express-validator";
import {
  createInternship,
  decideInternship,
  deleteInternship,
  getInternshipById,
  listInternships,
  updateInternship,
} from "../controllers/internshipController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, authorizeModule, protect } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

router.get("/", protect, authorize("admin", "candidate"), asyncHandler(listInternships));
router.get(
  "/:id",
  protect,
  authorize("admin", "candidate"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(getInternshipById)
);

router.post(
  "/",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [
    body("candidateId").isMongoId().withMessage("candidateId is required."),
    body("startDate").notEmpty().withMessage("startDate is required."),
    body("endDate").notEmpty().withMessage("endDate is required."),
  ],
  validateRequest,
  asyncHandler(createInternship)
);

router.put(
  "/:id",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(updateInternship)
);

router.patch(
  "/:id/decision",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(decideInternship)
);

router.delete(
  "/:id",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(deleteInternship)
);

export default router;
