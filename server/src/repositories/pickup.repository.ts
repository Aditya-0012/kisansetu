import { query } from "../db/pool";
import { PickupStatus } from "@kisansetu/shared";

export const pickupRepository = {
  async create(input: {
    orderId: string;
    scheduledDate: string;
    scheduledTime: string;
    location: string;
    vehicleNumber: string;
    driverName: string;
  }) {
    const { rows } = await query(
      `INSERT INTO pickup_slots (order_id, scheduled_date, scheduled_time, location, vehicle_number, driver_name, status)
       VALUES ($1,$2,$3,$4,$5,$6,'scheduled') RETURNING *`,
      [input.orderId, input.scheduledDate, input.scheduledTime, input.location, input.vehicleNumber, input.driverName]
    );
    return rows[0];
  },

  async findByOrderId(orderId: string) {
    const { rows } = await query(`SELECT * FROM pickup_slots WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`, [orderId]);
    return rows[0] ?? null;
  },

  async updateStatus(id: string, status: PickupStatus) {
    await query(`UPDATE pickup_slots SET status = $2, updated_at = now() WHERE id = $1`, [id, status]);
  },

  async addLogisticsEvent(orderId: string, pickupId: string | null, event: string, notes?: string) {
    await query(
      `INSERT INTO logistics (order_id, pickup_id, event, notes) VALUES ($1,$2,$3,$4)`,
      [orderId, pickupId, event, notes ?? null]
    );
  },

  async eventsForOrder(orderId: string) {
    const { rows } = await query(`SELECT * FROM logistics WHERE order_id = $1 ORDER BY occurred_at ASC`, [orderId]);
    return rows;
  },

  async upcoming(limit = 20) {
    const { rows } = await query(
      `SELECT ps.*, o.order_code, o.crop_code FROM pickup_slots ps
       JOIN orders o ON o.id = ps.order_id
       WHERE ps.status IN ('scheduled', 'in_progress')
       ORDER BY ps.scheduled_date ASC LIMIT $1`,
      [limit]
    );
    return rows;
  },
};
