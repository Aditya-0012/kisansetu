import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../utils/logger";

let transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  if (env.SMTP_SERVICE === "gmail" && env.SMTP_USER && env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.SMTP_USER.trim(),
        pass: env.SMTP_PASS.replace(/\s+/g, ""),
      },
    });
    logger.info("[Email] Using Gmail SMTP transporter");
  } else if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER.trim(),
        pass: env.SMTP_PASS.trim(),
      },
    });
    logger.info(`[Email] Using SMTP transporter (${env.SMTP_HOST}:${env.SMTP_PORT})`);
  } else {
    // Development fallback using Ethereal test account so emails are realistically processed and viewable
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      logger.info("[Email] Created Ethereal test mailer");
    } catch {
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      logger.info("[Email] Using local JSON mail transporter");
    }
  }

  return transporter;
}

export const emailService = {
  async sendOtpEmail(toEmail: string, code: string): Promise<{ success: boolean; previewUrl?: string }> {
    try {
      const transport = await getTransporter();

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #2b5329; font-size: 24px; margin: 0; font-weight: bold;">KisanSetu</h1>
            <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">India's Direct Farm-to-Market Network</p>
          </div>
          <div style="padding: 20px; background-color: #f9fafb; border-radius: 8px; text-align: center;">
            <h2 style="color: #111827; font-size: 18px; margin-top: 0;">Account Verification</h2>
            <p style="color: #4b5563; font-size: 14px;">Your one-time verification code is:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2b5329; padding: 12px; background-color: #ffffff; border: 1px dashed #2b5329; border-radius: 6px; display: inline-block; margin: 12px 0;">
              ${code}
            </div>
            <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">
              This code is valid for 10 minutes. Do not share this OTP with anyone.
            </p>
          </div>
          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 24px;">
            If you did not request this code, you can safely ignore this email.
          </p>
        </div>
      `;

      const info = await transport.sendMail({
        from: env.SMTP_FROM || '"KisanSetu" <noreply@kisansetu.com>',
        to: toEmail,
        subject: `Your KisanSetu Verification Code: ${code}`,
        text: `Your KisanSetu verification OTP is: ${code}. Valid for 10 minutes.`,
        html,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);

      console.log(`\n======================================================`);
      console.log(`✉️  [EMAIL OTP DISPATCH]`);
      console.log(`   To: ${toEmail}`);
      console.log(`   Code: ${code}`);
      if (previewUrl) console.log(`   View Email in Browser: ${previewUrl}`);
      console.log(`======================================================\n`);

      return { success: true, previewUrl: previewUrl || undefined };
    } catch (err) {
      logger.error("[Email] Failed to send OTP email", { error: String(err) });
      console.log(`\n======================================================`);
      console.log(`✉️  [EMAIL OTP (LOCAL)]`);
      console.log(`   To: ${toEmail}`);
      console.log(`   Code: ${code}`);
      console.log(`======================================================\n`);
      return { success: true };
    }
  },
};
