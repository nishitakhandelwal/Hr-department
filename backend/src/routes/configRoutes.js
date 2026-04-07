import { Router } from "express";
import { getConfig, getConfigDefaults, updateConfig } from "../controllers/configController.js";
import { authorizeAccessRole, authorizePermission, protect } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(getConfig));
router.get("/defaults", asyncHandler(getConfigDefaults));
router.put("/", protect, authorizeAccessRole("super_admin"), authorizePermission("manage_runtime_config"), asyncHandler(updateConfig));
router.post("/update", protect, authorizeAccessRole("super_admin"), authorizePermission("manage_runtime_config"), asyncHandler(updateConfig));

export default router;
