import { Router } from "express";
import { orderController } from "../controllers/order.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { UserRole } from "@kisansetu/shared";

export const orderRoutes = Router();

orderRoutes.get("/", requireAuth, orderController.list);
orderRoutes.get("/:id", requireAuth, orderController.getById);
orderRoutes.post("/:id/in-transit", requireAuth, orderController.markInTransit);
orderRoutes.post("/:id/deliver", requireAuth, requireRole(UserRole.BUYER), orderController.markDelivered);
