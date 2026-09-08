import { query } from "../db/pool";
import { CropCategory } from "@kisansetu/shared";

export const demandRepository = {
  async history(crop: CropCategory, region: string, days = 150): Promise<{ date: string; value: number }[]> {
    const { rows } = await query<{ recorded_date: string; demand_kg: string }>(
      `SELECT recorded_date, demand_kg FROM demand_history
       WHERE crop_code = $1 AND region = $2
       ORDER BY recorded_date DESC LIMIT $3`,
      [crop, region, days]
    );
    return rows.reverse().map((r) => ({ date: r.recorded_date, value: Number(r.demand_kg) }));
  },

  async currentSupply(crop: CropCategory, region: string): Promise<number> {
    const { rows } = await query<{ total: string }>(
      `SELECT COALESCE(SUM(remaining_quantity_kg), 0) AS total FROM produce_listings
       WHERE crop_code = $1 AND region = $2 AND status = 'active'`,
      [crop, region]
    );
    return Number(rows[0].total);
  },

  async cacheForecast(input: {
    crop: CropCategory;
    region: string;
    horizonDays: number;
    expectedDemandKg: number;
    lowerBoundKg: number;
    upperBoundKg: number;
    growthPercent: number;
    confidence: number;
    trend: string;
    methodology: "internal_fallback" | "ml_service";
    modelName: string;
  }) {
    await query(
      `INSERT INTO demand_forecasts
        (crop_code, region, horizon_days, expected_demand_kg, lower_bound_kg, upper_bound_kg,
         growth_percent, confidence, trend, methodology, model_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        input.crop, input.region, input.horizonDays, input.expectedDemandKg, input.lowerBoundKg,
        input.upperBoundKg, input.growthPercent, input.confidence, input.trend, input.methodology,
        input.modelName,
      ]
    );
  },

  async latestForAllCropsRegions(): Promise<any[]> {
    const { rows } = await query(
      `SELECT DISTINCT ON (crop_code, region) *
       FROM demand_forecasts
       ORDER BY crop_code, region, generated_at DESC`
    );
    return rows;
  },
};
