import { NotificationRecord, NotificationType } from "@kisansetu/shared";
import { notificationRepository } from "../repositories/notification.repository";

function toDto(row: any): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    read: row.read,
    createdAt: row.created_at,
  };
}

export const notificationService = {
  async create(userId: string, type: NotificationType, title: string, body: string) {
    return notificationRepository.create(userId, type, title, body);
  },
  async listForUser(userId: string): Promise<{ notifications: NotificationRecord[]; unreadCount: number }> {
    const [rows, unreadCount] = await Promise.all([
      notificationRepository.listForUser(userId),
      notificationRepository.unreadCount(userId),
    ]);
    return { notifications: rows.map(toDto), unreadCount };
  },
  async markRead(id: string, userId: string) {
    return notificationRepository.markRead(id, userId);
  },
  async markAllRead(userId: string) {
    return notificationRepository.markAllRead(userId);
  },
};
