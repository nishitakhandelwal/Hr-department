import { Router } from "express";
import {
  createAdvance,
  downloadPayslipPdf,
  listAdvances,
  getPayroll,
  getPayrollConfig,
  getPayrollSummary,
  runPayroll,
  updateAdvance,
  updatePayrollConfig,
} from "../controllers/payrollController.js";
import { API_ROLE_GROUPS } from "../config/permissions.config.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, authorizeModule, protect } from "../middleware/authMiddleware.js";
import { body, param } from "express-validator";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();
router.use(protect, authorize(API_ROLE_GROUPS.adminOrEmployee));

router.get("/", authorizeModule("payroll"), asyncHandler(getPayroll));
router.get("/summary", authorizeModule("payroll"), asyncHandler(getPayrollSummary));
router.get("/advances", authorizeModule("payroll"), asyncHandler(listAdvances));
router.post(
  "/advances",
  authorize(API_ROLE_GROUPS.adminOnly),
  authorizeModule("payroll"),
  [
    body("employeeId").isMongoId().withMessage("Valid employee is required."),
    body("amount").isFloat({ gt: 0 }).withMessage("Advance amount must be greater than zero."),
    body("notes").optional().isString().withMessage("Notes must be text."),
  ],
  validateRequest,
  asyncHandler(createAdvance)
);
router.patch(
  "/advances/:id",
  authorize(API_ROLE_GROUPS.adminOnly),
  authorizeModule("payroll"),
  [
    param("id").isMongoId().withMessage("Valid advance id is required."),
    body("status").optional().isIn(["pending", "partially_deducted", "completed", "cancelled"]).withMessage("Invalid status."),
    body("remainingAmount").optional().isFloat({ min: 0 }).withMessage("Remaining amount must be zero or more."),
    body("notes").optional().isString().withMessage("Notes must be text."),
  ],
  validateRequest,
  asyncHandler(updateAdvance)
);
router.get("/config", authorize(API_ROLE_GROUPS.adminOnly), authorizeModule("payroll"), asyncHandler(getPayrollConfig));
router.put("/config", authorize(API_ROLE_GROUPS.adminOnly), authorizeModule("payroll"), asyncHandler(updatePayrollConfig));
router.get("/:id/payslip", authorizeModule("payroll"), asyncHandler(downloadPayslipPdf));
router.post("/run", authorize(API_ROLE_GROUPS.adminOnly), authorizeModule("payroll"), asyncHandler(runPayroll));

export default router;
