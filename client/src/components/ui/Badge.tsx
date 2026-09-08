import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone = "brand" | "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700",
  success: "bg-green-50 text-state-success",
  warning: "bg-amber-50 text-state-warning",
  danger: "bg-red-50 text-state-danger",
  info: "bg-blue-50 text-state-info",
  neutral: "bg-charcoal-900/5 text-charcoal-700",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("badge", TONE_CLASSES[tone], className)}>{children}</span>;
}

// Maps an OrderStatus (see @kisansetu/shared enums) to a visual tone so every
// screen renders the lifecycle consistently instead of each page inventing
// its own color logic.
const ORDER_STATUS_TONE: Record<string, Tone> = {
  listed: "neutral",
  offer_received: "info",
  negotiating: "info",
  confirmed: "brand",
  payment_held: "brand",
  batch_formed: "brand",
  pickup_scheduled: "warning",
  in_transit: "warning",
  delivered: "success",
  payment_released: "success",
  completed: "success",
  cancelled: "danger",
  disputed: "danger",
};

export function orderStatusTone(status: string): Tone {
  return ORDER_STATUS_TONE[status] ?? "neutral";
}
