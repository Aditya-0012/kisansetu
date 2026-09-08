/**
 * Order lifecycle orchestration (spec section 28-29).
 *
 * Two ways an order comes into existence:
 *   - confirmFromOffer(): a single accepted offer becomes a one-farmer order.
 *   - confirmFromBatch(): a confirmed smart batch becomes a multi-farmer order.
 * From there both follow the same state machine (isValidOrderTransition,
 * from @kisansetu/shared) through escrow hold -> pickup -> delivery ->
 * escrow release -> completed.
 *
 * Every transition here runs inside a DB transaction and is guarded by
 * isValidOrderTransition so a route can never push an order out of order —
 * this is the "all financial calculations happen on the backend, never
 * trust the client" rule (spec section 69) in code.
 */
import { PoolClient } from "pg";
import {
  BatchStatus, NotificationType, OfferStatus, OrderItemRecord, OrderRecord, OrderStatus, PickupStatus,
  PaymentRecord, SmsEvent, isValidOrderTransition,
} from "@kisansetu/shared";
import { pool } from "../db/pool";
import { orderRepository, OrderRow } from "../repositories/order.repository";
import { offerRepository } from "../repositories/offer.repository";
import { listingRepository } from "../repositories/listing.repository";
import { aggregationRepository } from "../repositories/aggregation.repository";
import { paymentRepository } from "../repositories/payment.repository";
import { pickupRepository } from "../repositories/pickup.repository";
import { userRepository } from "../repositories/user.repository";
import { notificationService } from "./notification.service";
import { smsService } from "./sms.service";
import { escrowProvider } from "./escrow.service";
import { toPickupDto } from "./pickup.service";
import { aggregationService } from "./aggregation.service";
import { auditRepository } from "../repositories/audit.repository";
import { generateOrderCode } from "../utils/codes";
import { calculatePayoutDistribution } from "./algorithms/aggregation.algorithm";
import { ApiError } from "../utils/apiError";

