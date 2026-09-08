import { Request, Response } from "express";
import { aggregationService } from "../services/aggregation.service";
import { orderService } from "../services/order.service";
import { asyncHandler } from "../middleware/errorHandler";

export const aggregationController = {
  find: asyncHandler(async (req: Request, res: Response) => {
    const { crop, requiredQuantityKg, destinationRegion, maxDistanceKm } = req.body;
    const { batch, result } = await aggregationService.findSupply({
      crop, requiredQuantityKg, destinationRegion, maxDistanceKm, buyerId: req.user?.id,
    });
    res.json({ batch, analysis: { listingsAnalyzed: result.listingsAnalyzed, supplyGapKg: result.supplyGapKg, fullyFulfilled: result.fullyFulfilled } });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const batch = await aggregationService.getById(req.params.id);
    res.json({ batch });
  }),

  confirm: asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.confirmFromBatch(req.params.id, req.user!.id);
    res.status(201).json({ order });
  }),
};
