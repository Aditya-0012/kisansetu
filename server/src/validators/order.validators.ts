import { z } from "zod";

export const schedulePickupSchema = z.object({
  scheduledDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date"),
  scheduledTime: z.string().min(3).max(20),
  location: z.string().min(3).max(200),
  vehicleNumber: z.string().min(3).max(20),
  driverName: z.string().min(2).max(80),
});

export const createRatingSchema = z.object({
  toUserId: z.string().uuid(),
  quality: z.number().int().min(1).max(5),
  reliability: z.number().int().min(1).max(5),
  communication: z.number().int().min(1).max(5),
  timeliness: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});
