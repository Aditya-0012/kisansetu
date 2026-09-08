import { Router } from "express";
import { pickupController } from "../controllers/pickup.controller";
import { validateBody } from "../middleware/validate";
import { schedulePickupSchema } from "../validators/order.validators";
import { requireAuth, requireRole } from "../middleware/auth";
import { UserRole } from "@kisansetu/shared";

export const pickupRoutes = Router();

pickupRoutes.get("/", requireAuth, requireRole(UserRole.ADMIN), pickupController.upcoming);
pickupRoutes.get("/:orderId", requireAuth, pickupController.forOrder);
pickupRoutes.post("/:orderId", requireAuth, requireRole(UserRole.BUYER, UserRole.ADMIN), validateBody(schedulePickupSchema), pickupController.schedule);
