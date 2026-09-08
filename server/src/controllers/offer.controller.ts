import { Request, Response } from "express";
import { offerService } from "../services/offer.service";
import { orderService } from "../services/order.service";
import { asyncHandler } from "../middleware/errorHandler";
import { UserRole } from "@kisansetu/shared";

export const offerController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const offer = await offerService.create(req.user!.id, req.body);
    res.status(201).json({ offer });
  }),

  respond: asyncHandler(async (req: Request, res: Response) => {
    const role = req.user!.role === UserRole.FARMER ? "farmer" : "buyer";
    const offer = await offerService.respond(req.params.id, req.user!.id, role, req.body);
    res.json({ offer });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const role = req.user!.role === UserRole.FARMER ? "farmer" : "buyer";
    const offers = await offerService.listForUser(req.user!.id, role);
    res.json({ offers });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const offer = await offerService.getById(req.params.id);
    res.json({ offer });
  }),

  confirmOrder: asyncHandler(async (req: Request, res: Response) => {
    const order = await orderService.confirmFromOffer(req.params.id, req.user!.id);
    res.status(201).json({ order });
  }),
};
