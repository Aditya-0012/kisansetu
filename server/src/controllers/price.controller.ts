import { Request, Response } from "express";
import { priceService } from "../services/price.service";
import { asyncHandler } from "../middleware/errorHandler";
import { CropCategory, QualityGrade } from "@kisansetu/shared";

export const priceController = {
  all: asyncHandler(async (_req: Request, res: Response) => {
    const prices = await priceService.getAllCurrentPrices();
    res.json({ prices });
  }),

  current: asyncHandler(async (req: Request, res: Response) => {
    const region = (req.query.region as string) ?? "Pune";
    const price = await priceService.getCurrentPrice(req.params.crop as CropCategory, region);
    res.json({ price });
  }),

  trend: asyncHandler(async (req: Request, res: Response) => {
    const region = (req.query.region as string) ?? "Pune";
    const days = Number(req.query.days ?? 30);
    const trend = await priceService.getTrend(req.params.crop as CropCategory, region, days);
    res.json({ trend });
  }),

  fairPrice: asyncHandler(async (req: Request, res: Response) => {
    const region = (req.query.region as string) ?? "Pune";
    const quality = (req.query.quality as QualityGrade) ?? QualityGrade.A;
    const growth = Number(req.query.demandGrowthPercent ?? 0);
    const suggestion = await priceService.getFairPriceSuggestion(req.params.crop as CropCategory, region, quality, growth);
    res.json({ suggestion });
  }),
};
