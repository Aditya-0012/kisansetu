import { query } from "../db/pool";
import { BuyerType, PublicUser, UserRole } from "@kisansetu/shared";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  role: UserRole;
  buyer_type: BuyerType | null;
  region: string | null;
  village: string | null;
  latitude: number | null;
  longitude: number | null;
  language_preference: "en" | "hi" | "mr";
  low_connectivity_mode: boolean;
  is_verified: boolean;
  created_at: string;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    buyerType: row.buyer_type,
    region: row.region,
    village: row.village,
    languagePreference: row.language_preference,
    lowConnectivityMode: row.low_connectivity_mode,
    createdAt: row.created_at,
  };
}

export const userRepository = {
  async findByEmail(email: string): Promise<UserRow | null> {
    const { rows } = await query<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
    return rows[0] ?? null;
  },

  async findById(id: string): Promise<UserRow | null> {
    const { rows } = await query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] ?? null;
  },

  async existsByEmailOrPhone(email: string, phone: string): Promise<boolean> {
    const { rows } = await query(
      "SELECT 1 FROM users WHERE email = $1 OR phone = $2",
      [email, phone]
    );
    return rows.length > 0;
  },

  async create(input: {
    name: string;
    email: string;
    phone: string;
    passwordHash: string;
    role: UserRole;
    buyerType?: BuyerType;
    region?: string;
    village?: string;
    latitude?: number;
    longitude?: number;
    languagePreference: "en" | "hi" | "mr";
  }): Promise<UserRow> {
    const { rows } = await query<UserRow>(
      `INSERT INTO users (name, email, phone, password_hash, role, buyer_type, region, village,
        latitude, longitude, language_preference, is_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, TRUE)
       RETURNING *`,
      [
        input.name, input.email, input.phone, input.passwordHash, input.role,
        input.buyerType ?? null, input.region ?? null, input.village ?? null,
        input.latitude ?? null, input.longitude ?? null, input.languagePreference,
      ]
    );
    const user = rows[0];
    if (input.role === UserRole.FARMER) {
      await query(`INSERT INTO farmer_profiles (user_id) VALUES ($1)`, [user.id]);
    } else if (input.role === UserRole.BUYER) {
      await query(`INSERT INTO buyer_profiles (user_id, business_name) VALUES ($1, $2)`, [
        user.id, input.name,
      ]);
    }
    return user;
  },

  async setLowConnectivityMode(userId: string, enabled: boolean): Promise<void> {
    await query(`UPDATE users SET low_connectivity_mode = $2, updated_at = now() WHERE id = $1`, [
      userId, enabled,
    ]);
  },

  async farmerRatingSummary(userId: string): Promise<{ avgRating: number; totalRatings: number } | null> {
    const { rows } = await query(
      `SELECT avg_rating, total_ratings FROM farmer_profiles WHERE user_id = $1`,
      [userId]
    );
    if (!rows[0]) return null;
    return { avgRating: Number(rows[0].avg_rating), totalRatings: Number(rows[0].total_ratings) };
  },

  async updateProfile(
    userId: string,
    input: {
      name?: string;
      phone?: string;
      region?: string;
      village?: string;
      languagePreference?: "en" | "hi" | "mr";
      lowConnectivityMode?: boolean;
    }
  ): Promise<UserRow> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(input.name);
    }
    if (input.phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(input.phone);
    }
    if (input.region !== undefined) {
      fields.push(`region = $${idx++}`);
      values.push(input.region);
    }
    if (input.village !== undefined) {
      fields.push(`village = $${idx++}`);
      values.push(input.village);
    }
    if (input.languagePreference !== undefined) {
      fields.push(`language_preference = $${idx++}`);
      values.push(input.languagePreference);
    }
    if (input.lowConnectivityMode !== undefined) {
      fields.push(`low_connectivity_mode = $${idx++}`);
      values.push(input.lowConnectivityMode);
    }

    if (fields.length === 0) {
      const user = await this.findById(userId);
      if (!user) throw new Error("User not found");
      return user;
    }

    fields.push(`updated_at = now()`);
    values.push(userId);

    const { rows } = await query<UserRow>(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0];
  },
};
