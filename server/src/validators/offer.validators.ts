import { z } from "zod";

export const createOfferSchema = z.object({
  listingId: z.string().uuid(),
  offeredPricePerKg: z.number().positive(),
  quantityKg: z.number().positive(),
});

export const respondOfferSchema = z.object({
  action: z.enum(["accept", "reject", "counter"]),
  counterPricePerKg: z.number().positive().optional(),
  note: z.string().max(300).optional(),
}).refine((d) => d.action !== "counter" || d.counterPricePerKg !== undefined, {
  message: "counterPricePerKg is required when countering",
  path: ["counterPricePerKg"],
});
