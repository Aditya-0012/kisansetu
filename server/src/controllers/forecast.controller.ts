import { Request, Response } from "express";
import { forecastService } from "../services/forecast.service";
import { asyncHandler } from "../middleware/errorHandler";
import { CropCategory } from "@kisansetu/shared";

export const forecastController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const region = (req.query.region as string) ?? "Pune";
    const horizonDays = Number(req.query.horizonDays ?? 7) as 7 | 14 | 30;
    const forecast = await forecastService.getForecast(req.params.crop as CropCategory, region, horizonDays);
    res.json({ forecast });
  }),

  post: asyncHandler(async (req: Request, res: Response) => {
    const { crop, region = "Pune", horizonDays = 7 } = req.body;
    const forecast = await forecastService.getForecast(crop, region, horizonDays);
    res.json({ forecast });
  }),
};
