import { Router } from "express";
import { body } from "express-validator";
import {
  login,
  logout,
  me,
  requestOtp,
  register,
  registerCandidate,
  removeProfileImage,
  resendRegistrationOtp,
  requestPasswordReset,
  resetPassword,
  sendOtp,
  updateProfileImage,
  uploadProfileImage,
  uploadProfileImageViaSharedRoute,
  updateMyProfilePhoto,
  verifyRegistrationOtp,
  verifyOtp,
} from "../controllers/authController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadProfileImage as uploadProfileImageFile, uploadProfilePhoto } from "../middleware/uploadMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import rateLimit from "express-rate-limit";

const router = Router();
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password reset attempts. Please try again later.",
  },
});

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required."),
    body("email").isEmail().withMessage("Valid email is required."),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters."),
    body("role").isIn(["admin", "employee", "candidate"]).withMessage("Role must be admin, employee, or candidate."),
  ],
  validateRequest,
  asyncHandler(register)
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required."),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters."),
    body("otp").optional().matches(/^\d{6}$/).withMessage("OTP must be 6 digits."),
  ],
  validateRequest,
  asyncHandler(login)
);

router.post(
  "/request-otp",
  [
    body("phoneNumber").optional().isString().isLength({ min: 10, max: 20 }).withMessage("Phone number must be between 10 and 20 characters."),
    body("email").optional().isEmail().withMessage("Valid email is required."),
    body().custom((value) => {
      if (value?.phoneNumber || value?.email) return true;
      throw new Error("Email or phone number is required.");
    }),
    body("resend").optional().isBoolean().withMessage("Resend must be boolean."),
  ],
  validateRequest,
  asyncHandler(requestOtp)
);

router.post(
  "/send-otp",
  [
    body("phoneNumber").optional().isString().isLength({ min: 10, max: 20 }).withMessage("Phone number must be between 10 and 20 characters."),
    body("email").optional().isEmail().withMessage("Valid email is required."),
    body().custom((value) => {
      if (value?.phoneNumber || value?.email) return true;
      throw new Error("Email or phone number is required.");
    }),
    body("resend").optional().isBoolean().withMessage("Resend must be boolean."),
  ],
  validateRequest,
  asyncHandler(sendOtp)
);

router.post(
  "/verify-otp",
  [
    body("phoneNumber").optional().isString().isLength({ min: 10, max: 20 }).withMessage("Phone number must be between 10 and 20 characters."),
    body("email").optional().isEmail().withMessage("Valid email is required."),
    body().custom((value) => {
      if (value?.phoneNumber || value?.email) return true;
      throw new Error("Email or phone number is required.");
    }),
    body("otp").matches(/^\d{6}$/).withMessage("OTP must be 6 digits."),
  ],
  validateRequest,
  asyncHandler(verifyOtp)
);

router.post(
  "/register-candidate",
  [
    body("name").notEmpty().withMessage("Name is required."),
    body("email").isEmail().withMessage("Valid email is required."),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters."),
  ],
  validateRequest,
  asyncHandler(registerCandidate)
);

router.post(
  "/verify-registration-otp",
  [
    body("email").isEmail().withMessage("Valid email is required."),
    body("otp").matches(/^\d{6}$/).withMessage("OTP must be 6 digits."),
  ],
  validateRequest,
  asyncHandler(verifyRegistrationOtp)
);

router.post(
  "/resend-registration-otp",
  [body("email").isEmail().withMessage("Valid email is required.")],
  validateRequest,
  asyncHandler(resendRegistrationOtp)
);

router.get("/me", protect, asyncHandler(me));
router.post("/upload-profile", protect, uploadProfileImageFile, asyncHandler(uploadProfileImageViaSharedRoute));
router.post("/me/profile-photo", protect, uploadProfilePhoto, asyncHandler(updateMyProfilePhoto));
router.post("/upload-profile-image", protect, uploadProfilePhoto, asyncHandler(uploadProfileImage));
router.put("/update-profile-image", protect, uploadProfilePhoto, asyncHandler(updateProfileImage));
router.delete("/remove-profile-image", protect, asyncHandler(removeProfileImage));
router.post("/logout", protect, asyncHandler(logout));
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  [
    body("email").isEmail().withMessage("Valid email is required."),
    body("resend").optional().isBoolean().withMessage("Resend must be boolean."),
  ],
  validateRequest,
  asyncHandler(requestPasswordReset)
);
router.post(
  "/reset-password/:token",
  [body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters.")],
  validateRequest,
  asyncHandler(resetPassword)
);
router.post(
  "/reset-password",
  [
    body().custom((value) => {
      if (value?.token || (value?.email && value?.otp)) return true;
      throw new Error("Token or email with OTP is required.");
    }),
    body("email").optional().isEmail().withMessage("Valid email is required."),
    body("otp").optional().matches(/^\d{6}$/).withMessage("OTP must be 6 digits."),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters."),
  ],
  validateRequest,
  asyncHandler(resetPassword)
);

export default router;
