import { Router } from "express";
import { body, param } from "express-validator";
import {
  createLocation,
  deleteLocation,
  getLocations,
  updateLocation,
} from "../controllers/officeLocationController.js";
import { authorizeAccessRole, authorizeModule, protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";

const router = Router();

router.use(protect, authorizeAccessRole("super_admin", "admin", "employee"));

router.get("/", authorizeModule("attendance"), asyncHandler(getLocations));

router.post(
  "/",
  authorizeAccessRole("super_admin", "admin"),
  authorizeModule("attendance"),
  [
    body("name").trim().notEmpty().withMessage("Location name is required."),
    body("latitude").isFloat({ min: -90, max: 90 }).withMessage("Latitude must be between -90 and 90."),
    body("longitude").isFloat({ min: -180, max: 180 }).withMessage("Longitude must be between -180 and 180."),
    body("radiusMeters")
      .isFloat({ gt: 0 })
      .withMessage("Radius must be greater than 0."),
  ],
  validateRequest,
  asyncHandler(createLocation)
);

router.put(
  "/:id",
  authorizeAccessRole("super_admin", "admin"),
  authorizeModule("attendance"),
  [
    param("id").isMongoId().withMessage("Invalid location id."),
    body("name").trim().notEmpty().withMessage("Location name is required."),
    body("latitude").isFloat({ min: -90, max: 90 }).withMessage("Latitude must be between -90 and 90."),
    body("longitude").isFloat({ min: -180, max: 180 }).withMessage("Longitude must be between -180 and 180."),
    body("radiusMeters")
      .isFloat({ gt: 0 })
      .withMessage("Radius must be greater than 0."),
  ],
  validateRequest,
  asyncHandler(updateLocation)
);

router.delete(
  "/:id",
  authorizeAccessRole("super_admin", "admin"),
  authorizeModule("attendance"),
  [param("id").isMongoId().withMessage("Invalid location id.")],
  validateRequest,
  asyncHandler(deleteLocation)
);

export default router;
