import { query } from "../db/pool";

export const auditRepository = {
  async log(actorUserId: string | null, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
    await query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [actorUserId, action, entityType, entityId, JSON.stringify(metadata)]
    );
  },

  async recent(limit = 100) {
    const { rows } = await query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1`, [limit]);
    return rows;
  },
};
