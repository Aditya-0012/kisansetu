import { query } from "../db/pool";
import { AdminDashboardSummary } from "@kisansetu/shared";

export const adminRepository = {
  async dashboardSummary(): Promise<AdminDashboardSummary> {
    const [gmvRes, farmersRes, buyersRes, listingsRes, ordersRes, aggOrdersRes, earningsRes, deliveriesRes, activeBatchesRes, demandRes] =
      await Promise.all([
        query<{ sum: string }>(`SELECT COALESCE(SUM(total_amount),0) AS sum FROM orders WHERE status IN ('payment_released','completed')`),
        query<{ count: string }>(`SELECT count(*) FROM users WHERE role = 'farmer'`),
        query<{ count: string }>(`SELECT count(*) FROM users WHERE role = 'buyer'`),
        query<{ count: string }>(`SELECT count(*) FROM produce_listings WHERE status = 'active'`),
        query<{ count: string }>(`SELECT count(*) FROM orders`),
        query<{ count: string }>(`SELECT count(*) FROM orders WHERE aggregation_batch_id IS NOT NULL`),
        query<{ sum: string }>(`SELECT COALESCE(SUM(total_earnings),0) AS sum FROM farmer_profiles`),
        query<{ count: string }>(`SELECT count(*) FROM orders WHERE status IN ('delivered','payment_released','completed')`),
        query<{ count: string }>(`SELECT count(*) FROM aggregation_batches WHERE status NOT IN ('settled','cancelled')`),
        query<{ sum: string }>(`SELECT COALESCE(SUM(requested_quantity_kg),0) AS sum FROM aggregation_batches WHERE created_at >= now() - interval '30 days'`),
      ]);

    return {
      gmv: Number(gmvRes.rows[0].sum),
      totalFarmers: Number(farmersRes.rows[0].count),
      totalBuyers: Number(buyersRes.rows[0].count),
      activeListings: Number(listingsRes.rows[0].count),
      totalOrders: Number(ordersRes.rows[0].count),
      aggregatedOrders: Number(aggOrdersRes.rows[0].count),
      totalFarmerEarnings: Number(earningsRes.rows[0].sum),
      successfulDeliveries: Number(deliveriesRes.rows[0].count),
      activeSmartBatches: Number(activeBatchesRes.rows[0].count),
      farmersConnected: Number(farmersRes.rows[0].count),
      buyerDemandTonnes: Number(demandRes.rows[0].sum) / 1000,
    };
  },

  async gmvTimeSeries(days = 30) {
    const { rows } = await query(
      `SELECT date_trunc('day', created_at)::date AS day, COALESCE(SUM(total_amount),0) AS gmv, count(*) AS orders
       FROM orders WHERE created_at >= now() - interval '${days} days'
       GROUP BY 1 ORDER BY 1`
    );
    return rows;
  },

  async cropActivity() {
    const { rows } = await query(
      `SELECT crop_code, count(*) AS listings, COALESCE(SUM(remaining_quantity_kg),0) AS supply
       FROM produce_listings WHERE status = 'active' GROUP BY crop_code ORDER BY supply DESC`
    );
    return rows;
  },

  async regionalActivity() {
    const { rows } = await query(
      `SELECT region, count(*) AS listings, COALESCE(SUM(remaining_quantity_kg),0) AS supply
       FROM produce_listings WHERE status = 'active' GROUP BY region ORDER BY supply DESC`
    );
    return rows;
  },
};
