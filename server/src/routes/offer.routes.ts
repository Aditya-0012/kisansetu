import { Router } from "express";
import { offerController } from "../controllers/offer.controller";
import { validateBody } from "../middleware/validate";
import { createOfferSchema, respondOfferSchema } from "../validators/offer.validators";
import { requireAuth, requireRole } from "../middleware/auth";
import { UserRole } from "@kisansetu/shared";

export const offerRoutes = Router();

offerRoutes.get("/", requireAuth, offerController.list);
offerRoutes.get("/:id", requireAuth, offerController.getById);
offerRoutes.post("/", requireAuth, requireRole(UserRole.BUYER), validateBody(createOfferSchema), offerController.create);
offerRoutes.patch("/:id", requireAuth, validateBody(respondOfferSchema), offerController.respond);
offerRoutes.post("/:id/confirm-order", requireAuth, requireRole(UserRole.BUYER), offerController.confirmOrder);
