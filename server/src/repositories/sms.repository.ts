import { query } from "../db/pool";
import { SmsEvent, SmsStatus } from "@kisansetu/shared";

export const smsRepository = {
  async log(input: {
    recipientPhone: string;
    recipientName?: string;
    recipientUserId?: string;
    message: string;
    event: SmsEvent;
    status: SmsStatus;
    provider: "mock" | "fast2sms" | "twilio";
  }) {
    const { rows } = await query(
      `INSERT INTO sms_logs (recipient_phone, recipient_name, recipient_user_id, message, event, status, provider)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [input.recipientPhone, input.recipientName ?? null, input.recipientUserId ?? null, input.message, input.event, input.status, input.provider]
    );
    return rows[0];
  },

  async recent(limit = 50) {
    const { rows } = await query(`SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT $1`, [limit]);
    return rows;
  },

  async metrics() {
    const { rows } = await query<{ status: SmsStatus; count: string }>(
      `SELECT status, count(*) FROM sms_logs GROUP BY status`
    );
    const result = { sent: 0, delivered: 0, failed: 0 };
    for (const r of rows) {
      if (r.status === "sent") result.sent = Number(r.count);
      if (r.status === "delivered") result.delivered = Number(r.count);
      if (r.status === "failed") result.failed = Number(r.count);
    }
    return result;
  },
};
