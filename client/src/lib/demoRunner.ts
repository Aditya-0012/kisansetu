// ── SIH Demo Mode orchestrator ──────────────────────────────────────────
// Drives the full product loop — FORECAST → INFORM → LIST → DISCOVER →
// AGGREGATE → NEGOTIATE → ORDER → LOGISTICS → ESCROW → DELIVER → SETTLE →
// LEARN — against the *real* running API, using the three seeded demo
// accounts. It deliberately does not touch the shared auth token in
// localStorage (so it never disturbs whoever is actually logged into the
// app in another tab) — each step carries its own bearer token explicitly.

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

class DemoApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call<T>(path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    throw new DemoApiError(payload?.error?.message ?? `Request failed (${res.status})`, res.status);
  }
  return payload as T;
}

async function login(email: string): Promise<{ token: string; userId: string; name: string }> {
  const { token, user } = await call<{ token: string; user: { id: string; name: string } }>("/auth/login", {
    method: "POST",
    body: { email, password: "Demo@123" },
  });
  return { token, userId: user.id, name: user.name };
}

export interface DemoStepResult {
  headline: string;
  detail: string;
  data?: Record<string, string | number>;
}

export interface DemoStep {
  key: string;
  stage: string;
  title: string;
  run: (ctx: DemoContext) => Promise<DemoStepResult>;
}

interface DemoContext {
  farmer: { token: string; userId: string; name: string };
  buyer: { token: string; userId: string; name: string };
  admin: { token: string; userId: string; name: string };
  vars: Record<string, any>;
}

const CROP = "tomato";
const REGION = "Pune";

