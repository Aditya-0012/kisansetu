import { orderRepository } from "../repositories/order.repository";
import { ratingRepository } from "../repositories/rating.repository";
import { ApiError } from "../utils/apiError";

const RATABLE_STATUSES = new Set(["delivered", "payment_released", "completed"]);

export const ratingService = {
  async submit(orderId: string, fromUserId: string, input: {
    toUserId: string; quality: number; reliability: number; communication: number; timeliness: number; comment?: string;
  }) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw ApiError.notFound("Order not found");
    if (!RATABLE_STATUSES.has(order.status)) {
      throw ApiError.conflict("You can rate an order only after it has been delivered");
    }
    return ratingRepository.create({ orderId, fromUserId, ...input });
  },

  async forOrder(orderId: string) {
    return ratingRepository.forOrder(orderId);
  },

  async forUser(userId: string) {
    return ratingRepository.forUser(userId);
  },
};
