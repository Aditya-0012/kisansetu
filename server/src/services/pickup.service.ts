import { PickupSlot } from "@kisansetu/shared";
import { pickupRepository } from "../repositories/pickup.repository";

export function toPickupDto(r: any): PickupSlot {
  return {
    id: r.id,
    orderId: r.order_id,
    scheduledDate:
      r.scheduled_date instanceof Date
        ? r.scheduled_date.toISOString().slice(0, 10)
        : String(r.scheduled_date).slice(0, 10),
    scheduledTime: r.scheduled_time,
    location: r.location,
    vehicleNumber: r.vehicle_number,
    driverName: r.driver_name,
    status: r.status,
  };
}

export const pickupService = {
  async upcoming() {
    const rows = await pickupRepository.upcoming();
    return rows.map(toPickupDto);
  },
  async forOrder(orderId: string) {
    const [pickup, events] = await Promise.all([
      pickupRepository.findByOrderId(orderId),
      pickupRepository.eventsForOrder(orderId),
    ]);
    return { pickup: pickup ? toPickupDto(pickup) : null, events };
  },
};

