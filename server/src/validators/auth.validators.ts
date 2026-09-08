import { z } from "zod";
import { BuyerType, UserRole } from "@kisansetu/shared";

export const registerSchema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    phone: z
      .string()
      .regex(/^[0-9]{10,13}$/, "Enter a valid phone number"),
    password: z.string().min(6).max(72),
    role: z.nativeEnum(UserRole),
    buyerType: z.nativeEnum(BuyerType).optional(),
    region: z.string().optional(),
    village: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    languagePreference: z.enum(["en", "hi", "mr"]).default("en"),
    otpTarget: z.string().optional(),
    otpCode: z.string().optional(),
  })
  .refine((data) => data.role !== UserRole.BUYER || !!data.buyerType, {
    message: "buyerType is required when role is buyer",
    path: ["buyerType"],
  });

export const sendOtpSchema = z.object({
  target: z.string().min(3, "Enter phone or email"),
  type: z.enum(["phone", "email"]),
});

export const verifyOtpSchema = z.object({
  target: z.string().min(3, "Enter phone or email"),
  code: z.string().min(4, "Enter valid OTP code").max(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z
    .string()
    .regex(/^[0-9]{10,13}$/, "Enter a valid phone number")
    .optional(),
  region: z.string().optional(),
  village: z.string().optional(),
  languagePreference: z.enum(["en", "hi", "mr"]).optional(),
  lowConnectivityMode: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

