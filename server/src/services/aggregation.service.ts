/**
 * DB-aware wrapper around the pure aggregation algorithm
 * (services/algorithms/aggregation.algorithm.ts). This is what
 * controllers/aggregation.controller.ts actually calls.
 */
import { AggregationBatch, BatchStatus, CropCategory, NotificationType, SmsEvent } from "@kisansetu/shared";
import { listingRepository } from "../repositories/listing.repository";
import { aggregationRepository, BatchRow } from "../repositories/aggregation.repository";
import { userRepository } from "../repositories/user.repository";
import { auditRepository } from "../repositories/audit.repository";
import { notificationService } from "./notification.service";
import { smsService } from "./sms.service";
import { pool } from "../db/pool";
import { REGION_CENTROIDS } from "../utils/distance";
import { generateBatchCode } from "../utils/codes";
import { ApiError } from "../utils/apiError";
import {
  buildOptimalBatch, CandidateListing, findCompatibleListings, rankListings,
} from "./algorithms/aggregation.algorithm";

async function toCandidates(crop: CropCategory): Promise<CandidateListing[]> {
  const rows = await listingRepository.listActiveByCrop(crop);
  const candidates: CandidateListing[] = [];
  for (const r of rows) {
    const lat = r.latitude ? Number(r.latitude) : REGION_CENTROIDS[r.region]?.[0];
    const lon = r.longitude ? Number(r.longitude) : REGION_CENTROIDS[r.region]?.[1];
    if (lat !== undefined && lon !== undefined) {
      candidates.push({
        listingId: r.id,
        farmerId: r.farmer_id,
        farmerName: r.farmer_name ?? "Farmer",
        farmerRating: Number(r.farmer_rating ?? 4),
        cropCode: r.crop_code,
        pricePerKg: Number(r.expected_price_per_kg),
        availableQuantityKg: Number(r.remaining_quantity_kg),
        latitude: lat,
        longitude: lon,
        village: r.village,
        region: r.region,
      });
    }
  }
  return candidates;
}

function batchRowToDto(row: BatchRow, contributions: AggregationBatch["contributions"]): AggregationBatch {
  return {
    id: row.id,
    batchCode: row.batch_code,
    crop: row.crop_code,
    requestedQuantityKg: Number(row.requested_quantity_kg),
    fulfilledQuantityKg: Number(row.fulfilled_quantity_kg),
    destinationRegion: row.destination_region,
    averageDistanceKm: Number(row.average_distance_km),
    weightedPricePerKg: Number(row.weighted_price_per_kg),
    estimatedTotal: Number(row.estimated_total),
    status: row.status,
    buyerId: row.buyer_id,
    contributions,
    listingsAnalyzed: row.listings_analyzed,
    createdAt: row.created_at,
  };
}

export const aggregationService = {
  /**
   * Runs the algorithm live (spec section 22-24) and *persists* the result
   * immediately as a 'forming' batch — even before the buyer confirms —
   * so the UI can show a stable batchId while the buyer reviews it, and so
   * partial/failed searches still leave an audit trail.
   */
  async findSupply(input: { crop: CropCategory; requiredQuantityKg: number; destinationRegion: string; maxDistanceKm?: number; buyerId?: string }) {
    const centroid = REGION_CENTROIDS[input.destinationRegion];
    if (!centroid) throw ApiError.badRequest(`Unknown region: ${input.destinationRegion}`);
    const [destLat, destLon] = centroid;

    const candidates = await toCandidates(input.crop);
    const compatible = findCompatibleListings(candidates, input.crop, destLat, destLon, input.maxDistanceKm);
    const ranked = rankListings(compatible);
    const result = buildOptimalBatch(ranked, input.requiredQuantityKg);

    if (result.contributions.length === 0) {
      return { batch: null, result };
    }

    const client = await pool.connect();
    let batchRow: BatchRow;
    try {
      await client.query("BEGIN");
      batchRow = await aggregationRepository.createWithItems(
        client,
        {
          batchCode: generateBatchCode(),
          crop: input.crop,
          requestedQuantityKg: result.requestedQuantityKg,
          fulfilledQuantityKg: result.fulfilledQuantityKg,
          destinationRegion: input.destinationRegion,
          buyerId: input.buyerId,
          averageDistanceKm: result.averageDistanceKm,
          weightedPricePerKg: result.weightedPricePerKg,
          estimatedTotal: result.estimatedTotal,
          listingsAnalyzed: result.listingsAnalyzed,
          status: BatchStatus.FORMING,
        },
        result.contributions
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    await auditRepository.log(input.buyerId ?? null, "batch_formed", "aggregation_batch", batchRow.id, {
      crop: input.crop, fulfilledQuantityKg: result.fulfilledQuantityKg,
    });

    return { batch: batchRowToDto(batchRow, result.contributions), result };
  },

  async getById(id: string): Promise<AggregationBatch> {
    const row = await aggregationRepository.findById(id);
    if (!row) throw ApiError.notFound("Batch not found");
    const items = await aggregationRepository.itemsForBatch(id);
    const contributions = items.map((i: any) => ({
      listingId: i.listing_id, farmerId: i.farmer_id, farmerName: i.farmer_name,
      quantityKg: Number(i.quantity_kg), pricePerKg: Number(i.price_per_kg),
      subtotal: Number(i.subtotal), distanceKm: Number(i.distance_km), farmerRating: 0,
    }));
    return batchRowToDto(row, contributions);
  },

  /** Admin batch monitor (spec's Intelligence Center) — same row->DTO shape
   * as getById, just for every batch instead of one. Admin-only, low
   * traffic, so the per-batch itemsForBatch round-trip is an acceptable
   * trade for reusing the exact same mapping logic rather than duplicating it. */
  async listAll(limit = 100): Promise<AggregationBatch[]> {
    const rows = await aggregationRepository.listAll(limit);
    return Promise.all(
      rows.map(async (row) => {
        const items = await aggregationRepository.itemsForBatch(row.id);
        const contributions = items.map((i: any) => ({
          listingId: i.listing_id, farmerId: i.farmer_id, farmerName: i.farmer_name,
          quantityKg: Number(i.quantity_kg), pricePerKg: Number(i.price_per_kg),
          subtotal: Number(i.subtotal), distanceKm: Number(i.distance_km), farmerRating: 0,
        }));
        return batchRowToDto(row, contributions);
      })
    );
  },

  /** Marks a batch confirmed and notifies every contributing farmer — this
   * is called by orderService right after the order + escrow hold succeed,
   * so a batch never reads "confirmed" without a real paid order behind it. */
  async markConfirmed(batchId: string) {
    await aggregationRepository.updateStatus(batchId, BatchStatus.CONFIRMED);
    const items = await aggregationRepository.itemsForBatch(batchId);
    const batch = await aggregationRepository.findById(batchId);
    for (const item of items as any[]) {
      const farmer = await userRepository.findById(item.farmer_id);
      if (!farmer) continue;
      await notificationService.create(
        farmer.id, NotificationType.LISTING_JOINED_BATCH, "Your listing joined a smart batch",
        `${Number(item.quantity_kg)} kg of your ${batch?.crop_code} was included in Batch ${batch?.batch_code}.`
      );
      smsService.send({
        toPhone: farmer.phone, toName: farmer.name, toUserId: farmer.id,
        event: SmsEvent.BATCH_CREATED,
        message: `KisanSetu: Your ${Number(item.quantity_kg)} kg ${batch?.crop_code} supply has been included in Batch ${batch?.batch_code}.`,
      }).catch(() => void 0);
    }
  },

  async activeCount() {
    return aggregationRepository.activeCount();
  },
};
