import { Router } from "express";
import { paymentController } from "../controllers/payment.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { UserRole } from "@kisansetu/shared";

export const paymentRoutes = Router();

// Note: escrow HOLD happens automatically and atomically when an order is
// confirmed (see orderService.confirmFromOffer/confirmFromBatch) rather than
// via a separate POST /payments/demo call — holding funds and creating the
// order must succeed or fail together, so they share one DB transaction.
// See docs/api.md for the full rationale.
paymentRoutes.post("/:id/release", requireAuth, requireRole(UserRole.BUYER, UserRole.ADMIN), paymentController.release);
