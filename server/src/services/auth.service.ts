import { AuthResponse } from "@kisansetu/shared";
import { userRepository, toPublicUser } from "../repositories/user.repository";
import { hashPassword, verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { auditRepository } from "../repositories/audit.repository";
import { otpService } from "./otp.service";
import { ApiError } from "../utils/apiError";
import { RegisterInput, LoginInput, UpdateProfileInput } from "../validators/auth.validators";

export const authService = {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const exists = await userRepository.existsByEmailOrPhone(input.email, input.phone);
    if (exists) throw ApiError.conflict("An account with this email or phone already exists");

    // Enforce OTP verification on phone or email
    let isPhoneVerified = otpService.isTargetVerified(input.phone);
    let isEmailVerified = otpService.isTargetVerified(input.email);

    if (!isPhoneVerified && !isEmailVerified && input.otpTarget && input.otpCode) {
      otpService.verifyOtp(input.otpTarget, input.otpCode);
      if (input.otpTarget.toLowerCase().trim() === input.phone.toLowerCase().trim()) isPhoneVerified = true;
      if (input.otpTarget.toLowerCase().trim() === input.email.toLowerCase().trim()) isEmailVerified = true;
    }

    if (!isPhoneVerified && !isEmailVerified) {
      throw ApiError.badRequest("Please verify either your phone number or email address with OTP before completing registration.");
    }

    if (isPhoneVerified) otpService.consumeVerification(input.phone);
    if (isEmailVerified) otpService.consumeVerification(input.email);

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      name: input.name, email: input.email, phone: input.phone, passwordHash: passwordHash,
      role: input.role, buyerType: input.buyerType, region: input.region, village: input.village,
      latitude: input.latitude, longitude: input.longitude, languagePreference: input.languagePreference,
    });

    await auditRepository.log(user.id, "user_registered", "user", user.id, { role: input.role });

    const token = signToken({ sub: user.id, role: user.role });
    return { token, user: toPublicUser(user) };
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await userRepository.findByEmail(input.email);
    if (!user) throw ApiError.unauthorized("Invalid email or password");

    const valid = await verifyPassword(input.password, user.password_hash);
    if (!valid) throw ApiError.unauthorized("Invalid email or password");

    const token = signToken({ sub: user.id, role: user.role });
    return { token, user: toPublicUser(user) };
  },

  async me(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound("User not found");
    return toPublicUser(user);
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await userRepository.updateProfile(userId, input);
    return toPublicUser(user);
  },
};
