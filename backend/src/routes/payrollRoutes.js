import { Router } from "express";
import {
  downloadPayslipPdf,
  getPayroll,
  getPayrollConfig,
  getPayrollSummary,
  runPayroll,
  updatePayrollConfig,
} from "../controllers/payrollController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, authorizeModule, protect } from "../middleware/authMiddleware.js";

const router = Router();
router.use(protect, authorize("admin", "employee"));

router.get("/", authorizeModule("payroll"), asyncHandler(getPayroll));
router.get("/summary", authorizeModule("payroll"), asyncHandler(getPayrollSummary));
router.get("/config", authorize("admin"), authorizeModule("payroll"), asyncHandler(getPayrollConfig));
router.put("/config", authorize("admin"), authorizeModule("payroll"), asyncHandler(updatePayrollConfig));
router.get("/:id/payslip", authorizeModule("payroll"), asyncHandler(downloadPayslipPdf));
router.post("/run", authorize("admin"), authorizeModule("payroll"), asyncHandler(runPayroll));

export default router;
