import { Router } from "express";
import { param } from "express-validator";
import { API_ROLE_GROUPS } from "../config/permissions.config.js";
import { createLeave, deleteLeave, getLeave, updateLeave } from "../controllers/leaveController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();
router.use(protect, authorize(API_ROLE_GROUPS.adminOrEmployee));

router.get("/", asyncHandler(getLeave));
router.post("/", asyncHandler(createLeave));
router.put("/:id", authorize(API_ROLE_GROUPS.adminOnly), [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(updateLeave));
router.delete("/:id", authorize(API_ROLE_GROUPS.adminOnly), [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(deleteLeave));

export default router;
