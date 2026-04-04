import { Router } from "express";
import { body } from "express-validator";
import {
  changePassword,
  exportAuditLogs,
  getPublicSettings,
  getSettings,
  resetDefaults,
  updateAuditSettings,
  updateCompanySettings,
  updateDocumentSettings,
  updateNotificationSettings,
  updatePreferenceSettings,
  updateProfile,
  updateRbacSettings,
  updateSecuritySettings,
  updateSettings,
} from "../controllers/settingsController.js";
import { authorize, authorizeModule, protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { uploadCompanyLogo, uploadProfilePhoto } from "../middleware/uploadMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

router.get("/public", asyncHandler(getPublicSettings));

router.use(protect, authorize("admin"), authorizeModule("settings"));

router.get("/", asyncHandler(getSettings));
router.put("/", uploadCompanyLogo, asyncHandler(updateSettings));
router.put("/company", uploadCompanyLogo, asyncHandler(updateCompanySettings));
router.put("/rbac", asyncHandler(updateRbacSettings));
router.put("/security", asyncHandler(updateSecuritySettings));
router.put("/notifications", asyncHandler(updateNotificationSettings));
router.put("/preferences", asyncHandler(updatePreferenceSettings));
router.put("/documents", asyncHandler(updateDocumentSettings));
router.put("/audit", asyncHandler(updateAuditSettings));
router.post("/reset-defaults", asyncHandler(resetDefaults));
router.get("/audit/export", asyncHandler(exportAuditLogs));
router.put(
  "/profile",
  uploadProfilePhoto,
  [body("name").notEmpty().withMessage("Name is required."), body("email").isEmail().withMessage("Valid email is required.")],
  validateRequest,
  asyncHandler(updateProfile)
);
router.put(
  "/change-password",
  [
    body("currentPassword").isLength({ min: 6 }).withMessage("Current password is required."),
    body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters."),
  ],
  validateRequest,
  asyncHandler(changePassword)
);

export default router;
