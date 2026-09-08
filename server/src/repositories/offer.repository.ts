import { query } from "../db/pool";
import { OfferHistoryEntry, OfferStatus } from "@kisansetu/shared";

export interface OfferRow {
  id: string;
  listing_id: string;
  buyer_id: string;
  farmer_id: string;
  offered_price_per_kg: string;
  quantity_kg: string;
  status: OfferStatus;
  history: OfferHistoryEntry[];
  created_at: string;
  updated_at: string;
  crop_code?: string;
  farmer_name?: string;
  buyer_name?: string;
}

export const offerRepository = {
  async create(input: {
    listingId: string;
    buyerId: string;
    farmerId: string;
    offeredPricePerKg: number;
    quantityKg: number;
    history: OfferHistoryEntry[];
  }): Promise<OfferRow> {
    const { rows } = await query<OfferRow>(
      `INSERT INTO offers (listing_id, buyer_id, farmer_id, offered_price_per_kg, quantity_kg, status, history)
       VALUES ($1,$2,$3,$4,$5,'pending',$6::jsonb) RETURNING *`,
      [input.listingId, input.buyerId, input.farmerId, input.offeredPricePerKg, input.quantityKg, JSON.stringify(input.history)]
    );
    return rows[0];
  },

  async findById(id: string): Promise<OfferRow | null> {
    const { rows } = await query<OfferRow>(
      `SELECT o.*, pl.crop_code, f.name AS farmer_name, b.name AS buyer_name
       FROM offers o
       LEFT JOIN produce_listings pl ON pl.id = o.listing_id
       LEFT JOIN users f ON f.id = o.farmer_id
       LEFT JOIN users b ON b.id = o.buyer_id
       WHERE o.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async listForUser(userId: string, role: "farmer" | "buyer"): Promise<OfferRow[]> {
    const column = role === "farmer" ? "farmer_id" : "buyer_id";
    const { rows } = await query<OfferRow>(
      `SELECT o.*, pl.crop_code, f.name AS farmer_name, b.name AS buyer_name
       FROM offers o
       LEFT JOIN produce_listings pl ON pl.id = o.listing_id
       LEFT JOIN users f ON f.id = o.farmer_id
       LEFT JOIN users b ON b.id = o.buyer_id
       WHERE o.${column} = $1
       ORDER BY o.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async updateStatusAndHistory(id: string, status: OfferStatus, price: number, history: OfferHistoryEntry[]): Promise<OfferRow> {
    const { rows } = await query<OfferRow>(
      `UPDATE offers SET status = $2, offered_price_per_kg = $3, history = $4::jsonb, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, status, price, JSON.stringify(history)]
    );
    return rows[0];
  },
};
