import { Router } from "express";
import { param } from "express-validator";
import {
  createOffboarding,
  deleteOffboarding,
  getMyOffboarding,
  getOffboarding,
  reviewResignationRequest,
  submitMyResignation,
  updateMyOffboardingActions,
  updateOffboarding,
} from "../controllers/offboardingController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();
router.use(protect);

router.get("/me", authorize("employee"), asyncHandler(getMyOffboarding));
router.post("/me/resignation", authorize("employee"), asyncHandler(submitMyResignation));
router.put("/me/actions", authorize("employee"), asyncHandler(updateMyOffboardingActions));

router.get("/", authorize("admin"), asyncHandler(getOffboarding));
router.post("/", authorize("admin"), asyncHandler(createOffboarding));
router.put("/:id/resignation-review", authorize("admin"), [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(reviewResignationRequest));
router.put("/:id", authorize("admin"), [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(updateOffboarding));
router.delete("/:id", authorize("admin"), [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(deleteOffboarding));

export default router;
