/**
 * Negotiation (spec section 27): buyer offers, farmer can accept / reject /
 * counter, buyer can then accept / reject the counter, and so on. The full
 * back-and-forth is kept as a JSONB history array on the offer row so the
 * UI can render a clean timeline without reconstructing it from audit logs.
 */
import { ListingStatus, NotificationType, Offer, OfferHistoryEntry, OfferStatus, SmsEvent } from "@kisansetu/shared";
import { offerRepository, OfferRow } from "../repositories/offer.repository";
import { listingRepository } from "../repositories/listing.repository";
import { userRepository } from "../repositories/user.repository";
import { notificationService } from "./notification.service";
import { smsService } from "./sms.service";
import { auditRepository } from "../repositories/audit.repository";
import { ApiError } from "../utils/apiError";

function toDto(row: OfferRow): Offer {
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    farmerId: row.farmer_id,
    offeredPricePerKg: Number(row.offered_price_per_kg),
    quantityKg: Number(row.quantity_kg),
    status: row.status,
    history: row.history,
    createdAt: row.created_at,
    crop: row.crop_code,
    farmerName: row.farmer_name,
    buyerName: row.buyer_name,
  };
}

export const offerService = {
  async create(buyerId: string, input: { listingId: string; offeredPricePerKg: number; quantityKg: number }): Promise<Offer> {
    const listing = await listingRepository.findById(input.listingId);
    if (!listing) throw ApiError.notFound("Listing not found");
    if (listing.status !== "active") throw ApiError.conflict("This listing is no longer accepting offers");
    if (input.quantityKg > Number(listing.remaining_quantity_kg)) {
      throw ApiError.badRequest("Offer quantity exceeds what's currently available");
    }

    const history: OfferHistoryEntry[] = [
      { actor: "buyer", action: "offer", pricePerKg: input.offeredPricePerKg, at: new Date().toISOString() },
    ];
    const row = await offerRepository.create({
      listingId: input.listingId,
      buyerId,
      farmerId: listing.farmer_id,
      offeredPricePerKg: input.offeredPricePerKg,
      quantityKg: input.quantityKg,
      history,
    });

    await auditRepository.log(buyerId, "offer_created", "offer", row.id, { listingId: input.listingId });

    const farmer = await userRepository.findById(listing.farmer_id);
    if (farmer) {
      await notificationService.create(
        farmer.id, NotificationType.OFFER_RECEIVED, "New offer received",
        `You received an offer of ₹${input.offeredPricePerKg}/kg for ${input.quantityKg} kg of ${listing.crop_code}.`
      );
      smsService.send({
        toPhone: farmer.phone, toName: farmer.name, toUserId: farmer.id,
        event: SmsEvent.OFFER_RECEIVED,
        message: `KisanSetu: New offer of Rs.${input.offeredPricePerKg}/kg for ${input.quantityKg} kg of ${listing.crop_code}.`,
      }).catch(() => void 0);
    }

    return toDto(row);
  },

  async respond(offerId: string, actingUserId: string, actingRole: "farmer" | "buyer", input: {
    action: "accept" | "reject" | "counter"; counterPricePerKg?: number; note?: string;
  }): Promise<Offer> {
    const offer = await offerRepository.findById(offerId);
    if (!offer) throw ApiError.notFound("Offer not found");

    const isParty = actingRole === "farmer" ? offer.farmer_id === actingUserId : offer.buyer_id === actingUserId;
    if (!isParty) throw ApiError.forbidden("You are not a party to this offer");
    if (!["pending", "countered"].includes(offer.status)) {
      throw ApiError.conflict(`This offer is already ${offer.status} and can no longer be changed`);
    }

    const history = [...offer.history];
    let newStatus: OfferStatus = offer.status;
    let newPrice = Number(offer.offered_price_per_kg);

    if (input.action === "accept") {
      newStatus = OfferStatus.ACCEPTED;
      history.push({ actor: actingRole, action: "accept", pricePerKg: newPrice, at: new Date().toISOString() });
      const listing = await listingRepository.findById(offer.listing_id);
      if (listing && Number(offer.quantity_kg) >= Number(listing.remaining_quantity_kg) - 0.01) {
        await listingRepository.updateStatus(offer.listing_id, ListingStatus.RESERVED);
      }
    } else if (input.action === "reject") {
      newStatus = OfferStatus.REJECTED;
      history.push({ actor: actingRole, action: "reject", pricePerKg: newPrice, at: new Date().toISOString(), note: input.note });
    } else {
      newStatus = OfferStatus.COUNTERED;
      newPrice = input.counterPricePerKg!;
      history.push({ actor: actingRole, action: "counter", pricePerKg: newPrice, at: new Date().toISOString(), note: input.note });
    }

    const updated = await offerRepository.updateStatusAndHistory(offerId, newStatus, newPrice, history);
    await auditRepository.log(actingUserId, `offer_${input.action}`, "offer", offerId);

    const [buyer, farmer, listing] = await Promise.all([
      userRepository.findById(offer.buyer_id),
      userRepository.findById(offer.farmer_id),
      listingRepository.findById(offer.listing_id),
    ]);
    const cropName = listing?.crop_code ?? "produce";

    if (newStatus === OfferStatus.COUNTERED) {
      if (actingRole === "farmer" && buyer) {
        await notificationService.create(
          buyer.id, NotificationType.OFFER_COUNTERED, "Counter offer received",
          `Farmer ${farmer?.name ?? ""} countered your offer on ${cropName}: ₹${newPrice}/kg for ${Number(offer.quantity_kg)} kg.`
        );
        smsService.send({
          toPhone: buyer.phone, toName: buyer.name, toUserId: buyer.id,
          event: SmsEvent.OFFER_COUNTERED,
          message: `KisanSetu: Farmer ${farmer?.name ?? ""} countered your offer on ${cropName} with Rs.${newPrice}/kg for ${Number(offer.quantity_kg)} kg. Check your orders to respond.`,
        }).catch(() => void 0);
      } else if (actingRole === "buyer" && farmer) {
        await notificationService.create(
          farmer.id, NotificationType.OFFER_COUNTERED, "New counter offer",
          `Buyer ${buyer?.name ?? ""} countered back at ₹${newPrice}/kg for ${Number(offer.quantity_kg)} kg of ${cropName}.`
        );
        smsService.send({
          toPhone: farmer.phone, toName: farmer.name, toUserId: farmer.id,
          event: SmsEvent.OFFER_COUNTERED,
          message: `KisanSetu: Buyer ${buyer?.name ?? ""} countered back with Rs.${newPrice}/kg for ${Number(offer.quantity_kg)} kg of ${cropName}.`,
        }).catch(() => void 0);
      }
    } else if (newStatus === OfferStatus.ACCEPTED) {
      if (buyer) {
        await notificationService.create(
          buyer.id, NotificationType.OFFER_ACCEPTED, "Offer accepted",
          `Offer at ₹${newPrice}/kg for ${Number(offer.quantity_kg)} kg of ${cropName} was accepted.`
        );
        smsService.send({
          toPhone: buyer.phone, toName: buyer.name, toUserId: buyer.id,
          event: SmsEvent.OFFER_ACCEPTED,
          message: `KisanSetu: Offer accepted at Rs.${newPrice}/kg for ${Number(offer.quantity_kg)} kg of ${cropName}. Please proceed to confirm order.`,
        }).catch(() => void 0);
      }
      if (farmer) {
        await notificationService.create(
          farmer.id, NotificationType.OFFER_ACCEPTED, "Offer confirmed",
          `Offer confirmed at ₹${newPrice}/kg for ${Number(offer.quantity_kg)} kg of ${cropName}.`
        );
        smsService.send({
          toPhone: farmer.phone, toName: farmer.name, toUserId: farmer.id,
          event: SmsEvent.OFFER_ACCEPTED,
          message: `KisanSetu: Offer accepted at Rs.${newPrice}/kg for ${Number(offer.quantity_kg)} kg of ${cropName}. An order will be created shortly.`,
        }).catch(() => void 0);
      }
    }

    return toDto(updated);
  },

  async listForUser(userId: string, role: "farmer" | "buyer"): Promise<Offer[]> {
    const rows = await offerRepository.listForUser(userId, role);
    return rows.map(toDto);
  },

  async getById(id: string): Promise<Offer> {
    const row = await offerRepository.findById(id);
    if (!row) throw ApiError.notFound("Offer not found");
    return toDto(row);
  },
};
