import { Router } from "express";
import {
  downloadPayslipPdf,
  getPayroll,
  getPayrollConfig,
  getPayrollSummary,
  runPayroll,
  updatePayrollConfig,
} from "../controllers/payrollController.js";
import { API_ROLE_GROUPS } from "../config/permissions.config.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, authorizeModule, protect } from "../middleware/authMiddleware.js";

const router = Router();
router.use(protect, authorize(API_ROLE_GROUPS.adminOrEmployee));

router.get("/", authorizeModule("payroll"), asyncHandler(getPayroll));
router.get("/summary", authorizeModule("payroll"), asyncHandler(getPayrollSummary));
router.get("/config", authorize(API_ROLE_GROUPS.adminOnly), authorizeModule("payroll"), asyncHandler(getPayrollConfig));
router.put("/config", authorize(API_ROLE_GROUPS.adminOnly), authorizeModule("payroll"), asyncHandler(updatePayrollConfig));
router.get("/:id/payslip", authorizeModule("payroll"), asyncHandler(downloadPayslipPdf));
router.post("/run", authorize(API_ROLE_GROUPS.adminOnly), authorizeModule("payroll"), asyncHandler(runPayroll));

export default router;
