import { Router } from "express";
import { body, param } from "express-validator";
import {
  createTemplate,
  deleteGeneratedLetter,
  generateOfferLetterPdf,
  downloadLetter,
  duplicateTemplate,
  exportLettersCsv,
  generateLetter,
  getGeneratedLetterById,
  getLetterAnalytics,
  getTemplateById,
  listGeneratedLetters,
  listMyLetters,
  listTemplateVersions,
  listTemplates,
  markLetterSent,
  respondToLetter,
  seedDefaultTemplates,
  sendLetterByEmail,
  toggleTemplateActive,
  updateTemplate,
} from "../controllers/letterController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authorize, authorizeModule, protect } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();
router.use(protect);

router.get(
  "/",
  authorize("admin"),
  authorizeModule("letters"),
  asyncHandler(listGeneratedLetters)
);

router.get("/my", authorize("admin", "employee", "candidate"), asyncHandler(listMyLetters));
router.get(
  "/:id/download",
  authorize("admin", "employee", "candidate"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(downloadLetter)
);
router.patch(
  "/:id/respond",
  authorize("employee", "candidate"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(respondToLetter)
);

router.get("/templates", authorize("admin"), authorizeModule("letters"), asyncHandler(listTemplates));
router.post("/templates/seed", authorize("admin"), authorizeModule("letters"), asyncHandler(seedDefaultTemplates));
router.post("/templates", authorize("admin"), authorizeModule("letters"), asyncHandler(createTemplate));
router.get(
  "/templates/:id",
  authorize("admin"),
  authorizeModule("letters"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(getTemplateById)
);
router.put(
  "/templates/:id",
  authorize("admin"),
  authorizeModule("letters"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(updateTemplate)
);
router.post(
  "/templates/:id/duplicate",
  authorize("admin"),
  authorizeModule("letters"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(duplicateTemplate)
);
router.patch(
  "/templates/:id/toggle-active",
  authorize("admin"),
  authorizeModule("letters"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(toggleTemplateActive)
);
router.get(
  "/templates/:id/versions",
  authorize("admin"),
  authorizeModule("letters"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(listTemplateVersions)
);

router.get("/generated", authorize("admin"), authorizeModule("letters"), asyncHandler(listGeneratedLetters));
router.post("/generate", authorize("admin"), authorizeModule("letters"), asyncHandler(generateLetter));
router.post("/offer/pdf", authorize("admin"), authorizeModule("letters"), asyncHandler(generateOfferLetterPdf));
router.post(
  "/send-email",
  authorize("admin"),
  authorizeModule("letters"),
  [
    body("employeeEmail").isEmail().withMessage("Valid employee email is required."),
    body("htmlContent").notEmpty().withMessage("Letter HTML content is required."),
  ],
  validateRequest,
  asyncHandler(sendLetterByEmail)
);
router.get("/analytics", authorize("admin"), authorizeModule("letters"), asyncHandler(getLetterAnalytics));
router.get("/export/csv", authorize("admin"), authorizeModule("letters"), asyncHandler(exportLettersCsv));
router.get(
  "/generated/:id",
  authorize("admin"),
  authorizeModule("letters"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(getGeneratedLetterById)
);
router.patch(
  "/generated/:id/sent",
  authorize("admin"),
  authorizeModule("letters"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(markLetterSent)
);
router.delete(
  "/generated/:id",
  authorize("admin"),
  authorizeModule("letters"),
  [param("id").isMongoId().withMessage("Invalid id.")],
  validateRequest,
  asyncHandler(deleteGeneratedLetter)
);

export default router;
