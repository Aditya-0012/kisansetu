import { Request, Response } from "express";
import { notificationService } from "../services/notification.service";
import { asyncHandler } from "../middleware/errorHandler";

export const notificationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await notificationService.listForUser(req.user!.id);
    res.json(result);
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationService.markRead(req.params.id, req.user!.id);
    res.status(204).send();
  }),

  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationService.markAllRead(req.user!.id);
    res.status(204).send();
  }),
};
