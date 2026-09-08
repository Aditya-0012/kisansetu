import { adminRepository } from "../repositories/admin.repository";
import { smsRepository } from "../repositories/sms.repository";
import { demandRepository } from "../repositories/demand.repository";
import { auditRepository } from "../repositories/audit.repository";
import { priceService } from "./price.service";
import { aggregationService } from "./aggregation.service";

// The admin monitor reads cached model output rows straight from
// demand_forecasts (seeded/historical snapshots), which is a different
// shape than forecastService's live, on-demand DemandForecast (that one
// carries a full day-by-day series computed per request). Camelcased here
// so the client never has to reach for snake_case fields.
function toForecastSnapshot(row: any) {
  return {
    crop: row.crop_code,
    region: row.region,
    horizonDays: row.horizon_days,
    expectedDemandKg: Number(row.expected_demand_kg),
    lowerBoundKg: Number(row.lower_bound_kg),
    upperBoundKg: Number(row.upper_bound_kg),
    growthPercent: Number(row.growth_percent),
    confidence: Number(row.confidence),
    trend: row.trend,
    methodology: row.methodology,
    modelName: row.model_name,
    generatedAt: row.generated_at,
  };
}

function toSmsLogDto(row: any) {
  return {
    id: row.id,
    recipientPhone: row.recipient_phone,
    recipientName: row.recipient_name,
    message: row.message,
    event: row.event,
    status: row.status,
    provider: row.provider,
    createdAt: row.created_at,
  };
}

function toAuditEntryDto(row: any) {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export const adminService = {
  async dashboard() {
    const [summary, gmvSeriesRows, cropActivityRows, regionalActivityRows] = await Promise.all([
      adminRepository.dashboardSummary(),
      adminRepository.gmvTimeSeries(30),
      adminRepository.cropActivity(),
      adminRepository.regionalActivity(),
    ]);
    // SUM()/count() come back from pg as strings — coerce to numbers once
    // here so every chart downstream can trust numeric types.
    const gmvSeries = gmvSeriesRows.map((r: any) => ({ day: r.day, gmv: Number(r.gmv), orders: Number(r.orders) }));
    const cropActivity = cropActivityRows.map((r: any) => ({ crop: r.crop_code, listings: Number(r.listings), supplyKg: Number(r.supply) }));
    const regionalActivity = regionalActivityRows.map((r: any) => ({ region: r.region, listings: Number(r.listings), supplyKg: Number(r.supply) }));
    return { summary, gmvSeries, cropActivity, regionalActivity };
  },

  async forecastMonitor() {
    const rows = await demandRepository.latestForAllCropsRegions();
    return rows.map(toForecastSnapshot);
  },

  async batches() {
    return aggregationService.listAll(100);
  },

  async priceData() {
    return priceService.getAllCurrentPrices();
  },

  async smsCenter() {
    const [metrics, recentRows] = await Promise.all([smsRepository.metrics(), smsRepository.recent(50)]);
    return { metrics, recent: recentRows.map(toSmsLogDto) };
  },

  async auditLog() {
    const rows = await auditRepository.recent(100);
    return rows.map(toAuditEntryDto);
  },
};
