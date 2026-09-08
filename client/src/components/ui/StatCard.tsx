import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

interface StatCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon?: LucideIcon;
  tone?: "brand" | "fresh" | "clay" | "neutral";
  delta?: { value: number; label: string } | null;
}

const TONE_BG: Record<NonNullable<StatCardProps["tone"]>, string> = {
  brand: "bg-brand-50 text-brand-700",
  fresh: "bg-green-50 text-fresh-600",
  clay: "bg-orange-50 text-earth-clay",
  neutral: "bg-charcoal-900/5 text-charcoal-700",
};

/** Animated counter — used across the admin dashboard and Intelligence
 * Center so headline numbers feel alive rather than static text (spec's
 * "control tower" screen calls for this explicitly). Counts up once from 0
 * whenever `value` changes, using requestAnimationFrame rather than an
 * interval so it stays smooth without extra dependencies. */
function useCountUp(value: number, durationMs = 900) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = value;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

export function StatCard({ label, value, prefix, suffix, decimals = 0, icon: Icon, tone = "brand", delta }: StatCardProps) {
  const animated = useCountUp(value);
  const formatted = animated.toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-600">{label}</p>
        {Icon && (
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", TONE_BG[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold text-charcoal-900 tabular-nums">
        {prefix}
        {formatted}
        {suffix}
      </p>
      {delta && (
        <p className={cn("mt-1.5 text-xs font-semibold", delta.value >= 0 ? "text-state-success" : "text-state-danger")}>
          {delta.value >= 0 ? "+" : ""}
          {delta.value}% {delta.label}
        </p>
      )}
    </div>
  );
}
