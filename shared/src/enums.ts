// ── Shared enums ─────────────────────────────────────────────────────────
// Single source of truth for status/role vocab used by both server and
// client, so the two never drift apart.

export enum UserRole {
  FARMER = "farmer",
  BUYER = "buyer",
  ADMIN = "admin",
}

export enum BuyerType {
  RETAILER = "retailer",
  RESTAURANT = "restaurant",
  HOSTEL = "hostel",
  KIRANA = "kirana",
  FPO = "fpo",
  CONSUMER = "consumer",
}

export enum CropCategory {
  TOMATO = "tomato",
  ONION = "onion",
  POTATO = "potato",
  GRAPES = "grapes",
  POMEGRANATE = "pomegranate",
  WHEAT = "wheat",
}

export enum QualityGrade {
  A = "A",
  B = "B",
  C = "C",
}

export enum ListingStatus {
  ACTIVE = "active",
  RESERVED = "reserved",
  AGGREGATED = "aggregated",
  SOLD = "sold",
  EXPIRED = "expired",
  WITHDRAWN = "withdrawn",
}

export enum OfferStatus {
  PENDING = "pending",
  COUNTERED = "countered",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  EXPIRED = "expired",
}

// The full order lifecycle, in order. Every order marches left to right;
// CANCELLED / DISPUTED are terminal side-branches, not part of the happy path.
export enum OrderStatus {
  LISTED = "listed",
  OFFER_RECEIVED = "offer_received",
  NEGOTIATING = "negotiating",
  CONFIRMED = "confirmed",
  PAYMENT_HELD = "payment_held",
  BATCH_FORMED = "batch_formed",
  PICKUP_SCHEDULED = "pickup_scheduled",
  IN_TRANSIT = "in_transit",
  DELIVERED = "delivered",
  PAYMENT_RELEASED = "payment_released",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  DISPUTED = "disputed",
}

export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  OrderStatus.LISTED,
  OrderStatus.OFFER_RECEIVED,
  OrderStatus.NEGOTIATING,
  OrderStatus.CONFIRMED,
  OrderStatus.PAYMENT_HELD,
  OrderStatus.BATCH_FORMED,
  OrderStatus.PICKUP_SCHEDULED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERED,
  OrderStatus.PAYMENT_RELEASED,
  OrderStatus.COMPLETED,
];

/**
 * An order may only move forward along ORDER_STATUS_SEQUENCE (never skip
 * backward), or into CANCELLED/DISPUTED from any non-terminal state. This is
 * the one place that decides "is this transition legal" — both the order
 * service and, defensively, order controllers consult it, so a buggy route
 * handler can't push an order out of sequence.
 */
export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  const terminal: OrderStatus[] = [OrderStatus.COMPLETED, OrderStatus.CANCELLED];
  if (terminal.includes(from)) return false;
  if (to === OrderStatus.CANCELLED || to === OrderStatus.DISPUTED) return true;
  const fromIdx = ORDER_STATUS_SEQUENCE.indexOf(from);
  const toIdx = ORDER_STATUS_SEQUENCE.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx === fromIdx + 1;
}

export enum BatchStatus {
  FORMING = "forming",
  CONFIRMED = "confirmed",
  PICKUP_SCHEDULED = "pickup_scheduled",
  IN_TRANSIT = "in_transit",
  DELIVERED = "delivered",
  SETTLED = "settled",
  CANCELLED = "cancelled",
}

export enum PaymentStatus {
  PENDING = "pending",
  HELD = "held",
  RELEASED = "released",
  REFUNDED = "refunded",
  FAILED = "failed",
}

export enum PickupStatus {
  SCHEDULED = "scheduled",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  MISSED = "missed",
}

export enum NotificationType {
  OFFER_RECEIVED = "offer_received",
  OFFER_COUNTERED = "offer_countered",
  OFFER_ACCEPTED = "offer_accepted",
  LISTING_JOINED_BATCH = "listing_joined_batch",
  BATCH_CREATED = "batch_created",
  ORDER_CONFIRMED = "order_confirmed",
  PICKUP_SCHEDULED = "pickup_scheduled",
  ORDER_IN_TRANSIT = "order_in_transit",
  DELIVERY_CONFIRMED = "delivery_confirmed",
  PAYMENT_RELEASED = "payment_released",
  DEMAND_FORECAST_CHANGED = "demand_forecast_changed",
}

export enum SmsEvent {
  LISTING_CREATED = "listing_created",
  OFFER_RECEIVED = "offer_received",
  OFFER_COUNTERED = "offer_countered",
  OFFER_ACCEPTED = "offer_accepted",
  BATCH_CREATED = "batch_created",
  ORDER_CONFIRMED = "order_confirmed",
  PICKUP_SCHEDULED = "pickup_scheduled",
  ORDER_IN_TRANSIT = "order_in_transit",
  ORDER_DELIVERED = "order_delivered",
  PAYMENT_RELEASED = "payment_released",
  TEST = "test",
}

export enum SmsStatus {
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
}

export const CROP_LABELS: Record<CropCategory, string> = {
  [CropCategory.TOMATO]: "Tomato",
  [CropCategory.ONION]: "Onion",
  [CropCategory.POTATO]: "Potato",
  [CropCategory.GRAPES]: "Grapes",
  [CropCategory.POMEGRANATE]: "Pomegranate",
  [CropCategory.WHEAT]: "Wheat",
};

export const REGIONS = ["Nashik", "Pune", "Satara", "Sangli", "Ahmednagar"] as const;
export type Region = (typeof REGIONS)[number];
