import { query } from "../db/pool";
import { CropCategory, ListingStatus, QualityGrade } from "@kisansetu/shared";

export interface ListingRow {
  id: string;
  farmer_id: string;
  crop_code: CropCategory;
  variety: string | null;
  quantity_kg: string;
  remaining_quantity_kg: string;
  unit: string;
  expected_price_per_kg: string;
  harvest_date: string;
  quality: QualityGrade;
  region: string;
  village: string | null;
  latitude: string | null;
  longitude: string | null;
  description: string | null;
  photo_url: string | null;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
  farmer_name?: string;
  farmer_rating?: string;
}

export interface ListingFilters {
  crop?: CropCategory;
  region?: string;
  minPrice?: number;
  maxPrice?: number;
  minQuantity?: number;
  quality?: QualityGrade;
  search?: string;
  page: number;
  pageSize: number;
}

export const listingRepository = {
  async create(input: {
    farmerId: string;
    crop: CropCategory;
    variety?: string;
    quantityKg: number;
    expectedPricePerKg: number;
    harvestDate: string;
    quality: QualityGrade;
    region: string;
    village?: string;
    latitude?: number;
    longitude?: number;
    description?: string;
    photoUrl?: string;
  }): Promise<ListingRow> {
    const { rows } = await query<ListingRow>(
      `INSERT INTO produce_listings
        (farmer_id, crop_code, variety, quantity_kg, remaining_quantity_kg, unit,
         expected_price_per_kg, harvest_date, quality, region, village, latitude, longitude,
         description, photo_url, status)
       VALUES ($1,$2,$3,$4,$4,'kg',$5,$6,$7,$8,$9,$10,$11,$12,$13,'active')
       RETURNING *`,
      [
        input.farmerId, input.crop, input.variety ?? null, input.quantityKg,
        input.expectedPricePerKg, input.harvestDate, input.quality, input.region,
        input.village ?? null, input.latitude ?? null, input.longitude ?? null,
        input.description ?? null, input.photoUrl ?? null,
      ]
    );
    return rows[0];
  },

  async findById(id: string): Promise<ListingRow | null> {
    const { rows } = await query<ListingRow>(
      `SELECT pl.*, u.name AS farmer_name, fp.avg_rating AS farmer_rating
       FROM produce_listings pl
       JOIN users u ON u.id = pl.farmer_id
       LEFT JOIN farmer_profiles fp ON fp.user_id = pl.farmer_id
       WHERE pl.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async search(filters: ListingFilters): Promise<{ rows: ListingRow[]; total: number }> {
    const conditions: string[] = ["pl.status = 'active'", "pl.remaining_quantity_kg > 0"];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.crop) {
      conditions.push(`pl.crop_code = $${idx++}`);
      params.push(filters.crop);
    }
    if (filters.region) {
      conditions.push(`pl.region = $${idx++}`);
      params.push(filters.region);
    }
    if (filters.minPrice !== undefined) {
      conditions.push(`pl.expected_price_per_kg >= $${idx++}`);
      params.push(filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      conditions.push(`pl.expected_price_per_kg <= $${idx++}`);
      params.push(filters.maxPrice);
    }
    if (filters.minQuantity !== undefined) {
      conditions.push(`pl.remaining_quantity_kg >= $${idx++}`);
      params.push(filters.minQuantity);
    }
    if (filters.quality) {
      conditions.push(`pl.quality = $${idx++}`);
      params.push(filters.quality);
    }
    if (filters.search) {
      conditions.push(`(pl.crop_code ILIKE $${idx} OR pl.variety ILIKE $${idx} OR pl.description ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const whereClause = conditions.join(" AND ");
    const offset = (filters.page - 1) * filters.pageSize;

    const { rows } = await query<ListingRow>(
      `SELECT pl.*, u.name AS farmer_name, fp.avg_rating AS farmer_rating
       FROM produce_listings pl
       JOIN users u ON u.id = pl.farmer_id
       LEFT JOIN farmer_profiles fp ON fp.user_id = pl.farmer_id
       WHERE ${whereClause}
       ORDER BY pl.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, filters.pageSize, offset]
    );

    const { rows: countRows } = await query<{ count: string }>(
      `SELECT count(*) FROM produce_listings pl WHERE ${whereClause}`,
      params
    );

    return { rows, total: Number(countRows[0].count) };
  },

  async listActiveByCrop(crop: CropCategory, region?: string): Promise<ListingRow[]> {
    const params: unknown[] = [crop];
    let regionClause = "";
    if (region) {
      regionClause = "AND pl.region = $2";
      params.push(region);
    }
    const { rows } = await query<ListingRow>(
      `SELECT pl.*, u.name AS farmer_name, fp.avg_rating AS farmer_rating
       FROM produce_listings pl
       JOIN users u ON u.id = pl.farmer_id
       LEFT JOIN farmer_profiles fp ON fp.user_id = pl.farmer_id
       WHERE pl.crop_code = $1 AND pl.status = 'active' AND pl.remaining_quantity_kg > 0 ${regionClause}`,
      params
    );
    return rows;
  },

  async listByFarmer(farmerId: string): Promise<ListingRow[]> {
    const { rows } = await query<ListingRow>(
      `SELECT * FROM produce_listings WHERE farmer_id = $1 ORDER BY created_at DESC`,
      [farmerId]
    );
    return rows;
  },

  async reduceRemaining(client: import("pg").PoolClient, listingId: string, byQuantityKg: number): Promise<void> {
    await client.query(
      `UPDATE produce_listings
       SET remaining_quantity_kg = GREATEST(0, remaining_quantity_kg - $2),
           status = CASE WHEN remaining_quantity_kg - $2 <= 0.01 THEN 'sold' ELSE 'active' END,
           updated_at = now()
       WHERE id = $1`,
      [listingId, byQuantityKg]
    );
  },

  async updateStatus(id: string, status: ListingStatus): Promise<void> {
    await query(`UPDATE produce_listings SET status = $2, updated_at = now() WHERE id = $1`, [id, status]);
  },

  async update(id: string, fields: Partial<{ expectedPricePerKg: number; description: string; status: ListingStatus }>): Promise<ListingRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (fields.expectedPricePerKg !== undefined) { sets.push(`expected_price_per_kg = $${idx++}`); params.push(fields.expectedPricePerKg); }
    if (fields.description !== undefined) { sets.push(`description = $${idx++}`); params.push(fields.description); }
    if (fields.status !== undefined) { sets.push(`status = $${idx++}`); params.push(fields.status); }
    if (sets.length === 0) return this.findById(id);
    sets.push(`updated_at = now()`);
    params.push(id);
    const { rows } = await query<ListingRow>(
      `UPDATE produce_listings SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );
    return rows[0] ?? null;
  },
};
