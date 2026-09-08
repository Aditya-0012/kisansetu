import { SmsEvent } from "@kisansetu/shared";
import { env } from "../config/env";
import { smsService } from "./sms.service";
import { emailService } from "./email.service";
import { logger } from "../utils/logger";
import { ApiError } from "../utils/apiError";

interface OtpRecord {
  code: string;
  type: "phone" | "email";
  expiresAt: number;
  attempts: number;
}

const otps = new Map<string, OtpRecord>();
const verifiedTargets = new Map<string, number>();

function normalizeTarget(target: string): string {
  return target.trim().toLowerCase();
}

export const otpService = {
  async sendOtp(target: string, type: "phone" | "email"): Promise<{
    success: boolean;
    target: string;
    type: string;
    message: string;
    isConfigured: boolean;
    devCode?: string;
  }> {
    if (!target) throw ApiError.badRequest("Target phone number or email address is required");
    const normalized = normalizeTarget(target);

    // Generate 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otps.set(normalized, {
      code,
      type,
      expiresAt,
      attempts: 0,
    });

    logger.info(`[OTP] Generated OTP for ${normalized} (${type}): ${code}`);

    const isSmtpConfigured = Boolean(
      (env.SMTP_SERVICE === "gmail" && env.SMTP_USER && env.SMTP_PASS) ||
      (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)
    );
    const isSmsConfigured = Boolean(
      env.FAST2SMS_API_KEY ||
      (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN)
    );
    const isConfigured = type === "email" ? isSmtpConfigured : isSmsConfigured;

    if (type === "phone") {
      await smsService.send({
        toPhone: target,
        event: SmsEvent.TEST,
        message: `Your KisanSetu verification OTP is ${code}. Valid for 10 minutes. Do not share this OTP with anyone.`,
      }).catch((err) => logger.warn(`Failed to send SMS OTP: ${String(err)}`));
    } else {
      await emailService.sendOtpEmail(target, code).catch((err) =>
        logger.warn(`Failed to send Email OTP: ${String(err)}`)
      );
    }

    return {
      success: true,
      target,
      type,
      isConfigured,
      devCode: !isConfigured ? code : undefined,
      message: isConfigured
        ? `A 6-digit verification code was sent to ${target}. Valid for 10 minutes.`
        : `External ${type === "email" ? "SMTP/Gmail" : "SMS"} provider not configured in server/.env. Verification code provided for local testing.`,
    };
  },

  verifyOtp(target: string, code: string): { success: boolean; message: string } {
    if (!target || !code) throw ApiError.badRequest("Target and OTP code are required");
    const normalized = normalizeTarget(target);
    const entry = otps.get(normalized);

    if (!entry) {
      throw ApiError.badRequest("No OTP was requested for this phone/email or it has expired.");
    }

    if (Date.now() > entry.expiresAt) {
      otps.delete(normalized);
      throw ApiError.badRequest("OTP code has expired. Please request a new one.");
    }

    if (entry.attempts >= 5) {
      otps.delete(normalized);
      throw ApiError.badRequest("Too many incorrect attempts. Please request a new OTP.");
    }

    if (entry.code !== code.trim()) {
      entry.attempts++;
      throw ApiError.badRequest("Invalid OTP code. Please try again.");
    }

    // OTP is valid
    otps.delete(normalized);
    verifiedTargets.set(normalized, Date.now() + 30 * 60 * 1000); // 30 minutes verification window
    logger.info(`[OTP] Successfully verified ${normalized}`);

    return {
      success: true,
      message: "Phone/email verified successfully",
    };
  },

  isTargetVerified(target: string): boolean {
    if (!target) return false;
    const normalized = normalizeTarget(target);
    const validUntil = verifiedTargets.get(normalized);
    if (!validUntil) return false;
    if (Date.now() > validUntil) {
      verifiedTargets.delete(normalized);
      return false;
    }
    return true;
  },

  consumeVerification(target: string) {
    if (!target) return;
    verifiedTargets.delete(normalizeTarget(target));
  },
};
