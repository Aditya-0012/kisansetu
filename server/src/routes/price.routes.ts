import { Router } from "express";
import { priceController } from "../controllers/price.controller";

export const priceRoutes = Router();

priceRoutes.get("/", priceController.all);
priceRoutes.get("/:crop", priceController.current);
priceRoutes.get("/:crop/trend", priceController.trend);
priceRoutes.get("/:crop/fair-price", priceController.fairPrice);
