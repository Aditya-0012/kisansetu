import { PoolClient } from "pg";
import { pool, query } from "../db/pool";
import { CropCategory, OrderStatus, PickupStatus } from "@kisansetu/shared";

export interface OrderRow {
  id: string;
  order_code: string;
  buyer_id: string;
  crop_code: CropCategory;
  total_quantity_kg: string;
  agreed_price_per_kg: string;
  total_amount: string;
  destination_region: string;
  status: OrderStatus;
  aggregation_batch_id: string | null;
  source_offer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  listing_id: string;
  farmer_id: string;
  quantity_kg: string;
  price_per_kg: string;
  subtotal: string;
  distance_km: string;
}

export interface OrderItemRowWithFarmer extends OrderItemRow {
  farmer_name: string;
}

export const orderRepository = {
  async createWithItems(
    client: PoolClient,
    order: {
      orderCode: string;
      buyerId: string;
      crop: CropCategory;
      totalQuantityKg: number;
      agreedPricePerKg: number;
      totalAmount: number;
      destinationRegion: string;
      status: OrderStatus;
      aggregationBatchId?: string;
      sourceOfferId?: string;
    },
    items: { listingId: string; farmerId: string; quantityKg: number; pricePerKg: number; subtotal: number; distanceKm: number }[]
  ): Promise<OrderRow> {
    const { rows } = await client.query(
      `INSERT INTO orders (order_code, buyer_id, crop_code, total_quantity_kg, agreed_price_per_kg,
         total_amount, destination_region, status, aggregation_batch_id, source_offer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        order.orderCode, order.buyerId, order.crop, order.totalQuantityKg, order.agreedPricePerKg,
        order.totalAmount, order.destinationRegion, order.status, order.aggregationBatchId ?? null,
        order.sourceOfferId ?? null,
      ]
    );
    const orderRow = rows[0] as OrderRow;
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, listing_id, farmer_id, quantity_kg, price_per_kg, subtotal, distance_km)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [orderRow.id, item.listingId, item.farmerId, item.quantityKg, item.pricePerKg, item.subtotal, item.distanceKm]
      );
    }
    return orderRow;
  },

  async findById(id: string): Promise<OrderRow | null> {
    const { rows } = await query<OrderRow>(`SELECT * FROM orders WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async itemsForOrder(orderId: string): Promise<OrderItemRowWithFarmer[]> {
    // Joined with users so the client can render "who's contributing"
    // (order detail's per-farmer breakdown, spec section 29) without a
    // second round-trip per item.
    const { rows } = await query<OrderItemRowWithFarmer>(
      `SELECT oi.*, u.name AS farmer_name
       FROM order_items oi
       JOIN users u ON u.id = oi.farmer_id
       WHERE oi.order_id = $1
       ORDER BY oi.subtotal DESC`,
      [orderId]
    );
    return rows;
  },

  async listForBuyer(buyerId: string): Promise<(OrderRow & {
    pickup_id?: string | null;
    pickup_scheduled_date?: string | Date | null;
    pickup_scheduled_time?: string | null;
    pickup_location?: string | null;
    pickup_vehicle_number?: string | null;
    pickup_driver_name?: string | null;
    pickup_status?: PickupStatus | null;
  })[]> {
    const { rows } = await query(
      `SELECT o.*,
              ps.id AS pickup_id,
              ps.scheduled_date AS pickup_scheduled_date,
              ps.scheduled_time AS pickup_scheduled_time,
              ps.location AS pickup_location,
              ps.vehicle_number AS pickup_vehicle_number,
              ps.driver_name AS pickup_driver_name,
              ps.status AS pickup_status
       FROM orders o
       LEFT JOIN pickup_slots ps ON ps.order_id = o.id
       WHERE o.buyer_id = $1
       ORDER BY o.created_at DESC`,
      [buyerId]
    );
    return rows;
  },

  async listForFarmer(farmerId: string): Promise<(OrderRow & {
    farmer_quantity_kg: string;
    farmer_subtotal: string;
    pickup_id?: string | null;
    pickup_scheduled_date?: string | Date | null;
    pickup_scheduled_time?: string | null;
    pickup_location?: string | null;
    pickup_vehicle_number?: string | null;
    pickup_driver_name?: string | null;
    pickup_status?: PickupStatus | null;
  })[]> {
    const { rows } = await query(
      `SELECT o.*, oi.quantity_kg AS farmer_quantity_kg, oi.subtotal AS farmer_subtotal,
              ps.id AS pickup_id,
              ps.scheduled_date AS pickup_scheduled_date,
              ps.scheduled_time AS pickup_scheduled_time,
              ps.location AS pickup_location,
              ps.vehicle_number AS pickup_vehicle_number,
              ps.driver_name AS pickup_driver_name,
              ps.status AS pickup_status
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN pickup_slots ps ON ps.order_id = o.id
       WHERE oi.farmer_id = $1
       ORDER BY o.created_at DESC`,
      [farmerId]
    );
    return rows;
  },

  async updateStatus(id: string, status: OrderStatus): Promise<OrderRow> {
    const { rows } = await query<OrderRow>(
      `UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, status]
    );
    return rows[0];
  },

  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};
