import { Router } from "express";
import { body, param } from "express-validator";
import {
  createUser,
  deleteUser,
  getAdminDashboardSummary,
  getManagedUsers,
  getUsers,
  inviteUser,
  listAuditLogs,
  listUserActivities,
  updateUser,
  updateUserProfileImage,
  updateUserPermissions,
  updateUserRole,
  removeUserProfileImage,
  updateUserSecurity,
  updateUserStatus,
} from "../controllers/userController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, authorizeModule, protect } from "../middleware/authMiddleware.js";
import { uploadProfilePhoto } from "../middleware/uploadMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

const roleUpdateValidators = [
  param("id").isMongoId().withMessage("Invalid id."),
  body("accessRole").notEmpty().withMessage("Access role is required."),
];

router.use(protect, authorize("admin"));

router.get("/dashboard-summary", authorizeModule("dashboard"), asyncHandler(getAdminDashboardSummary));
router.get("/", authorizeModule("userManagement"), asyncHandler(getUsers));
router.get("/management", authorizeModule("userManagement"), asyncHandler(getManagedUsers));
router.get("/activity", authorizeModule("userManagement"), asyncHandler(listUserActivities));
router.get("/audit", authorizeModule("userManagement"), asyncHandler(listAuditLogs));
router.post(
  "/",
  authorizeModule("userManagement"),
  [
    body("name").notEmpty().withMessage("Name is required."),
    body("email").isEmail().withMessage("Valid email is required."),
    body("password").isLength({ min: 6 }).withMessage("Password min length 6."),
    body("role").optional().isIn(["admin", "employee", "candidate"]).withMessage("Invalid role."),
  ],
  validateRequest,
  asyncHandler(createUser)
);
router.post(
  "/invite",
  authorizeModule("userManagement"),
  [
    body("name").notEmpty().withMessage("Name is required."),
    body("email").isEmail().withMessage("Valid email is required."),
    body("role").notEmpty().withMessage("Role is required."),
    body("temporaryPassword").isLength({ min: 6 }).withMessage("Temporary password min length 6."),
  ],
  validateRequest,
  asyncHandler(inviteUser)
);
router.patch(
  "/:id/role",
  roleUpdateValidators,
  validateRequest,
  asyncHandler(updateUserRole)
);
router.put(
  "/:id/role",
  roleUpdateValidators,
  validateRequest,
  asyncHandler(updateUserRole)
);
router.patch(
  "/:id/status",
  authorizeModule("userManagement"),
  [param("id").isMongoId().withMessage("Invalid id."), body("accountStatus").notEmpty().withMessage("Account status is required.")],
  validateRequest,
  asyncHandler(updateUserStatus)
);
router.patch(
  "/:id/security",
  authorizeModule("userManagement"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(updateUserSecurity)
);
router.patch(
  "/:id/permissions",
  authorizeModule("userManagement"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(updateUserPermissions)
);
router.put(
  "/:id",
  authorizeModule("userManagement"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(updateUser)
);
router.delete(
  "/:id",
  authorizeModule("userManagement"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(deleteUser)
);
router.put(
  "/:id/profile-image",
  authorizeModule("userManagement"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  uploadProfilePhoto,
  asyncHandler(updateUserProfileImage)
);
router.delete(
  "/:id/profile-image",
  authorizeModule("userManagement"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(removeUserProfileImage)
);

export default router;
