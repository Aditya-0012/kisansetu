// ── Typed fetch wrapper against the KisanSetu API ───────────────────────────
// Every backend route lives under /api (see server/src/app.ts). This module
// centralizes: base URL resolution, JWT attachment, JSON parsing, and a
// consistent ApiError shape that mirrors server/src/utils/apiError.ts so the
// UI can render the same { code, message, details } contract everywhere.

import type {
  AdminDashboardSummary,
  AggregationBatch,
  AuthResponse,
  BuyerType,
  CropCategory,
  DemandForecast,
  FairPriceSuggestion,
  MandiPrice,
  NotificationRecord,
  Offer,
  OrderItemRecord,
  OrderRecord,
  PaymentRecord,
  PickupSlot,
  PriceTrendPoint,
  ProduceListing,
  PublicUser,
  Rating,
  SmsLogRecord,
  UserRole,
} from "@kisansetu/shared";

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "kisansetu.token";

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be unavailable (private mode, quota) — auth simply won't
    // persist across reloads in that case, which is acceptable degradation.
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function buildQuery(query?: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}${buildQuery(options.query)}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK_ERROR", "Could not reach the KisanSetu server. Check your connection.");
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    if (!isJson && (res.status === 404 || res.status === 405)) {
      throw new ApiRequestError(
        res.status,
        "BACKEND_NOT_CONNECTED",
        `Backend API not connected (HTTP ${res.status}). If running on Vercel, set VITE_API_URL in Vercel project settings to your backend server URL.`
      );
    }
    const err = payload?.error ?? { code: "UNKNOWN", message: "Something went wrong." };
    throw new ApiRequestError(res.status, err.code, err.message, err.details);
  }

  return payload as T;
}

// ── Auth ─────────────────────────────────────────────────────────────────
export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  buyerType?: BuyerType;
  region?: string;
  village?: string;
  latitude?: number;
  longitude?: number;
  languagePreference?: "en" | "hi" | "mr";
  otpTarget?: string;
  otpCode?: string;
}

export const authApi = {
  sendOtp: (target: string, type: "phone" | "email") =>
    request<{ success: boolean; isConfigured: boolean; devCode?: string; message?: string }>("/auth/send-otp", {
      method: "POST",
      body: { target, type },
    }),
  verifyOtp: (target: string, code: string) =>
    request<{ success: boolean; message: string }>("/auth/verify-otp", {
      method: "POST",
      body: { target, code },
    }),
  register: (payload: RegisterPayload) => request<AuthResponse>("/auth/register", { method: "POST", body: payload }),
  login: (email: string, password: string) => request<AuthResponse>("/auth/login", { method: "POST", body: { email, password } }),
  me: () => request<{ user: PublicUser }>("/auth/me"),
  updateProfile: (payload: Partial<Pick<PublicUser, "name" | "phone" | "region" | "village" | "languagePreference" | "lowConnectivityMode">>) =>
    request<{ user: PublicUser }>("/auth/me", { method: "PATCH", body: payload }),
};

// ── Listings ─────────────────────────────────────────────────────────────
export interface ListingSearchParams {
  crop?: string;
  region?: string;
  minPrice?: number;
  maxPrice?: number;
  minQuantity?: number;
  quality?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | boolean | undefined | null;
}

export interface ListingSearchResult {
  listings: ProduceListing[];
  total: number;
  page: number;
  pageSize: number;
}

export const listingApi = {
  search: (params: ListingSearchParams = {}) => request<ListingSearchResult>("/listings", { query: params }),
  mine: () => request<{ listings: ProduceListing[] }>("/listings/mine"),
  getById: (id: string) => request<{ listing: ProduceListing }>(`/listings/${id}`),
  create: (payload: Partial<ProduceListing> & { crop: string; quantityKg: number; expectedPricePerKg: number; harvestDate: string; quality: string; region: string }) =>
    request<{ listing: ProduceListing }>("/listings", { method: "POST", body: payload }),
  update: (id: string, payload: Partial<ProduceListing>) => request<{ listing: ProduceListing }>(`/listings/${id}`, { method: "PATCH", body: payload }),
};

// ── Prices ───────────────────────────────────────────────────────────────
export const priceApi = {
  all: () => request<{ prices: MandiPrice[] }>("/prices"),
  current: (crop: string) => request<{ price: MandiPrice }>(`/prices/${crop}`),
  trend: (crop: string, region?: string) => request<{ trend: PriceTrendPoint[] }>(`/prices/${crop}/trend`, { query: { region } }),
  fairPrice: (crop: string, region?: string) => request<{ suggestion: FairPriceSuggestion }>(`/prices/${crop}/fair-price`, { query: { region } }),
};

// ── Forecast ─────────────────────────────────────────────────────────────
export const forecastApi = {
  get: (crop: CropCategory | string, region?: string, horizonDays?: number) =>
    request<{ forecast: DemandForecast }>(`/forecast/${crop}`, { query: { region, horizonDays } }),
};

// ── Aggregation ──────────────────────────────────────────────────────────
export const aggregationApi = {
  find: (payload: { crop: string; requiredQuantityKg: number; destinationRegion: string; maxDistanceKm?: number }) =>
    request<{ batch: AggregationBatch; analysis: { listingsAnalyzed: number; supplyGapKg: number; fullyFulfilled: boolean } }>(
      "/aggregation/find",
      { method: "POST", body: payload }
    ),
  getById: (id: string) => request<{ batch: AggregationBatch }>(`/aggregation/${id}`),
  confirm: (id: string) => request<{ order: OrderRecord }>(`/aggregation/${id}/confirm`, { method: "POST" }),
};

