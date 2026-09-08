import { Router } from "express";
import { notificationController } from "../controllers/notification.controller";
import { requireAuth } from "../middleware/auth";

export const notificationRoutes = Router();

notificationRoutes.get("/", requireAuth, notificationController.list);
notificationRoutes.post("/:id/read", requireAuth, notificationController.markRead);
notificationRoutes.post("/read-all", requireAuth, notificationController.markAllRead);
