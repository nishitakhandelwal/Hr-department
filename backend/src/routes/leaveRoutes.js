import { Router } from "express";
import { param } from "express-validator";
import { createLeave, deleteLeave, getLeave, updateLeave } from "../controllers/leaveController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();
router.use(protect, authorize("admin", "employee"));

router.get("/", asyncHandler(getLeave));
router.post("/", asyncHandler(createLeave));
router.put("/:id", authorize("admin"), [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(updateLeave));
router.delete("/:id", authorize("admin"), [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(deleteLeave));

export default router;