export const DEMO_STEPS: DemoStep[] = [
  {
    key: "forecast",
    stage: "FORECAST",
    title: "Read tomorrow's demand",
    async run(ctx) {
      const { forecast } = await call<{ forecast: any }>(`/forecast/${CROP}?region=${REGION}&horizonDays=14`, { token: ctx.farmer.token });
      ctx.vars.forecast = forecast;
      return {
        headline: `${forecast.trend === "rising" ? "Rising" : forecast.trend === "falling" ? "Falling" : "Stable"} demand for tomato in Pune`,
        detail: forecast.recommendation,
        data: { "Expected demand": `${forecast.expectedDemandKg.toFixed(0)} kg`, "Confidence": `${Math.round(forecast.confidence * 100)}%` },
      };
    },
  },
  {
    key: "inform",
    stage: "INFORM",
    title: "Get a fair-price suggestion",
    async run(ctx) {
      const { suggestion } = await call<{ suggestion: any }>(`/prices/${CROP}/fair-price?region=${REGION}`, { token: ctx.farmer.token });
      ctx.vars.suggestion = suggestion;
      return {
        headline: `Suggested price: ₹${suggestion.suggestedMin.toFixed(0)}–₹${suggestion.suggestedMax.toFixed(0)}/kg`,
        detail: suggestion.recommendation,
        data: { "Mandi price": `₹${suggestion.mandiPrice.toFixed(0)}`, "Demand level": suggestion.demandLevel },
      };
    },
  },
  {
    key: "list",
    stage: "LIST",
    title: "Farmer publishes a listing",
    async run(ctx) {
      const price = ctx.vars.suggestion?.suggestedMax ?? 24;
      const { listing } = await call<{ listing: any }>("/listings", {
        method: "POST",
        token: ctx.farmer.token,
        body: {
          crop: CROP,
          quantityKg: 140,
          expectedPricePerKg: Number(price.toFixed(2)),
          harvestDate: new Date().toISOString().slice(0, 10),
          quality: "A",
          region: REGION,
          description: "Fresh from the SIH live demo run.",
        },
      });
      ctx.vars.listing = listing;
      return {
        headline: `${ctx.farmer.name} listed 140kg of tomato at ₹${listing.expectedPricePerKg}/kg`,
        detail: "Listing is now live on the marketplace for buyers to discover.",
        data: { Listing: listing.id.slice(0, 8), Grade: listing.quality },
      };
    },
  },
  {
    key: "discover",
    stage: "DISCOVER",
    title: "Buyer discovers the marketplace",
    async run(ctx) {
      const results = await call<{ listings: any[]; total: number }>(`/listings?crop=${CROP}&region=${REGION}&pageSize=50`, { token: ctx.buyer.token });
      ctx.vars.marketplace = results;
      return {
        headline: `${results.total} active tomato listings found in ${REGION}`,
        detail: "The buyer can browse individually, or let the Smart Aggregation Engine assemble a bulk batch automatically.",
        data: { "Listings": results.total },
      };
    },
  },
  {
    key: "aggregate",
    stage: "AGGREGATE",
    title: "Smart Aggregation Engine assembles a batch",
    async run(ctx) {
      const { batch, analysis } = await call<{ batch: any; analysis: any }>("/aggregation/find", {
        method: "POST",
        token: ctx.buyer.token,
        body: { crop: CROP, requiredQuantityKg: 300, destinationRegion: REGION },
      });
      ctx.vars.batch = batch;
      return {
        headline: `${batch.contributions.length} farmers combined into one ${batch.fulfilledQuantityKg}kg batch`,
        detail: `${analysis.listingsAnalyzed} listings analyzed · weighted price ₹${batch.weightedPricePerKg.toFixed(2)}/kg`,
        data: { "Farmers combined": batch.contributions.length, "Estimated total": `₹${batch.estimatedTotal.toLocaleString("en-IN")}` },
      };
    },
  },
  {
    key: "negotiate",
    stage: "NEGOTIATE",
    title: "Direct offer & negotiation engine",
    async run(ctx) {
      // Use the listing the demo farmer just created (LIST step) rather than
      // a random marketplace listing — respond/accept below requires the
      // accepting token to belong to the listing's actual owner, and the
      // demo farmer account is only guaranteed to own its own listing.
      const candidate = ctx.vars.listing;
      const offerPrice = Number((candidate.expectedPricePerKg * 0.95).toFixed(2));
      const { offer } = await call<{ offer: any }>("/offers", {
        method: "POST",
        token: ctx.buyer.token,
        body: { listingId: candidate.id, offeredPricePerKg: offerPrice, quantityKg: Math.min(20, candidate.remainingQuantityKg) },
      });
      const { offer: accepted } = await call<{ offer: any }>(`/offers/${offer.id}`, {
        method: "PATCH",
        token: ctx.farmer.token,
        body: { action: "accept" },
      });
      ctx.vars.negotiatedOffer = accepted;
      return {
        headline: `Farmer accepted a direct offer at ₹${offerPrice}/kg`,
        detail: "Offers, counter-offers, and acceptance all run independently of the aggregation batch — buyers can negotiate one-to-one whenever they prefer.",
        data: { "Offer status": accepted.status },
      };
    },
  },
  {
    key: "order",
    stage: "ORDER",
    title: "Confirm order & hold payment in escrow",
    async run(ctx) {
      const { order } = await call<{ order: any }>(`/aggregation/${ctx.vars.batch.id}/confirm`, { method: "POST", token: ctx.buyer.token });
      ctx.vars.order = order;
      return {
        headline: `Order ${order.orderCode} confirmed`,
        detail: `₹${order.totalAmount.toLocaleString("en-IN")} moved into demo escrow — held until delivery is confirmed.`,
        data: { Status: order.status.replace(/_/g, " ") },
      };
    },
  },
  {
    key: "logistics",
    stage: "LOGISTICS",
    title: "Schedule pickup logistics",
    async run(ctx) {
      const { pickup } = await call<{ order: any; pickup: any }>(`/pickups/${ctx.vars.order.id}`, {
        method: "POST",
        token: ctx.buyer.token,
        body: {
          scheduledDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          scheduledTime: "09:00 AM",
          location: `${REGION} Collection Center`,
          vehicleNumber: "MH12-DEMO-01",
          driverName: "Suresh Patil",
        },
      });
      ctx.vars.pickup = pickup;
      return {
        headline: `Pickup scheduled at ${pickup.location}`,
        detail: `Vehicle ${pickup.vehicleNumber} · Driver ${pickup.driverName} · ${pickup.scheduledDate} ${pickup.scheduledTime}`,
      };
    },
  },
  {
    key: "escrow",
    stage: "ESCROW",
    title: "Verify escrow hold",
    async run(ctx) {
      const { order } = await call<{ order: any; items: any[] }>(`/orders/${ctx.vars.order.id}`, { token: ctx.buyer.token });
      return {
        headline: "Payment confirmed held in demo escrow",
        detail: "No real money moves in this environment — the escrow is a simulated hold/release ledger for demonstration.",
        data: { "Order status": order.status.replace(/_/g, " ") },
      };
    },
  },
  {
    key: "deliver",
    stage: "DELIVER",
    title: "In transit → delivered",
    async run(ctx) {
      await call(`/orders/${ctx.vars.order.id}/in-transit`, { method: "POST", token: ctx.buyer.token });
      const { order } = await call<{ order: any }>(`/orders/${ctx.vars.order.id}/deliver`, { method: "POST", token: ctx.buyer.token });
      ctx.vars.order = order;
      return {
        headline: "Delivery confirmed by buyer",
        detail: "The order has moved through pickup, transit, and delivery confirmation.",
        data: { Status: order.status.replace(/_/g, " ") },
      };
    },
  },
  {
    key: "settle",
    stage: "SETTLE",
    title: "Release escrow & settle farmers",
    async run(ctx) {
      const { order, payment } = await call<{ order: any; payment: any }>(`/payments/${ctx.vars.order.id}/release`, {
        method: "POST",
        token: ctx.buyer.token,
      });
      ctx.vars.order = order;
      return {
        headline: `₹${payment.amount.toLocaleString("en-IN")} released to ${payment.allocations.length} farmers`,
        detail: "Each farmer's share is computed from their exact contribution to the batch — transparent, to the rupee.",
        data: { Status: order.status.replace(/_/g, " ") },
      };
    },
  },
  {
    key: "learn",
    stage: "LEARN",
    title: "The platform updates its intelligence",
    async run(ctx) {
      const { summary } = await call<{ summary: any }>("/admin/dashboard", { token: ctx.admin.token });
      return {
        headline: "Admin Intelligence Center reflects the completed order",
        detail: "This transaction now feeds future demand forecasts and price intelligence — the loop closes and starts again.",
        data: { "Total GMV": `₹${summary.gmv.toLocaleString("en-IN")}`, "Completed deliveries": summary.successfulDeliveries },
      };
    },
  },
];

export async function loginDemoActors(): Promise<Pick<DemoContext, "farmer" | "buyer" | "admin">> {
  const [farmer, buyer, admin] = await Promise.all([
    login("farmer@kisansetu.demo"),
    login("buyer@kisansetu.demo"),
    login("admin@kisansetu.demo"),
  ]);
  return { farmer, buyer, admin };
}

export function createDemoContext(actors: Pick<DemoContext, "farmer" | "buyer" | "admin">): DemoContext {
  return { ...actors, vars: {} };
}

export { DemoApiError };
export type { DemoContext };
