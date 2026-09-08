import { randomInt } from "crypto";

/** Human-readable order/batch codes, e.g. KS-ORD-4821 / KS-BAT-4821. These
 * are display identifiers only — the real primary key is always the UUID. */
export function generateOrderCode(): string {
  return `KS-ORD-${randomInt(1000, 9999)}`;
}

export function generateBatchCode(): string {
  return `KS-BAT-${randomInt(1000, 9999)}`;
}
