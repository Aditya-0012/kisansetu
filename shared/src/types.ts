// ── Shared entity/DTO types ─────────────────────────────────────────────
// These mirror the Postgres schema (see server/src/db/migrations) closely
// enough to type API payloads without duplicating logic on both sides.

import {
  BatchStatus,
  BuyerType,
  CropCategory,
  ListingStatus,
  NotificationType,
  OfferStatus,
  OrderStatus,
  PaymentStatus,
  PickupStatus,
  QualityGrade,
  SmsEvent,
  SmsStatus,
  UserRole,
} from "./enums";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  buyerType?: BuyerType | null;
  region?: string | null;
  village?: string | null;
  languagePreference: "en" | "hi" | "mr";
  lowConnectivityMode: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface ProduceListing {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerRating: number;
  crop: CropCategory;
  variety?: string | null;
  quantityKg: number;
  remainingQuantityKg: number;
  unit: string;
  expectedPricePerKg: number;
  harvestDate: string;
  quality: QualityGrade;
  region: string;
  village?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  photoUrl?: string | null;
  status: ListingStatus;
  createdAt: string;
}

export interface MandiPrice {
  crop: CropCategory;
  region: string;
  mandiName: string;
  pricePerKg: number;
  previousPricePerKg: number;
  changePercent: number;
  updatedAt: string;
  source: "government" | "seeded";
}

export interface PriceTrendPoint {
  date: string;
  pricePerKg: number;
}

export interface FairPriceSuggestion {
  crop: CropCategory;
  region: string;
  mandiPrice: number;
  nearbyMandiAverage: number;
  thirtyDayAverage: number;
  demandLevel: "low" | "moderate" | "high";
  suggestedMin: number;
  suggestedMax: number;
  recommendation: string;
}

export interface ForecastPoint {
  date: string;
  actual: number | null;
  forecast: number | null;
  lowerBound: number | null;
  upperBound: number | null;
}

export interface DemandForecast {
  crop: CropCategory;
  region: string;
  horizonDays: number;
  expectedDemandKg: number;
  currentSupplyKg: number;
  supplyGapKg: number;
  growthPercent: number;
  confidence: number;
  trend: "rising" | "falling" | "stable";
  recommendation: string;
  methodology: "internal_fallback" | "ml_service";
  modelName: string;
  series: ForecastPoint[];
  generatedAt: string;
}

export interface AggregationFarmerContribution {
  listingId: string;
  farmerId: string;
  farmerName: string;
  quantityKg: number;
  pricePerKg: number;
  subtotal: number;
  distanceKm: number;
  farmerRating: number;
}

export interface AggregationBatch {
  id: string;
  batchCode: string;
  crop: CropCategory;
  requestedQuantityKg: number;
  fulfilledQuantityKg: number;
  destinationRegion: string;
  averageDistanceKm: number;
  weightedPricePerKg: number;
  estimatedTotal: number;
  status: BatchStatus;
  buyerId?: string | null;
  contributions: AggregationFarmerContribution[];
  listingsAnalyzed: number;
  createdAt: string;
}

export interface Offer {
  id: string;
  listingId: string;
  buyerId: string;
  farmerId: string;
  offeredPricePerKg: number;
  quantityKg: number;
  status: OfferStatus;
  history: OfferHistoryEntry[];
  createdAt: string;
  crop?: CropCategory | string;
  farmerName?: string;
  buyerName?: string;
}

export interface OfferHistoryEntry {
  actor: "buyer" | "farmer";
  action: "offer" | "counter" | "accept" | "reject";
  pricePerKg: number;
  note?: string;
  at: string;
}

export interface OrderRecord {
  id: string;
  orderCode: string;
  buyerId: string;
  crop: CropCategory;
  totalQuantityKg: number;
  agreedPricePerKg: number;
  totalAmount: number;
  status: OrderStatus;
  aggregationBatchId?: string | null;
  createdAt: string;
  updatedAt: string;
  // Present only on a farmer-scoped order list (GET /orders as a farmer):
  // this farmer's own slice of a possibly multi-farmer order, since the
  // order-level totals above describe the whole order, not their share.
  farmerQuantityKg?: number;
  farmerSubtotal?: number;
  pickup?: PickupSlot | null;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  listingId: string;
  farmerId: string;
  farmerName: string;
  quantityKg: number;
  pricePerKg: number;
  subtotal: number;
  distanceKm: number;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  provider: "demo_escrow";
  heldAt?: string | null;
  releasedAt?: string | null;
  allocations: PaymentAllocation[];
}

export interface PaymentAllocation {
  farmerId: string;
  farmerName: string;
  quantityKg: number;
  amount: number;
}

export interface PickupSlot {
  id: string;
  orderId: string;
  scheduledDate: string;
  scheduledTime: string;
  location: string;
  vehicleNumber: string;
  driverName: string;
  status: PickupStatus;
}

export interface Rating {
  id: string;
  orderId: string;
  fromUserId: string;
  toUserId: string;
  quality: number;
  reliability: number;
  communication: number;
  timeliness: number;
  overall: number;
  comment?: string | null;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface SmsLogRecord {
  id: string;
  recipientPhone: string;
  recipientName?: string | null;
  message: string;
  event: SmsEvent;
  status: SmsStatus;
  provider: "mock" | "fast2sms" | "twilio";
  createdAt: string;
}

export interface AdminDashboardSummary {
  gmv: number;
  totalFarmers: number;
  totalBuyers: number;
  activeListings: number;
  totalOrders: number;
  aggregatedOrders: number;
  totalFarmerEarnings: number;
  successfulDeliveries: number;
  activeSmartBatches: number;
  farmersConnected: number;
  buyerDemandTonnes: number;
}
