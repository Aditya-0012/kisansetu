import { Router } from "express";
import { authRoutes } from "./auth.routes";
import { listingRoutes } from "./listing.routes";
import { priceRoutes } from "./price.routes";
import { forecastRoutes } from "./forecast.routes";
import { aggregationRoutes } from "./aggregation.routes";
import { offerRoutes } from "./offer.routes";
import { orderRoutes } from "./order.routes";
import { paymentRoutes } from "./payment.routes";
import { pickupRoutes } from "./pickup.routes";
import { notificationRoutes } from "./notification.routes";
import { smsRoutes } from "./sms.routes";
import { adminRoutes } from "./admin.routes";
import { ratingRoutes } from "./rating.routes";

export const router = Router();

router.get("/", (_req, res) => {
  res.json({
    message: "KisanSetu API Root",
    modules: [
      "/api/auth",
      "/api/listings",
      "/api/prices",
      "/api/forecast",
      "/api/aggregation",
      "/api/offers",
      "/api/orders",
      "/api/payments",
      "/api/pickups",
      "/api/notifications",
      "/api/sms",
      "/api/admin",
      "/api/ratings",
    ],
  });
});

router.use("/auth", authRoutes);
router.use("/listings", listingRoutes);
router.use("/prices", priceRoutes);
router.use("/forecast", forecastRoutes);
router.use("/aggregation", aggregationRoutes);
router.use("/offers", offerRoutes);
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/pickups", pickupRoutes);
router.use("/notifications", notificationRoutes);
router.use("/sms", smsRoutes);
router.use("/admin", adminRoutes);
router.use("/ratings", ratingRoutes);
