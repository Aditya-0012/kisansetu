/**
 * Demand Forecasting (spec sections 13-17, 44).
 *
 * Tries the Python ML microservice first (RandomForestRegressor trained on
 * ml/data/historical_demand.csv — see ml/training/train_forecast.py). If
 * that service is unreachable — which is the default state in this
 * sandbox build, since it must be started separately — falls back to
 * forecastFromHistory() (linear-trend + confidence band, see
 * services/algorithms/forecast.algorithm.ts), reading the same
 * demand_history table so the two paths never disagree about their inputs.
 * The response always says which one answered via `methodology`.
 */
import { CropCategory, DemandForecast } from "@kisansetu/shared";
import { env } from "../config/env";
import { demandRepository } from "../repositories/demand.repository";
import { forecastFromHistory } from "./algorithms/forecast.algorithm";
import { logger } from "../utils/logger";

interface MLServiceResponse {
  expected_demand_kg: number;
  lower_bound_kg: number;
  upper_bound_kg: number;
  growth_percent: number;
  confidence: number;
  trend: "rising" | "falling" | "stable";
  model_name: string;
  series: { date: string; actual: number | null; forecast: number | null; lower_bound: number | null; upper_bound: number | null }[];
}

async function tryMlService(crop: CropCategory, region: string, horizonDays: number): Promise<MLServiceResponse | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${env.ML_SERVICE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crop, region, horizon_days: horizonDays }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as MLServiceResponse;
  } catch {
    return null; // ML service down/unreachable — silently fall back, never break the app
  }
}

function buildRecommendation(trend: string, growthPercent: number, supplyGapKg: number, crop: string): string {
  if (trend === "rising" && supplyGapKg > 0) {
    return `Demand for ${crop} is expected to rise ${Math.abs(growthPercent).toFixed(0)}%. Current listed supply is approximately ${Math.round(supplyGapKg)} kg below expected demand — nearby farmers may consider listing additional harvest within the next few days.`;
  }
  if (trend === "rising") {
    return `Demand for ${crop} is trending upward. Listed supply currently looks sufficient to meet forecast demand.`;
  }
  if (trend === "falling") {
    return `Demand for ${crop} is trending down over this horizon. Consider spacing out new listings or exploring other regions.`;
  }
  return `Demand for ${crop} looks steady over this horizon, with no major shift expected.`;
}

export const forecastService = {
  async getForecast(crop: CropCategory, region: string, horizonDays: 7 | 14 | 30): Promise<DemandForecast> {
    const history = await demandRepository.history(crop, region, 150);
    const currentSupplyKg = await demandRepository.currentSupply(crop, region);

    const ml = await tryMlService(crop, region, horizonDays);

    let expectedDemandKg: number, lowerBoundKg: number, upperBoundKg: number, growthPercent: number,
      confidence: number, trend: "rising" | "falling" | "stable", modelName: string,
      series: DemandForecast["series"], methodology: "internal_fallback" | "ml_service";

    if (ml) {
      methodology = "ml_service";
      expectedDemandKg = ml.expected_demand_kg;
      lowerBoundKg = ml.lower_bound_kg;
      upperBoundKg = ml.upper_bound_kg;
      growthPercent = ml.growth_percent;
      confidence = ml.confidence;
      trend = ml.trend;
      modelName = ml.model_name;
      series = ml.series.map((p) => ({ date: p.date, actual: p.actual, forecast: p.forecast, lowerBound: p.lower_bound, upperBound: p.upper_bound }));
    } else {
      methodology = "internal_fallback";
      const result = forecastFromHistory(history, horizonDays);
      expectedDemandKg = result.expectedDemandKg;
      lowerBoundKg = result.lowerBoundKg;
      upperBoundKg = result.upperBoundKg;
      growthPercent = result.growthPercent;
      confidence = result.confidence;
      trend = result.trend;
      modelName = result.modelName;
      series = result.series;
    }

    const supplyGapKg = Math.max(0, Math.round((expectedDemandKg - currentSupplyKg) * 100) / 100);
    const recommendation = buildRecommendation(trend, growthPercent, supplyGapKg, crop);

    const forecast: DemandForecast = {
      crop, region, horizonDays, expectedDemandKg, currentSupplyKg, supplyGapKg, growthPercent,
      confidence, trend, recommendation, methodology, modelName, series,
      generatedAt: new Date().toISOString(),
    };

    demandRepository
      .cacheForecast({
        crop, region, horizonDays, expectedDemandKg, lowerBoundKg, upperBoundKg, growthPercent,
        confidence, trend, methodology, modelName,
      })
      .catch((err) => logger.warn("Failed to cache forecast", { error: String(err) }));

    return forecast;
  },

  async getAllLatestForecasts() {
    return demandRepository.latestForAllCropsRegions();
  },
};
