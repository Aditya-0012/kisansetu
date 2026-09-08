import { query } from "../db/pool";
import { CropCategory } from "@kisansetu/shared";

export interface MandiPriceRow {
  id: string;
  crop_code: CropCategory;
  region: string;
  mandi_name: string;
  price_per_kg: string;
  previous_price_per_kg: string;
  source: "government" | "seeded";
  updated_at: string;
}

export const priceRepository = {
  async currentByCropRegion(crop: CropCategory, region: string): Promise<MandiPriceRow | null> {
    const { rows } = await query<MandiPriceRow>(
      `SELECT * FROM mandi_prices WHERE crop_code = $1 AND region = $2 ORDER BY updated_at DESC LIMIT 1`,
      [crop, region]
    );
    return rows[0] ?? null;
  },

  async allCurrent(): Promise<MandiPriceRow[]> {
    const { rows } = await query<MandiPriceRow>(`SELECT * FROM mandi_prices ORDER BY crop_code, region`);
    return rows;
  },

  async nearbyAverage(crop: CropCategory, excludeRegion: string): Promise<number> {
    const { rows } = await query<{ avg: string }>(
      `SELECT AVG(price_per_kg) AS avg FROM mandi_prices WHERE crop_code = $1 AND region != $2`,
      [crop, excludeRegion]
    );
    return Number(rows[0]?.avg ?? 0);
  },

  async thirtyDayAverage(crop: CropCategory, region: string): Promise<number> {
    const { rows } = await query<{ avg: string }>(
      `SELECT AVG(price_per_kg) AS avg FROM price_history
       WHERE crop_code = $1 AND region = $2 AND recorded_date >= (CURRENT_DATE - INTERVAL '30 days')`,
      [crop, region]
    );
    return Number(rows[0]?.avg ?? 0);
  },

  async trend(crop: CropCategory, region: string, days = 30): Promise<{ date: string; pricePerKg: number }[]> {
    const { rows } = await query<{ recorded_date: string; price_per_kg: string }>(
      `SELECT recorded_date, price_per_kg FROM price_history
       WHERE crop_code = $1 AND region = $2
       ORDER BY recorded_date DESC LIMIT $3`,
      [crop, region, days]
    );
    return rows.reverse().map((r) => ({ date: r.recorded_date, pricePerKg: Number(r.price_per_kg) }));
  },

  async upsertCurrent(crop: CropCategory, region: string, mandiName: string, pricePerKg: number, previousPricePerKg: number, source: "government" | "seeded") {
    await query(
      `INSERT INTO mandi_prices (crop_code, region, mandi_name, price_per_kg, previous_price_per_kg, source, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6, now())
       ON CONFLICT (crop_code, region, mandi_name)
       DO UPDATE SET price_per_kg = $4, previous_price_per_kg = $5, source = $6, updated_at = now()`,
      [crop, region, mandiName, pricePerKg, previousPricePerKg, source]
    );
  },
};
