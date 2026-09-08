import { z } from "zod";
import { CropCategory, QualityGrade } from "@kisansetu/shared";

export const createListingSchema = z.object({
  crop: z.nativeEnum(CropCategory),
  variety: z.string().max(80).optional(),
  quantityKg: z.number().positive().max(50000),
  expectedPricePerKg: z.number().positive().max(10000),
  harvestDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date"),
  quality: z.nativeEnum(QualityGrade),
  region: z.string().min(2),
  village: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  description: z.string().max(1000).optional(),
  photoUrl: z.string().url().optional(),
});

export const listQuerySchema = z.object({
  crop: z.nativeEnum(CropCategory).optional(),
  region: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minQuantity: z.coerce.number().optional(),
  quality: z.nativeEnum(QualityGrade).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const updateListingSchema = z.object({
  expectedPricePerKg: z.number().positive().optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(["active", "withdrawn"]).optional(),
});
