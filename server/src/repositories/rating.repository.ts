import { query } from "../db/pool";

export const ratingRepository = {
  async create(input: {
    orderId: string;
    fromUserId: string;
    toUserId: string;
    quality: number;
    reliability: number;
    communication: number;
    timeliness: number;
    comment?: string;
  }) {
    const overall = (input.quality + input.reliability + input.communication + input.timeliness) / 4;
    const { rows } = await query(
      `INSERT INTO ratings (order_id, from_user_id, to_user_id, quality, reliability, communication, timeliness, overall, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (order_id, from_user_id, to_user_id) DO UPDATE SET
         quality = $4, reliability = $5, communication = $6, timeliness = $7, overall = $8, comment = $9
       RETURNING *`,
      [input.orderId, input.fromUserId, input.toUserId, input.quality, input.reliability, input.communication, input.timeliness, overall, input.comment ?? null]
    );

    // Recompute the recipient's rolling average rating.
    const { rows: agg } = await query<{ avg: string; count: string }>(
      `SELECT AVG(overall) AS avg, count(*) AS count FROM ratings WHERE to_user_id = $1`,
      [input.toUserId]
    );
    await query(
      `UPDATE farmer_profiles SET avg_rating = $2, total_ratings = $3 WHERE user_id = $1`,
      [input.toUserId, Number(agg[0].avg), Number(agg[0].count)]
    );
    await query(
      `UPDATE buyer_profiles SET avg_rating = $2, total_ratings = $3 WHERE user_id = $1`,
      [input.toUserId, Number(agg[0].avg), Number(agg[0].count)]
    );
    return rows[0];
  },

  async forOrder(orderId: string) {
    const { rows } = await query(`SELECT * FROM ratings WHERE order_id = $1`, [orderId]);
    return rows;
  },

  async forUser(userId: string) {
    const { rows } = await query(
      `SELECT r.*, u.name AS from_name FROM ratings r JOIN users u ON u.id = r.from_user_id
       WHERE r.to_user_id = $1 ORDER BY r.created_at DESC`,
      [userId]
    );
    return rows;
  },
};
