import { Router } from "express";
import { z } from "zod";
import { smsController } from "../controllers/sms.controller";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import { UserRole } from "@kisansetu/shared";

export const smsRoutes = Router();

const testSmsSchema = z.object({ phone: z.string().regex(/^[0-9]{10,13}$/) });

smsRoutes.post("/test", requireAuth, requireRole(UserRole.ADMIN), validateBody(testSmsSchema), smsController.test);
