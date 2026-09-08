import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { apiLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { router } from "./routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(apiLimiter);

  app.get("/", (_req: Request, res: Response) => {
    res.json({
      name: "KisanSetu API",
      status: "online",
      version: "0.1.0",
      description: "India's Intelligent Direct Farm-to-Market Network",
      frontend: "http://localhost:5173",
      endpoints: {
        health: "/health",
        api: "/api",
        listings: "/api/listings",
        prices: "/api/prices/all",
        forecast: "/api/forecast?crop=tomato&region=Nashik",
      },
    });
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "kisansetu-api", time: new Date().toISOString() });
  });

  app.use("/api", router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
