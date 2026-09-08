import { Router } from "express";
import { forecastController } from "../controllers/forecast.controller";

export const forecastRoutes = Router();

forecastRoutes.get("/:crop", forecastController.get);
forecastRoutes.post("/", forecastController.post);
