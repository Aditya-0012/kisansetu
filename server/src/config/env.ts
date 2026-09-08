import dotenv from "dotenv";
dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: required(
    "DATABASE_URL",
    "postgres://kisansetu:kisansetu_dev_pw@localhost:5432/kisansetu"
  ),
  JWT_SECRET: required(
    "JWT_SECRET",
    "change_this_in_production_to_a_long_random_string"
  ),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",

  SMS_PROVIDER: (process.env.SMS_PROVIDER ?? "mock") as "mock" | "fast2sms" | "twilio",
  FAST2SMS_API_KEY: process.env.FAST2SMS_API_KEY ?? "",
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "",
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER ?? "",

  MANDI_API_URL: process.env.MANDI_API_URL ?? "",
  MANDI_API_KEY: process.env.MANDI_API_KEY ?? "",

  ML_SERVICE_URL: process.env.ML_SERVICE_URL ?? "http://localhost:8000",

  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  SMTP_FROM: process.env.SMTP_FROM ?? '"KisanSetu" <noreply@kisansetu.com>',
  SMTP_SERVICE: process.env.SMTP_SERVICE ?? "",
};

export const isProd = env.NODE_ENV === "production";
