import { Request, Response } from "express";
import { listingService } from "../services/listing.service";
import { asyncHandler } from "../middleware/errorHandler";
import { ApiError } from "../utils/apiError";

export const listingController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const listing = await listingService.create(req.user!.id, req.body);
    res.status(201).json({ listing });
  }),

  search: asyncHandler(async (req: Request, res: Response) => {
    const result = await listingService.search(req.query as any);
    res.json(result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const listing = await listingService.getById(req.params.id);
    res.json({ listing });
  }),

  mine: asyncHandler(async (req: Request, res: Response) => {
    const listings = await listingService.listMine(req.user!.id);
    res.json({ listings });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const listing = await listingService.update(req.params.id, req.user.id, req.body);
    res.json({ listing });
  }),
};
