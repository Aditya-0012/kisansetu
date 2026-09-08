import { query } from "../db/pool";
import { NotificationType } from "@kisansetu/shared";

export const notificationRepository = {
  async create(userId: string, type: NotificationType, title: string, body: string) {
    const { rows } = await query(
      `INSERT INTO notifications (user_id, type, title, body) VALUES ($1,$2,$3,$4) RETURNING *`,
      [userId, type, title, body]
    );
    return rows[0];
  },

  async listForUser(userId: string, unreadOnly = false) {
    const clause = unreadOnly ? "AND read = FALSE" : "";
    const { rows } = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ${clause} ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    return rows;
  },

  async unreadCount(userId: string): Promise<number> {
    const { rows } = await query<{ count: string }>(
      `SELECT count(*) FROM notifications WHERE user_id = $1 AND read = FALSE`,
      [userId]
    );
    return Number(rows[0].count);
  },

  async markRead(id: string, userId: string) {
    await query(`UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2`, [id, userId]);
  },

  async markAllRead(userId: string) {
    await query(`UPDATE notifications SET read = TRUE WHERE user_id = $1`, [userId]);
  },
};
