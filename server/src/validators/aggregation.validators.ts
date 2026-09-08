import { z } from "zod";
import { CropCategory } from "@kisansetu/shared";

export const findSupplySchema = z.object({
  crop: z.nativeEnum(CropCategory),
  requiredQuantityKg: z.number().positive().max(50000),
  destinationRegion: z.string().min(2),
  maxDistanceKm: z.number().positive().max(500).default(150),
});

export const confirmBatchSchema = z.object({
  batchId: z.string().uuid(),
});
