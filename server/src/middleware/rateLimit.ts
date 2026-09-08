import rateLimit from "express-rate-limit";

/** General API limiter — generous, just there to blunt abuse/scraping. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } },
});

/** Limiter for auth endpoints — relaxed in development so users and tests are not locked out. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  skip: () => process.env.NODE_ENV === "development",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } },
});
