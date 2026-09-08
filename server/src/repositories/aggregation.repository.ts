import { PoolClient } from "pg";
import { query } from "../db/pool";
import { BatchStatus, CropCategory } from "@kisansetu/shared";
import { BatchContribution } from "../services/algorithms/aggregation.algorithm";

export interface BatchRow {
  id: string;
  batch_code: string;
  crop_code: CropCategory;
  requested_quantity_kg: string;
  fulfilled_quantity_kg: string;
  destination_region: string;
  buyer_id: string | null;
  average_distance_km: string;
  weighted_price_per_kg: string;
  estimated_total: string;
  listings_analyzed: number;
  status: BatchStatus;
  created_at: string;
  updated_at: string;
}

export const aggregationRepository = {
  async createWithItems(
    client: PoolClient,
    batch: {
      batchCode: string;
      crop: CropCategory;
      requestedQuantityKg: number;
      fulfilledQuantityKg: number;
      destinationRegion: string;
      buyerId?: string;
      averageDistanceKm: number;
      weightedPricePerKg: number;
      estimatedTotal: number;
      listingsAnalyzed: number;
      status: BatchStatus;
    },
    contributions: BatchContribution[]
  ): Promise<BatchRow> {
    const { rows } = await client.query(
      `INSERT INTO aggregation_batches
        (batch_code, crop_code, requested_quantity_kg, fulfilled_quantity_kg, destination_region,
         buyer_id, average_distance_km, weighted_price_per_kg, estimated_total, listings_analyzed, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        batch.batchCode, batch.crop, batch.requestedQuantityKg, batch.fulfilledQuantityKg,
        batch.destinationRegion, batch.buyerId ?? null, batch.averageDistanceKm,
        batch.weightedPricePerKg, batch.estimatedTotal, batch.listingsAnalyzed, batch.status,
      ]
    );
    const batchRow = rows[0] as BatchRow;
    for (const c of contributions) {
      await client.query(
        `INSERT INTO aggregation_items (batch_id, listing_id, farmer_id, quantity_kg, price_per_kg, subtotal, distance_km)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [batchRow.id, c.listingId, c.farmerId, c.quantityKg, c.pricePerKg, c.subtotal, c.distanceKm]
      );
    }
    return batchRow;
  },

  async findById(id: string): Promise<BatchRow | null> {
    const { rows } = await query<BatchRow>(`SELECT * FROM aggregation_batches WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async itemsForBatch(batchId: string) {
    const { rows } = await query(
      `SELECT ai.*, u.name AS farmer_name FROM aggregation_items ai
       JOIN users u ON u.id = ai.farmer_id WHERE ai.batch_id = $1 ORDER BY ai.subtotal DESC`,
      [batchId]
    );
    return rows;
  },

  async updateStatus(id: string, status: BatchStatus) {
    await query(`UPDATE aggregation_batches SET status = $2, updated_at = now() WHERE id = $1`, [id, status]);
  },

  async listAll(limit = 50) {
    const { rows } = await query(
      `SELECT ab.*, u.name AS buyer_name FROM aggregation_batches ab
       LEFT JOIN users u ON u.id = ab.buyer_id
       ORDER BY ab.created_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  },

  async activeCount(): Promise<number> {
    const { rows } = await query<{ count: string }>(
      `SELECT count(*) FROM aggregation_batches WHERE status NOT IN ('settled', 'cancelled')`
    );
    return Number(rows[0].count);
  },
};
