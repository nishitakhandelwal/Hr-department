import { Router } from "express";
import { param } from "express-validator";
import { createDepartment, deleteDepartment, getDepartments, updateDepartment } from "../controllers/departmentController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, authorizeModule, protect } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();
router.use(protect, authorize("admin"), authorizeModule("departments"));

router.get("/", asyncHandler(getDepartments));
router.post("/", asyncHandler(createDepartment));
router.put("/:id", [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(updateDepartment));
router.delete("/:id", [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(deleteDepartment));

export default router;
