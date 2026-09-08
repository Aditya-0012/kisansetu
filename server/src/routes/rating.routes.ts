import { Router } from "express";
import { ratingController } from "../controllers/rating.controller";
import { validateBody } from "../middleware/validate";
import { createRatingSchema } from "../validators/order.validators";
import { requireAuth } from "../middleware/auth";

export const ratingRoutes = Router();

ratingRoutes.post("/order/:orderId", requireAuth, validateBody(createRatingSchema), ratingController.submit);
ratingRoutes.get("/order/:orderId", requireAuth, ratingController.forOrder);
ratingRoutes.get("/user/:userId", ratingController.forUser);
