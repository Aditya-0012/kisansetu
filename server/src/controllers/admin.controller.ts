import { Request, Response } from "express";
import { adminService } from "../services/admin.service";
import { asyncHandler } from "../middleware/errorHandler";

export const adminController = {
  dashboard: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await adminService.dashboard());
  }),
  forecast: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ forecasts: await adminService.forecastMonitor() });
  }),
  batches: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ batches: await adminService.batches() });
  }),
  prices: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ prices: await adminService.priceData() });
  }),
  smsLogs: asyncHandler(async (_req: Request, res: Response) => {
    res.json(await adminService.smsCenter());
  }),
  auditLog: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ logs: await adminService.auditLog() });
  }),
};
