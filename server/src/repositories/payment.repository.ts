import { PoolClient } from "pg";
import { query } from "../db/pool";
import { PaymentStatus } from "@kisansetu/shared";
import { PayoutLine } from "../services/algorithms/aggregation.algorithm";

export interface PaymentRow {
  id: string;
  order_id: string;
  amount: string;
  status: PaymentStatus;
  provider: string;
  held_at: string | null;
  released_at: string | null;
  created_at: string;
}

export const paymentRepository = {
  async createHeld(client: PoolClient, orderId: string, amount: number): Promise<PaymentRow> {
    const { rows } = await client.query(
      `INSERT INTO payments (order_id, amount, status, provider, held_at)
       VALUES ($1,$2,'held','demo_escrow', now()) RETURNING *`,
      [orderId, amount]
    );
    return rows[0];
  },

  async findByOrderId(orderId: string): Promise<PaymentRow | null> {
    const { rows } = await query<PaymentRow>(`SELECT * FROM payments WHERE order_id = $1`, [orderId]);
    return rows[0] ?? null;
  },

  async release(client: PoolClient, paymentId: string, allocations: PayoutLine[]): Promise<PaymentRow> {
    const { rows } = await client.query(
      `UPDATE payments SET status = 'released', released_at = now() WHERE id = $1 RETURNING *`,
      [paymentId]
    );
    for (const a of allocations) {
      await client.query(
        `INSERT INTO payment_allocations (payment_id, farmer_id, quantity_kg, amount) VALUES ($1,$2,$3,$4)`,
        [paymentId, a.farmerId, a.quantityKg, a.amount]
      );
      await client.query(
        `UPDATE farmer_profiles SET total_earnings = total_earnings + $2, total_orders = total_orders + 1, updated_at = now()
         WHERE user_id = $1`,
        [a.farmerId, a.amount]
      );
    }
    return rows[0];
  },

  async allocationsForPayment(paymentId: string) {
    const { rows } = await query(
      `SELECT pa.*, u.name AS farmer_name FROM payment_allocations pa
       JOIN users u ON u.id = pa.farmer_id WHERE pa.payment_id = $1`,
      [paymentId]
    );
    return rows;
  },
};
