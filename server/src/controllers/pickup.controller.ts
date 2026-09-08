import { Request, Response } from "express";
import { orderService } from "../services/order.service";
import { pickupService } from "../services/pickup.service";
import { asyncHandler } from "../middleware/errorHandler";

export const pickupController = {
  schedule: asyncHandler(async (req: Request, res: Response) => {
    const result = await orderService.schedulePickup(req.params.orderId, req.body);
    res.status(201).json(result);
  }),

  upcoming: asyncHandler(async (_req: Request, res: Response) => {
    const pickups = await pickupService.upcoming();
    res.json({ pickups });
  }),

  forOrder: asyncHandler(async (req: Request, res: Response) => {
    const result = await pickupService.forOrder(req.params.orderId);
    res.json(result);
  }),
};
