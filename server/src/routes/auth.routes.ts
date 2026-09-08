import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { validateBody } from "../middleware/validate";
import { registerSchema, loginSchema, updateProfileSchema, sendOtpSchema, verifyOtpSchema } from "../validators/auth.validators";
import { requireAuth } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimit";

export const authRoutes = Router();

authRoutes.post("/send-otp", authLimiter, validateBody(sendOtpSchema), authController.sendOtp);
authRoutes.post("/verify-otp", authLimiter, validateBody(verifyOtpSchema), authController.verifyOtp);
authRoutes.post("/register", authLimiter, validateBody(registerSchema), authController.register);
authRoutes.post("/login", authLimiter, validateBody(loginSchema), authController.login);
authRoutes.get("/me", requireAuth, authController.me);
authRoutes.patch("/me", requireAuth, validateBody(updateProfileSchema), authController.updateProfile);

