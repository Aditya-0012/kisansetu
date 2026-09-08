import { Request, Response } from "express";
import { orderService } from "../services/order.service";
import { asyncHandler } from "../middleware/errorHandler";
import { UserRole } from "@kisansetu/shared";

export const orderController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const orders = req.user!.role === UserRole.FARMER
      ? await orderService.listForFarmer(req.user!.id)
      : await orderService.listForBuyer(req.user!.id);
    res.json({ orders });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const [order, items] = await Promise.all([
      orderService.getById(req.params.id),
      orderService.itemsForOrder(req.params.id),
    ]);
    res.json({ order, items });
  }),

  markInTransit: asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.markInTransit(req.params.id);
    res.json({ order });
  }),

  markDelivered: asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.markDelivered(req.params.id, req.user!.id);
    res.json({ order });
  }),
};
