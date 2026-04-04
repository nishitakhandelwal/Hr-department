import { Router } from "express";
import { param } from "express-validator";
import { createOffboarding, deleteOffboarding, getOffboarding, updateOffboarding } from "../controllers/offboardingController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();
router.use(protect, authorize("admin"));

router.get("/", asyncHandler(getOffboarding));
router.post("/", asyncHandler(createOffboarding));
router.put("/:id", [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(updateOffboarding));
router.delete("/:id", [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(deleteOffboarding));

export default router;