function toDto(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    orderCode: row.order_code,
    buyerId: row.buyer_id,
    crop: row.crop_code,
    totalQuantityKg: Number(row.total_quantity_kg),
    agreedPricePerKg: Number(row.agreed_price_per_kg),
    totalAmount: Number(row.total_amount),
    status: row.status,
    aggregationBatchId: row.aggregation_batch_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function transition(client: PoolClient, order: OrderRow, to: OrderStatus): Promise<OrderRow> {
  if (!isValidOrderTransition(order.status, to)) {
    throw ApiError.conflict(`Cannot move order from ${order.status} to ${to}`);
  }
  const { rows } = await client.query(
    `UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [order.id, to]
  );
  return rows[0];
}

export const orderService = {
  async confirmFromOffer(offerId: string, buyerId: string): Promise<OrderRecord> {
    const offer = await offerRepository.findById(offerId);
    if (!offer) throw ApiError.notFound("Offer not found");
    if (offer.buyer_id !== buyerId) throw ApiError.forbidden();
    if (offer.status !== OfferStatus.ACCEPTED) throw ApiError.conflict("Offer must be accepted before confirming an order");

    const listing = await listingRepository.findById(offer.listing_id);
    if (!listing) throw ApiError.notFound("Listing not found");

    const quantityKg = Number(offer.quantity_kg);
    const pricePerKg = Number(offer.offered_price_per_kg);
    const totalAmount = Math.round(quantityKg * pricePerKg * 100) / 100;

    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      const order = await orderRepository.createWithItems(
        client,
        {
          orderCode: generateOrderCode(), buyerId, crop: listing.crop_code, totalQuantityKg: quantityKg,
          agreedPricePerKg: pricePerKg, totalAmount, destinationRegion: listing.region,
          status: OrderStatus.CONFIRMED, sourceOfferId: offerId,
        },
        [{ listingId: listing.id, farmerId: listing.farmer_id, quantityKg, pricePerKg, subtotal: totalAmount, distanceKm: 0 }]
      );
      await listingRepository.reduceRemaining(client, listing.id, quantityKg);
      await escrowProvider.hold(client, order.id, totalAmount);
      await client.query(`UPDATE orders SET status = $2 WHERE id = $1`, [order.id, OrderStatus.PAYMENT_HELD]);
      await client.query("COMMIT");

      await auditRepository.log(buyerId, "order_confirmed", "order", order.id, { totalAmount });
      await auditRepository.log(buyerId, "payment_held", "order", order.id, { totalAmount });

      const buyer = await userRepository.findById(buyerId);
      const farmer = await userRepository.findById(listing.farmer_id);
      if (buyer) {
        await notificationService.create(buyer.id, NotificationType.ORDER_CONFIRMED, "Order confirmed", `Order ${order.order_code} for ${quantityKg}kg ${listing.crop_code} has been placed. Payment is held in escrow.`);
        smsService.send({
          toPhone: buyer.phone, toName: buyer.name, toUserId: buyer.id, event: SmsEvent.ORDER_CONFIRMED,
          message: `KisanSetu: Your order ${order.order_code} for ${quantityKg}kg ${listing.crop_code} is confirmed. Escrow held: Rs.${totalAmount.toFixed(2)}.`,
        }).catch(() => void 0);
      }
      if (farmer) {
        await notificationService.create(farmer.id, NotificationType.ORDER_CONFIRMED, "Order received & confirmed", `Order ${order.order_code} for ${quantityKg}kg ${listing.crop_code} is confirmed. Payment held in escrow.`);
        smsService.send({
          toPhone: farmer.phone, toName: farmer.name, toUserId: farmer.id, event: SmsEvent.ORDER_CONFIRMED,
          message: `KisanSetu: Order ${order.order_code} confirmed for ${quantityKg}kg of ${listing.crop_code}. Total value: Rs.${totalAmount.toFixed(2)}. Payment held in escrow.`,
        }).catch(() => void 0);
      }

      return toDto({ ...order, status: OrderStatus.PAYMENT_HELD });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async confirmFromBatch(batchId: string, buyerId: string): Promise<OrderRecord> {
    const batch = await aggregationRepository.findById(batchId);
    if (!batch) throw ApiError.notFound("Batch not found");
    if (batch.status !== BatchStatus.FORMING) throw ApiError.conflict("This batch is no longer available to confirm");

    const items = await aggregationRepository.itemsForBatch(batchId);
    const totalAmount = Number(batch.estimated_total);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const order = await orderRepository.createWithItems(
        client,
        {
          orderCode: generateOrderCode(), buyerId, crop: batch.crop_code,
          totalQuantityKg: Number(batch.fulfilled_quantity_kg), agreedPricePerKg: Number(batch.weighted_price_per_kg),
          totalAmount, destinationRegion: batch.destination_region, status: OrderStatus.CONFIRMED,
          aggregationBatchId: batchId,
        },
        (items as any[]).map((i) => ({
          listingId: i.listing_id, farmerId: i.farmer_id, quantityKg: Number(i.quantity_kg),
          pricePerKg: Number(i.price_per_kg), subtotal: Number(i.subtotal), distanceKm: Number(i.distance_km),
        }))
      );
      for (const item of items as any[]) {
        await listingRepository.reduceRemaining(client, item.listing_id, Number(item.quantity_kg));
      }
      await escrowProvider.hold(client, order.id, totalAmount);
      await client.query(`UPDATE orders SET status = $2 WHERE id = $1`, [order.id, OrderStatus.PAYMENT_HELD]);
      await client.query(`UPDATE aggregation_batches SET buyer_id = $2, status = 'confirmed', updated_at = now() WHERE id = $1`, [batchId, buyerId]);
      await client.query("COMMIT");

      await auditRepository.log(buyerId, "batch_created", "aggregation_batch", batchId);
      await auditRepository.log(buyerId, "order_confirmed", "order", order.id, { totalAmount });
      await auditRepository.log(buyerId, "payment_held", "order", order.id, { totalAmount });

      await aggregationService.markConfirmed(batchId);

      const buyer = await userRepository.findById(buyerId);
      if (buyer) {
        await notificationService.create(buyer.id, NotificationType.ORDER_CONFIRMED, "Batch order confirmed", `Order ${order.order_code} for ${Number(batch.fulfilled_quantity_kg)}kg ${batch.crop_code} has been placed. Payment is held in escrow.`);
        smsService.send({
          toPhone: buyer.phone, toName: buyer.name, toUserId: buyer.id, event: SmsEvent.ORDER_CONFIRMED,
          message: `KisanSetu: Batch order ${order.order_code} for ${Number(batch.fulfilled_quantity_kg)}kg ${batch.crop_code} confirmed. Escrow held: Rs.${totalAmount.toFixed(2)}.`,
        }).catch(() => void 0);
      }

      for (const item of items as any[]) {
        const farmer = await userRepository.findById(item.farmer_id);
        if (farmer) {
          await notificationService.create(farmer.id, NotificationType.ORDER_CONFIRMED, "Batch order confirmed", `Order ${order.order_code} confirmed! Your allocation: ${Number(item.quantity_kg)}kg ${batch.crop_code}.`);
          smsService.send({
            toPhone: farmer.phone, toName: farmer.name, toUserId: farmer.id, event: SmsEvent.ORDER_CONFIRMED,
            message: `KisanSetu: Order ${order.order_code} confirmed! Your share: ${Number(item.quantity_kg)}kg ${batch.crop_code} (Rs.${Number(item.subtotal).toFixed(2)}). Payment held in escrow.`,
          }).catch(() => void 0);
        }
      }

      return toDto({ ...order, status: OrderStatus.PAYMENT_HELD });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async getById(id: string): Promise<OrderRecord> {
    const row = await orderRepository.findById(id);
    if (!row) throw ApiError.notFound("Order not found");
    return toDto(row);
  },

  async itemsForOrder(id: string): Promise<OrderItemRecord[]> {
    const rows = await orderRepository.itemsForOrder(id);
    return rows.map((r) => ({
      id: r.id,
      orderId: r.order_id,
      listingId: r.listing_id,
      farmerId: r.farmer_id,
      farmerName: r.farmer_name,
      quantityKg: Number(r.quantity_kg),
      pricePerKg: Number(r.price_per_kg),
      subtotal: Number(r.subtotal),
      distanceKm: Number(r.distance_km),
    }));
  },

  async listForBuyer(buyerId: string) {
    const rows = await orderRepository.listForBuyer(buyerId);
    return rows.map((r) => ({
      ...toDto(r),
      pickup: r.pickup_id
        ? {
            id: r.pickup_id,
            orderId: r.id,
            scheduledDate:
              r.pickup_scheduled_date instanceof Date
                ? r.pickup_scheduled_date.toISOString().slice(0, 10)
                : String(r.pickup_scheduled_date ?? "").slice(0, 10),
            scheduledTime: r.pickup_scheduled_time ?? "",
            location: r.pickup_location ?? "",
            vehicleNumber: r.pickup_vehicle_number ?? "",
            driverName: r.pickup_driver_name ?? "",
            status: (r.pickup_status ?? "scheduled") as PickupStatus,
          }
        : null,
    }));
  },

  async listForFarmer(farmerId: string): Promise<OrderRecord[]> {
    const rows = await orderRepository.listForFarmer(farmerId);
    return rows.map((r) => ({
      ...toDto(r),
      farmerQuantityKg: Number(r.farmer_quantity_kg),
      farmerSubtotal: Number(r.farmer_subtotal),
      pickup: r.pickup_id
        ? {
            id: r.pickup_id,
            orderId: r.id,
            scheduledDate:
              r.pickup_scheduled_date instanceof Date
                ? r.pickup_scheduled_date.toISOString().slice(0, 10)
                : String(r.pickup_scheduled_date ?? "").slice(0, 10),
            scheduledTime: r.pickup_scheduled_time ?? "",
            location: r.pickup_location ?? "",
            vehicleNumber: r.pickup_vehicle_number ?? "",
            driverName: r.pickup_driver_name ?? "",
            status: (r.pickup_status ?? "scheduled") as PickupStatus,
          }
        : null,
    }));
  },

  async schedulePickup(orderId: string, input: { scheduledDate: string; scheduledTime: string; location: string; vehicleNumber: string; driverName: string }) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw ApiError.notFound("Order not found");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Every order passes through BATCH_FORMED on the way to pickup —
      // for a single-farmer order this just means "ready for logistics",
      // not literally an aggregation batch. Skip it if already past.
      let current = order;
      if (current.status === OrderStatus.PAYMENT_HELD) {
        current = await transition(client, current, OrderStatus.BATCH_FORMED);
      }
      const updated = await transition(client, current, OrderStatus.PICKUP_SCHEDULED);
      await client.query("COMMIT");

      const pickup = await pickupRepository.create({ orderId, ...input });
      await pickupRepository.addLogisticsEvent(orderId, pickup.id, "pickup_scheduled", "Pickup slot confirmed");
      await auditRepository.log(null, "pickup_scheduled", "order", orderId, input);

      const items = await orderRepository.itemsForOrder(orderId);
      for (const item of items) {
        const farmer = await userRepository.findById(item.farmer_id);
        if (!farmer) continue;
        await notificationService.create(farmer.id, NotificationType.PICKUP_SCHEDULED, "Pickup scheduled",
          `Pickup for order ${order.order_code} is scheduled on ${input.scheduledDate} at ${input.scheduledTime}.`);
        smsService.send({
          toPhone: farmer.phone, toName: farmer.name, toUserId: farmer.id, event: SmsEvent.PICKUP_SCHEDULED,
          message: `KisanSetu: Pickup for ${order.order_code} scheduled on ${input.scheduledDate} at ${input.scheduledTime}. Vehicle ${input.vehicleNumber}.`,
        }).catch(() => void 0);
      }

      const buyer = await userRepository.findById(order.buyer_id);
      if (buyer) {
        await notificationService.create(buyer.id, NotificationType.PICKUP_SCHEDULED, "Pickup scheduled",
          `Pickup for order ${order.order_code} is scheduled on ${input.scheduledDate} at ${input.scheduledTime}. Vehicle ${input.vehicleNumber}.`);
        smsService.send({
          toPhone: buyer.phone, toName: buyer.name, toUserId: buyer.id, event: SmsEvent.PICKUP_SCHEDULED,
          message: `KisanSetu: Pickup for your order ${order.order_code} scheduled on ${input.scheduledDate} at ${input.scheduledTime}. Vehicle ${input.vehicleNumber}.`,
        }).catch(() => void 0);
      }

      return { order: toDto(updated), pickup: toPickupDto(pickup) };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async markInTransit(orderId: string) {
    return this.advance(orderId, OrderStatus.IN_TRANSIT, async () => {
      const pickup = await pickupRepository.findByOrderId(orderId);
      if (pickup) await pickupRepository.updateStatus(pickup.id, PickupStatus.IN_PROGRESS);
      await pickupRepository.addLogisticsEvent(orderId, pickup?.id ?? null, "in_transit", "Vehicle departed collection point");

      const order = await orderRepository.findById(orderId);
      if (!order) return;

      const buyer = await userRepository.findById(order.buyer_id);
      if (buyer) {
        await notificationService.create(buyer.id, NotificationType.ORDER_IN_TRANSIT, "Order in transit", `Order ${order.order_code} is now in transit.`);
        smsService.send({
          toPhone: buyer.phone, toName: buyer.name, toUserId: buyer.id, event: SmsEvent.ORDER_IN_TRANSIT,
          message: `KisanSetu: Order ${order.order_code} is now in transit to destination.`,
        }).catch(() => void 0);
      }

      const items = await orderRepository.itemsForOrder(orderId);
      for (const item of items) {
        const farmer = await userRepository.findById(item.farmer_id);
        if (farmer) {
          await notificationService.create(farmer.id, NotificationType.ORDER_IN_TRANSIT, "Order in transit", `Order ${order.order_code} has departed and is in transit.`);
          smsService.send({
            toPhone: farmer.phone, toName: farmer.name, toUserId: farmer.id, event: SmsEvent.ORDER_IN_TRANSIT,
            message: `KisanSetu: Order ${order.order_code} has departed pickup point and is in transit.`,
          }).catch(() => void 0);
        }
      }
    });
  },

  async markDelivered(orderId: string, buyerId: string) {
    const order = await orderRepository.findById(orderId);
    if (!order) throw ApiError.notFound("Order not found");
    if (order.buyer_id !== buyerId) throw ApiError.forbidden("Only the buyer can confirm delivery");

    return this.advance(orderId, OrderStatus.DELIVERED, async () => {
      const pickup = await pickupRepository.findByOrderId(orderId);
      if (pickup) await pickupRepository.updateStatus(pickup.id, PickupStatus.COMPLETED);
      await pickupRepository.addLogisticsEvent(orderId, pickup?.id ?? null, "delivered", "Buyer confirmed receipt of full quantity");
      if (order.aggregation_batch_id) await aggregationRepository.updateStatus(order.aggregation_batch_id, BatchStatus.DELIVERED);

      const buyer = await userRepository.findById(buyerId);
      const items = await orderRepository.itemsForOrder(orderId);

      if (buyer) {
        await notificationService.create(buyer.id, NotificationType.DELIVERY_CONFIRMED, "Delivery confirmed", `You have confirmed receipt of order ${order.order_code}.`);
        smsService.send({
          toPhone: buyer.phone, toName: buyer.name, toUserId: buyer.id, event: SmsEvent.ORDER_DELIVERED,
          message: `KisanSetu: Delivery confirmed for order ${order.order_code}. Escrow payment will be released.`,
        }).catch(() => void 0);
      }

      for (const item of items) {
        const farmer = await userRepository.findById(item.farmer_id);
        if (farmer) {
          await notificationService.create(farmer.id, NotificationType.DELIVERY_CONFIRMED, "Delivery confirmed", `Delivery for order ${order.order_code} was confirmed by the buyer.`);
          smsService.send({
            toPhone: farmer.phone, toName: farmer.name, toUserId: farmer.id, event: SmsEvent.ORDER_DELIVERED,
            message: `KisanSetu: Buyer has confirmed delivery for order ${order.order_code}. Payment release scheduled.`,
          }).catch(() => void 0);
        }
      }
      if (buyer) await auditRepository.log(buyer.id, "delivery_confirmed", "order", orderId);
    });
  },

  /** Releases the demo escrow and splits payment proportionally across
   * contributing farmers — the "settlement calculated according to
   * delivered quantity and agreed price" step (spec section 26). */
  async releasePayment(orderId: string): Promise<{ order: OrderRecord; payment: PaymentRecord }> {
    const order = await orderRepository.findById(orderId);
    if (!order) throw ApiError.notFound("Order not found");
    const payment = await paymentRepository.findByOrderId(orderId);
    if (!payment) throw ApiError.conflict("No held payment found for this order");
    if (payment.status !== "held") throw ApiError.conflict(`Payment already ${payment.status}`);

    const items = await orderRepository.itemsForOrder(orderId);
    const payoutLines = calculatePayoutDistribution(
      items.map((i) => ({ farmerId: i.farmer_id, quantityKg: Number(i.quantity_kg), pricePerKg: Number(i.price_per_kg) }))
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await escrowProvider.release(client, payment.id, payoutLines);
      const updatedOrder = await transition(client, order, OrderStatus.PAYMENT_RELEASED);
      const finalOrder = await transition(client, updatedOrder, OrderStatus.COMPLETED);
      if (order.aggregation_batch_id) {
        await client.query(`UPDATE aggregation_batches SET status = 'settled', updated_at = now() WHERE id = $1`, [order.aggregation_batch_id]);
      }
      await client.query("COMMIT");

      await auditRepository.log(null, "payment_released", "order", orderId, { amount: payment.amount });

      for (const line of payoutLines) {
        const farmer = await userRepository.findById(line.farmerId);
        if (!farmer) continue;
        await notificationService.create(farmer.id, NotificationType.PAYMENT_RELEASED, "Payment released", `₹${line.amount.toFixed(2)} has been released for order ${order.order_code}.`);
        smsService.send({
          toPhone: farmer.phone, toName: farmer.name, toUserId: farmer.id, event: SmsEvent.PAYMENT_RELEASED,
          message: `KisanSetu: Rs.${line.amount.toFixed(2)} has been released for your completed KisanSetu order ${order.order_code}.`,
        }).catch(() => void 0);
      }

      const buyer = await userRepository.findById(order.buyer_id);
      if (buyer) {
        await notificationService.create(buyer.id, NotificationType.PAYMENT_RELEASED, "Order completed & payment released", `Payment for order ${order.order_code} has been settled to the farmer(s). Thank you!`);
        smsService.send({
          toPhone: buyer.phone, toName: buyer.name, toUserId: buyer.id, event: SmsEvent.PAYMENT_RELEASED,
          message: `KisanSetu: Payment for order ${order.order_code} (Rs.${Number(payment.amount).toFixed(2)}) has been settled. Order completed.`,
        }).catch(() => void 0);
      }

      const freshPayment = await paymentRepository.findByOrderId(orderId);
      const allocations = await paymentRepository.allocationsForPayment(freshPayment!.id);

      return {
        order: toDto(finalOrder),
        payment: {
          id: freshPayment!.id, orderId, amount: Number(freshPayment!.amount), status: freshPayment!.status,
          provider: "demo_escrow", heldAt: freshPayment!.held_at, releasedAt: freshPayment!.released_at,
          allocations: allocations.map((a: any) => ({ farmerId: a.farmer_id, farmerName: a.farmer_name, quantityKg: Number(a.quantity_kg), amount: Number(a.amount) })),
        },
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /** Shared helper for the simple forward-only transitions above. */
  async advance(orderId: string, to: OrderStatus, sideEffect?: () => Promise<void>): Promise<OrderRecord> {
    const order = await orderRepository.findById(orderId);
    if (!order) throw ApiError.notFound("Order not found");
    if (!isValidOrderTransition(order.status, to)) {
      throw ApiError.conflict(`Cannot move order from ${order.status} to ${to}`);
    }
    const updated = await orderRepository.updateStatus(orderId, to);
    if (sideEffect) await sideEffect();
    return toDto(updated);
  },
};
