/**
 * Fair Price Engine (spec section 19).
 *
 * Advisory only — this produces a *suggested range*, never a promise. Every
 * caller-facing string this module returns is deliberately hedged ("market
 * conditions currently support...", never "you will earn...") per the
 * product principle in spec section 72.
 */
export type DemandLevel = "low" | "moderate" | "high";

export interface FairPriceInput {
  mandiPricePerKg: number;
  nearbyMandiAveragePerKg: number;
  thirtyDayAveragePerKg: number;
  demandGrowthPercent: number; // from the forecast engine
  qualityGrade: "A" | "B" | "C";
}

export interface FairPriceResult {
  demandLevel: DemandLevel;
  suggestedMinPerKg: number;
  suggestedMaxPerKg: number;
  recommendation: string;
}

const QUALITY_ADJUSTMENT: Record<"A" | "B" | "C", number> = {
  A: 1.04,
  B: 1.0,
  C: 0.94,
};

export function classifyDemand(growthPercent: number): DemandLevel {
  if (growthPercent >= 12) return "high";
  if (growthPercent >= 4) return "moderate";
  if (growthPercent <= -8) return "low";
  return "moderate";
}

export function calculateFairPrice(input: FairPriceInput): FairPriceResult {
  const { mandiPricePerKg, nearbyMandiAveragePerKg, thirtyDayAveragePerKg, demandGrowthPercent, qualityGrade } = input;

  const demandLevel = classifyDemand(demandGrowthPercent);
  const demandPremium = demandLevel === "high" ? 1.06 : demandLevel === "low" ? 0.96 : 1.0;

  // Blend today's mandi price with the regional average and the 30-day
  // baseline so one noisy day doesn't dominate the suggestion.
  const blended =
    mandiPricePerKg * 0.5 + nearbyMandiAveragePerKg * 0.3 + thirtyDayAveragePerKg * 0.2;

  const qualityAdjusted = blended * QUALITY_ADJUSTMENT[qualityGrade] * demandPremium;

  const suggestedMinPerKg = round2(qualityAdjusted * 0.96);
  const suggestedMaxPerKg = round2(qualityAdjusted * 1.06);

  const recommendation = buildRecommendation(demandLevel, suggestedMinPerKg, suggestedMaxPerKg);

  return { demandLevel, suggestedMinPerKg, suggestedMaxPerKg, recommendation };
}

function buildRecommendation(level: DemandLevel, min: number, max: number): string {
  if (level === "high") {
    return `Demand is currently strong. Market conditions support a competitive price near ₹${max.toFixed(0)}/kg.`;
  }
  if (level === "low") {
    return `Demand is currently soft. A price near ₹${min.toFixed(0)}/kg may help your listing move faster.`;
  }
  return `Market conditions currently support a price between ₹${min.toFixed(0)}–₹${max.toFixed(0)}/kg.`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
