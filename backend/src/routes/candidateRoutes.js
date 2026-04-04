import { Router } from "express";
import { body, param } from "express-validator";
import {
  acceptOffer,
  assignInternshipToCandidate,
  convertCandidateToEmployee,
  getCandidateById,
  createCandidate,
  deleteCandidate,
  getCandidates,
  getMyCandidateApplication,
  reviewCandidateByAdmin,
  sendJoiningFormToCandidate,
  sendOfferLetterToCandidate,
  submitCandidateStage2,
  uploadCandidateVideo,
  updateMyCandidateDocuments,
  updateMyCandidateProfile,
  updateCandidateStatus,
} from "../controllers/candidateController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, authorizeModule, protect } from "../middleware/authMiddleware.js";
import { uploadCandidatePortalDocuments, uploadCandidateVideo as uploadCandidateVideoFile, uploadStage2Resume } from "../middleware/uploadMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

// Candidate Stage-1 apply/create
router.post("/", protect, authorize("candidate"), asyncHandler(createCandidate));

// Admin candidates list
router.get("/", protect, authorize("admin", "employee"), authorizeModule("candidates"), asyncHandler(getCandidates));
router.post(
  "/accept-offer/:candidateId",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [param("candidateId").isMongoId().withMessage("Invalid candidate id.")],
  validateRequest,
  asyncHandler(acceptOffer)
);
router.get("/me", protect, authorize("candidate"), asyncHandler(getMyCandidateApplication));
router.put("/me/profile", protect, authorize("candidate"), asyncHandler(updateMyCandidateProfile));
router.put("/me/documents", protect, authorize("candidate"), uploadCandidatePortalDocuments, asyncHandler(updateMyCandidateDocuments));
router.post("/upload-video", protect, authorize("candidate"), uploadCandidateVideoFile, asyncHandler(uploadCandidateVideo));
router.post(
  "/me/stage2",
  protect,
  authorize("candidate"),
  uploadStage2Resume,
  asyncHandler(submitCandidateStage2)
);
router.get(
  "/:id",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(getCandidateById)
);

// Admin update/delete
router.put(
  "/:id/review",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(reviewCandidateByAdmin)
);
router.patch(
  "/:id/status",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(updateCandidateStatus)
);
router.post(
  "/:id/assign-internship",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(assignInternshipToCandidate)
);
router.post(
  "/:id/send-offer",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [
    param("id").isMongoId().withMessage("Invalid id."),
    body("role").trim().notEmpty().withMessage("Offer role is required."),
    body("salary").isFloat({ gt: 0 }).withMessage("Offer salary must be greater than 0."),
    body("joiningDate").isISO8601().withMessage("A valid joining date is required."),
  ],
  validateRequest,
  asyncHandler(sendOfferLetterToCandidate)
);
router.post(
  "/:id/send-joining-form",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(sendJoiningFormToCandidate)
);
router.post(
  "/:id/convert-to-employee",
  protect,
  authorize("admin", "employee"),
  authorizeModule("candidates"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(convertCandidateToEmployee)
);
router.delete(
  "/:id",
  protect,
  authorize("admin", "employee"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(deleteCandidate)
);

export default router;
