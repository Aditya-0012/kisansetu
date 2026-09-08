import { Request, Response } from "express";
import { orderService } from "../services/order.service";
import { asyncHandler } from "../middleware/errorHandler";
import { DEMO_PAYMENT_DISCLAIMER } from "../services/escrow.service";

export const paymentController = {
  release: asyncHandler(async (req: Request, res: Response) => {
    const result = await orderService.releasePayment(req.params.id);
    res.json({ ...result, disclaimer: DEMO_PAYMENT_DISCLAIMER });
  }),
};
