import { Request, Response } from "express";
import { ratingService } from "../services/rating.service";
import { asyncHandler } from "../middleware/errorHandler";

export const ratingController = {
  submit: asyncHandler(async (req: Request, res: Response) => {
    const rating = await ratingService.submit(req.params.orderId, req.user!.id, req.body);
    res.status(201).json({ rating });
  }),

  forOrder: asyncHandler(async (req: Request, res: Response) => {
    res.json({ ratings: await ratingService.forOrder(req.params.orderId) });
  }),

  forUser: asyncHandler(async (req: Request, res: Response) => {
    res.json({ ratings: await ratingService.forUser(req.params.userId) });
  }),
};
