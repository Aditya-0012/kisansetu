import { Router } from "express";
import { listingController } from "../controllers/listing.controller";
import { validateBody, validateQuery } from "../middleware/validate";
import { createListingSchema, listQuerySchema, updateListingSchema } from "../validators/listing.validators";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";
import { UserRole } from "@kisansetu/shared";

export const listingRoutes = Router();

listingRoutes.get("/", optionalAuth, validateQuery(listQuerySchema), listingController.search);
listingRoutes.get("/mine", requireAuth, requireRole(UserRole.FARMER), listingController.mine);
listingRoutes.get("/:id", listingController.getById);
listingRoutes.post("/", requireAuth, requireRole(UserRole.FARMER), validateBody(createListingSchema), listingController.create);
listingRoutes.patch("/:id", requireAuth, requireRole(UserRole.FARMER), validateBody(updateListingSchema), listingController.update);
