import { CropCategory, ProduceListing, QualityGrade, SmsEvent } from "@kisansetu/shared";
import { listingRepository, ListingFilters, ListingRow } from "../repositories/listing.repository";
import { auditRepository } from "../repositories/audit.repository";
import { smsService } from "./sms.service";
import { userRepository } from "../repositories/user.repository";
import { ApiError } from "../utils/apiError";
import { REGION_CENTROIDS } from "../utils/distance";

function toDto(row: ListingRow): ProduceListing {
  return {
    id: row.id,
    farmerId: row.farmer_id,
    farmerName: row.farmer_name ?? "",
    farmerRating: Number(row.farmer_rating ?? 0),
    crop: row.crop_code,
    variety: row.variety,
    quantityKg: Number(row.quantity_kg),
    remainingQuantityKg: Number(row.remaining_quantity_kg),
    unit: row.unit,
    expectedPricePerKg: Number(row.expected_price_per_kg),
    harvestDate: row.harvest_date,
    quality: row.quality,
    region: row.region,
    village: row.village,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    description: row.description,
    photoUrl: row.photo_url,
    status: row.status,
    createdAt: row.created_at,
  };
}

export const listingService = {
  async create(farmerId: string, input: {
    crop: CropCategory; variety?: string; quantityKg: number; expectedPricePerKg: number;
    harvestDate: string; quality: QualityGrade; region: string; village?: string;
    latitude?: number; longitude?: number; description?: string; photoUrl?: string;
  }): Promise<ProduceListing> {
    const centroid = input.region ? REGION_CENTROIDS[input.region] : undefined;
    const row = await listingRepository.create({
      farmerId,
      ...input,
      latitude: input.latitude ?? centroid?.[0],
      longitude: input.longitude ?? centroid?.[1],
    });
    const farmer = await userRepository.findById(farmerId);

    await auditRepository.log(farmerId, "listing_created", "produce_listing", row.id, {
      crop: input.crop, quantityKg: input.quantityKg,
    });

    if (farmer) {
      smsService
        .send({
          toPhone: farmer.phone,
          toName: farmer.name,
          toUserId: farmer.id,
          event: SmsEvent.LISTING_CREATED,
          message: `KisanSetu: Your listing of ${input.quantityKg} kg ${input.crop} at Rs.${input.expectedPricePerKg}/kg is now live.`,
        })
        .catch(() => void 0);
    }

    return toDto({ ...row, farmer_name: farmer?.name, farmer_rating: "0" });
  },

  async getById(id: string): Promise<ProduceListing> {
    const row = await listingRepository.findById(id);
    if (!row) throw ApiError.notFound("Listing not found");
    return toDto(row);
  },

  async search(filters: ListingFilters) {
    const { rows, total } = await listingRepository.search(filters);
    return { listings: rows.map(toDto), total, page: filters.page, pageSize: filters.pageSize };
  },

  async listMine(farmerId: string): Promise<ProduceListing[]> {
    const rows = await listingRepository.listByFarmer(farmerId);
    return rows.map((r) => toDto({ ...r, farmer_name: "", farmer_rating: "0" }));
  },

  async update(id: string, farmerId: string, fields: Partial<{ expectedPricePerKg: number; description: string; status: "active" | "withdrawn" }>) {
    const existing = await listingRepository.findById(id);
    if (!existing) throw ApiError.notFound("Listing not found");
    if (existing.farmer_id !== farmerId) throw ApiError.forbidden("You can only edit your own listings");
    const updated = await listingRepository.update(id, fields as any);
    return toDto(updated!);
  },
};

export { toDto as listingToDto };
