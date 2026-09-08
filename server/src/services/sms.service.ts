/**
 * SMS abstraction (spec sections 32-34).
 *
 * ISMSProvider is the interface; MockSMSProvider is the default (writes to
 * sms_logs, always "succeeds" so the demo never breaks without credentials),
 * and Fast2SMSProvider / TwilioProvider are real integrations that activate
 * only when their env vars are set. smsService picks the provider once at
 * startup based on SMS_PROVIDER / which credentials are present.
 */
import { SmsEvent, SmsStatus } from "@kisansetu/shared";
import { env } from "../config/env";
import { smsRepository } from "../repositories/sms.repository";
import { logger } from "../utils/logger";

export interface SendSmsInput {
  toPhone: string;
  toName?: string;
  toUserId?: string;
  event: SmsEvent;
  message: string;
}

export interface ISMSProvider {
  readonly name: "mock" | "fast2sms" | "twilio";
  send(input: SendSmsInput): Promise<{ status: SmsStatus }>;
}

/** Always "succeeds" and just logs — this is what makes SMS a fully
 * demoable feature with zero external credentials (spec section 34). */
class MockSMSProvider implements ISMSProvider {
  readonly name = "mock" as const;
  async send(input: SendSmsInput): Promise<{ status: SmsStatus }> {
    logger.info("[MockSMS] sending", { to: input.toPhone, event: input.event });
    console.log(`\n======================================================`);
    console.log(`📱 [SMS OTP DISPATCH]`);
    console.log(`   To: ${input.toPhone}`);
    console.log(`   Message: ${input.message}`);
    console.log(`======================================================\n`);
    return { status: SmsStatus.DELIVERED };
  }
}

/** Real Fast2SMS integration — activates only when FAST2SMS_API_KEY is set. */
class Fast2SMSProvider implements ISMSProvider {
  readonly name = "fast2sms" as const;
  async send(input: SendSmsInput): Promise<{ status: SmsStatus }> {
    try {
      const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: env.FAST2SMS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "q",
          message: input.message,
          numbers: input.toPhone,
        }),
      });
      console.log(`\n======================================================`);
      console.log(`📱 [Fast2SMS API Response: ${res.status}]`);
      console.log(`======================================================\n`);
      return { status: res.ok ? SmsStatus.SENT : SmsStatus.FAILED };
    } catch (err) {
      logger.error("Fast2SMS send failed", { error: String(err) });
      return { status: SmsStatus.FAILED };
    }
  }
}

/** Real Twilio integration — activates only when Twilio env vars are set. */
class TwilioProvider implements ISMSProvider {
  readonly name = "twilio" as const;
  async send(input: SendSmsInput): Promise<{ status: SmsStatus }> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
      const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
      const body = new URLSearchParams({
        To: `+91${input.toPhone.replace(/^\+?91/, "")}`,
        From: env.TWILIO_PHONE_NUMBER,
        Body: input.message,
      });
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      console.log(`\n======================================================`);
      console.log(`📱 [Twilio API Response: ${res.status}]`);
      console.log(`======================================================\n`);
      return { status: res.ok ? SmsStatus.SENT : SmsStatus.FAILED };
    } catch (err) {
      logger.error("Twilio send failed", { error: String(err) });
      return { status: SmsStatus.FAILED };
    }
  }
}

function selectProvider(): ISMSProvider {
  if (env.FAST2SMS_API_KEY) return new Fast2SMSProvider();
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) return new TwilioProvider();
  return new MockSMSProvider();
}

const provider = selectProvider();

export const smsService = {
  providerName: provider.name,

  async send(input: SendSmsInput) {
    const { status } = await provider.send(input);
    await smsRepository.log({
      recipientPhone: input.toPhone,
      recipientName: input.toName,
      recipientUserId: input.toUserId,
      message: input.message,
      event: input.event,
      status,
      provider: provider.name,
    });
    return { status, provider: provider.name };
  },

  async sendTest(toPhone: string) {
    return this.send({
      toPhone,
      event: SmsEvent.TEST,
      message: "KisanSetu: This is a test message from the SMS Center.",
    });
  },
};
