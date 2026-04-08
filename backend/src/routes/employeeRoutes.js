import { Router } from "express";
import { param } from "express-validator";
import {
  createEmployee,
  deleteEmployee,
  getEmployeeDashboardSummary,
  getEmployeeById,
  getEmployees,
  getMyEmployeeProfile,
  removeEmployeePhoto,
  uploadEmployeePhoto,
  updateEmployee,
  updateEmployeeSalaryStructure,
} from "../controllers/employeeController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, authorizeModule, protect } from "../middleware/authMiddleware.js";
import { uploadEmployeePhoto as uploadEmployeePhotoMiddleware } from "../middleware/uploadMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();
router.use(protect);

router.get("/me", authorize("admin", "employee"), asyncHandler(getMyEmployeeProfile));
router.get("/dashboard-summary", authorize("employee"), asyncHandler(getEmployeeDashboardSummary));
router.use(authorize("admin"), authorizeModule("employees"));

router.get("/", asyncHandler(getEmployees));
router.get("/:id", [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(getEmployeeById));
router.post("/", asyncHandler(createEmployee));
router.put(
  "/:id/photo",
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  uploadEmployeePhotoMiddleware,
  asyncHandler(uploadEmployeePhoto)
);
router.delete("/:id/photo", [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(removeEmployeePhoto));
router.put("/:id/salary-structure", [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(updateEmployeeSalaryStructure));
router.put("/:id", [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(updateEmployee));
router.delete("/:id", [param("id").isMongoId().withMessage("Invalid id.")], validateRequest, asyncHandler(deleteEmployee));

export default router;
