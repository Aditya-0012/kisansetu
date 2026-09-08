import { Router } from "express";
import { adminController } from "../controllers/admin.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { UserRole } from "@kisansetu/shared";

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireRole(UserRole.ADMIN));
adminRoutes.get("/dashboard", adminController.dashboard);
adminRoutes.get("/forecast", adminController.forecast);
adminRoutes.get("/batches", adminController.batches);
adminRoutes.get("/prices", adminController.prices);
adminRoutes.get("/sms-logs", adminController.smsLogs);
adminRoutes.get("/audit-log", adminController.auditLog);
