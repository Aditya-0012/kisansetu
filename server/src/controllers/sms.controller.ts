import { Request, Response } from "express";
import { smsService } from "../services/sms.service";
import { asyncHandler } from "../middleware/errorHandler";

export const smsController = {
  test: asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.body;
    const result = await smsService.sendTest(phone);
    res.json(result);
  }),
};
