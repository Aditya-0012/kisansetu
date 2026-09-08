import { Router } from "express";
import { aggregationController } from "../controllers/aggregation.controller";
import { validateBody } from "../middleware/validate";
import { findSupplySchema } from "../validators/aggregation.validators";
import { requireAuth, requireRole } from "../middleware/auth";
import { UserRole } from "@kisansetu/shared";

export const aggregationRoutes = Router();

aggregationRoutes.post("/find", requireAuth, requireRole(UserRole.BUYER), validateBody(findSupplySchema), aggregationController.find);
aggregationRoutes.get("/:id", requireAuth, aggregationController.getById);
aggregationRoutes.post("/:id/confirm", requireAuth, requireRole(UserRole.BUYER), aggregationController.confirm);
