import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { otpService } from "../services/otp.service";
import { asyncHandler } from "../middleware/errorHandler";

export const authController = {
  sendOtp: asyncHandler(async (req: Request, res: Response) => {
    const { target, type } = req.body;
    const result = await otpService.sendOtp(target, type);
    res.json(result);
  }),

  verifyOtp: asyncHandler(async (req: Request, res: Response) => {
    const { target, code } = req.body;
    const result = otpService.verifyOtp(target, code);
    res.json(result);
  }),

  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    res.json(result);
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.me(req.user!.id);
    res.json({ user });
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.updateProfile(req.user!.id, req.body);
    res.json({ user });
  }),
};