// ── Offers ───────────────────────────────────────────────────────────────
export const offerApi = {
  list: () => request<{ offers: Offer[] }>("/offers"),
  getById: (id: string) => request<{ offer: Offer }>(`/offers/${id}`),
  create: (payload: { listingId: string; offeredPricePerKg: number; quantityKg: number }) =>
    request<{ offer: Offer }>("/offers", { method: "POST", body: payload }),
  respond: (id: string, payload: { action: "accept" | "reject" | "counter"; counterPricePerKg?: number; note?: string }) =>
    request<{ offer: Offer }>(`/offers/${id}`, { method: "PATCH", body: payload }),
  confirmOrder: (id: string) => request<{ order: OrderRecord }>(`/offers/${id}/confirm-order`, { method: "POST" }),
};

// ── Orders ───────────────────────────────────────────────────────────────
export const orderApi = {
  list: () => request<{ orders: OrderRecord[] }>("/orders"),
  getById: (id: string) => request<{ order: OrderRecord; items: OrderItemRecord[] }>(`/orders/${id}`),
  markInTransit: (id: string) => request<{ order: OrderRecord }>(`/orders/${id}/in-transit`, { method: "POST" }),
  markDelivered: (id: string) => request<{ order: OrderRecord }>(`/orders/${id}/deliver`, { method: "POST" }),
};

// ── Payments ─────────────────────────────────────────────────────────────
// Note: despite the /payments/:id/release path, the server's release handler
// (paymentController.release -> orderService.releasePayment) keys off the
// ORDER id, not a separate payment id — there's exactly one escrow payment
// per order, so the order id is what identifies it end-to-end.
export const paymentApi = {
  release: (orderId: string) =>
    request<{ order: OrderRecord; payment: PaymentRecord; disclaimer: string }>(`/payments/${orderId}/release`, { method: "POST" }),
};

// ── Pickups ──────────────────────────────────────────────────────────────
export const pickupApi = {
  upcoming: () => request<{ pickups: PickupSlot[] }>("/pickups"),
  forOrder: (orderId: string) => request<{ pickup: PickupSlot | null; events: unknown[] }>(`/pickups/${orderId}`),
  schedule: (orderId: string, payload: { scheduledDate: string; scheduledTime: string; location: string; vehicleNumber: string; driverName: string }) =>
    request<{ order: OrderRecord; pickup: PickupSlot }>(`/pickups/${orderId}`, { method: "POST", body: payload }),
};

// ── Notifications ────────────────────────────────────────────────────────
export const notificationApi = {
  list: () => request<{ notifications: NotificationRecord[]; unreadCount: number }>("/notifications"),
  // Both mark-read endpoints reply 204 No Content — nothing to parse.
  markRead: (id: string) => request<void>(`/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => request<void>("/notifications/read-all", { method: "POST" }),
};

// ── SMS (admin demo utility) ─────────────────────────────────────────────
export const smsApi = {
  test: (phone: string) => request<{ status: string; provider: string }>("/sms/test", { method: "POST", body: { phone } }),
};

// ── Admin ────────────────────────────────────────────────────────────────
export interface GmvPoint {
  day: string;
  gmv: number;
  orders: number;
}
export interface CropActivityPoint {
  crop: CropCategory;
  listings: number;
  supplyKg: number;
}
export interface RegionalActivityPoint {
  region: string;
  listings: number;
  supplyKg: number;
}
export interface AdminForecastSnapshot {
  crop: CropCategory;
  region: string;
  horizonDays: number;
  expectedDemandKg: number;
  lowerBoundKg: number;
  upperBoundKg: number;
  growthPercent: number;
  confidence: number;
  trend: "rising" | "falling" | "stable";
  methodology: "internal_fallback" | "ml_service";
  modelName: string;
  generatedAt: string;
}
export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
export interface SmsMetrics {
  sent: number;
  delivered: number;
  failed: number;
}

export const adminApi = {
  dashboard: () =>
    request<{ summary: AdminDashboardSummary; gmvSeries: GmvPoint[]; cropActivity: CropActivityPoint[]; regionalActivity: RegionalActivityPoint[] }>(
      "/admin/dashboard"
    ),
  forecast: () => request<{ forecasts: AdminForecastSnapshot[] }>("/admin/forecast"),
  batches: () => request<{ batches: AggregationBatch[] }>("/admin/batches"),
  prices: () => request<{ prices: MandiPrice[] }>("/admin/prices"),
  smsLogs: () => request<{ metrics: SmsMetrics; recent: SmsLogRecord[] }>("/admin/sms-logs"),
  auditLog: () => request<{ logs: AuditLogEntry[] }>("/admin/audit-log"),
};

// ── Ratings ──────────────────────────────────────────────────────────────
export const ratingApi = {
  submit: (orderId: string, payload: { toUserId: string; quality: number; reliability: number; communication: number; timeliness: number; comment?: string }) =>
    request<{ rating: Rating }>(`/ratings/order/${orderId}`, { method: "POST", body: payload }),
  forOrder: (orderId: string) => request<{ ratings: Rating[] }>(`/ratings/order/${orderId}`),
  forUser: (userId: string) => request<{ ratings: Rating[]; average: number }>(`/ratings/user/${userId}`),
};

export { request };
