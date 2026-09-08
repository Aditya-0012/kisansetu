-- ═══════════════════════════════════════════════════════════════════════
-- KisanSetu — Initial schema
-- PostgreSQL 13+. Uses core gen_random_uuid() (no extension required).
-- ═══════════════════════════════════════════════════════════════════════

-- ── users ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  phone               TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  role                TEXT NOT NULL CHECK (role IN ('farmer', 'buyer', 'admin')),
  buyer_type          TEXT CHECK (buyer_type IN ('retailer', 'restaurant', 'hostel', 'kirana', 'fpo', 'consumer')),
  region              TEXT,
  village             TEXT,
  latitude            NUMERIC(9,6),
  longitude           NUMERIC(9,6),
  language_preference TEXT NOT NULL DEFAULT 'en' CHECK (language_preference IN ('en', 'hi', 'mr')),
  low_connectivity_mode BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_region ON users(region);

-- ── farmer_profiles ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS farmer_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  avg_rating        NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_ratings     INT NOT NULL DEFAULT 0,
  total_orders      INT NOT NULL DEFAULT 0,
  total_earnings    NUMERIC(12,2) NOT NULL DEFAULT 0,
  verified_farmer   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── buyer_profiles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buyer_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name   TEXT,
  avg_rating      NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_ratings   INT NOT NULL DEFAULT 0,
  total_orders    INT NOT NULL DEFAULT 0,
  total_spend     NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── farms ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS farms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  region       TEXT NOT NULL,
  village      TEXT,
  latitude     NUMERIC(9,6),
  longitude    NUMERIC(9,6),
  size_acres   NUMERIC(6,2),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_farms_farmer ON farms(farmer_id);

-- ── crop_categories ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crop_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  unit        TEXT NOT NULL DEFAULT 'kg',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── produce_listings ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produce_listings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crop_code               TEXT NOT NULL REFERENCES crop_categories(code),
  variety                 TEXT,
  quantity_kg             NUMERIC(10,2) NOT NULL CHECK (quantity_kg > 0),
  remaining_quantity_kg   NUMERIC(10,2) NOT NULL CHECK (remaining_quantity_kg >= 0),
  unit                    TEXT NOT NULL DEFAULT 'kg',
  expected_price_per_kg   NUMERIC(8,2) NOT NULL CHECK (expected_price_per_kg > 0),
  harvest_date            DATE NOT NULL,
  quality                 TEXT NOT NULL CHECK (quality IN ('A', 'B', 'C')),
  region                  TEXT NOT NULL,
  village                 TEXT,
  latitude                NUMERIC(9,6),
  longitude               NUMERIC(9,6),
  description             TEXT,
  photo_url               TEXT,
  status                  TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'reserved', 'aggregated', 'sold', 'expired', 'withdrawn')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_listings_crop_region_status ON produce_listings(crop_code, region, status);
CREATE INDEX IF NOT EXISTS idx_listings_farmer ON produce_listings(farmer_id);

-- ── mandi_prices (current snapshot, one row per crop/region/mandi) ─────
CREATE TABLE IF NOT EXISTS mandi_prices (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_code              TEXT NOT NULL REFERENCES crop_categories(code),
  region                 TEXT NOT NULL,
  mandi_name             TEXT NOT NULL,
  price_per_kg           NUMERIC(8,2) NOT NULL,
  previous_price_per_kg  NUMERIC(8,2) NOT NULL,
  source                 TEXT NOT NULL DEFAULT 'seeded' CHECK (source IN ('government', 'seeded')),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (crop_code, region, mandi_name)
);
CREATE INDEX IF NOT EXISTS idx_mandi_prices_crop_region ON mandi_prices(crop_code, region);

-- ── price_history ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_code      TEXT NOT NULL REFERENCES crop_categories(code),
  region         TEXT NOT NULL,
  price_per_kg   NUMERIC(8,2) NOT NULL,
  recorded_date  DATE NOT NULL,
  source         TEXT NOT NULL DEFAULT 'seeded',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (crop_code, region, recorded_date)
);
CREATE INDEX IF NOT EXISTS idx_price_history_lookup ON price_history(crop_code, region, recorded_date);

-- ── demand_history ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demand_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_code      TEXT NOT NULL REFERENCES crop_categories(code),
  region         TEXT NOT NULL,
  recorded_date  DATE NOT NULL,
  demand_kg      NUMERIC(10,2) NOT NULL,
  orders_count   INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (crop_code, region, recorded_date)
);
CREATE INDEX IF NOT EXISTS idx_demand_history_lookup ON demand_history(crop_code, region, recorded_date);

-- ── demand_forecasts (cached model outputs) ──────────────────────────
CREATE TABLE IF NOT EXISTS demand_forecasts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_code           TEXT NOT NULL REFERENCES crop_categories(code),
  region              TEXT NOT NULL,
  horizon_days        INT NOT NULL,
  expected_demand_kg  NUMERIC(10,2) NOT NULL,
  lower_bound_kg      NUMERIC(10,2) NOT NULL,
  upper_bound_kg      NUMERIC(10,2) NOT NULL,
  growth_percent      NUMERIC(6,2) NOT NULL,
  confidence          NUMERIC(4,3) NOT NULL,
  trend               TEXT NOT NULL CHECK (trend IN ('rising', 'falling', 'stable')),
  methodology         TEXT NOT NULL CHECK (methodology IN ('internal_fallback', 'ml_service')),
  model_name          TEXT NOT NULL,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_lookup ON demand_forecasts(crop_code, region, generated_at DESC);

-- ── offers ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offers (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id             UUID NOT NULL REFERENCES produce_listings(id) ON DELETE CASCADE,
  buyer_id               UUID NOT NULL REFERENCES users(id),
  farmer_id              UUID NOT NULL REFERENCES users(id),
  offered_price_per_kg   NUMERIC(8,2) NOT NULL,
  quantity_kg            NUMERIC(10,2) NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'countered', 'accepted', 'rejected', 'expired')),
  history                JSONB NOT NULL DEFAULT '[]',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_offers_listing ON offers(listing_id);
CREATE INDEX IF NOT EXISTS idx_offers_buyer ON offers(buyer_id);

-- ── aggregation_batches (declared before orders: orders references it) ─
CREATE TABLE IF NOT EXISTS aggregation_batches (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code                TEXT NOT NULL UNIQUE,
  crop_code                 TEXT NOT NULL REFERENCES crop_categories(code),
  requested_quantity_kg     NUMERIC(10,2) NOT NULL,
  fulfilled_quantity_kg     NUMERIC(10,2) NOT NULL,
  destination_region        TEXT NOT NULL,
  buyer_id                  UUID REFERENCES users(id),
  average_distance_km       NUMERIC(6,2) NOT NULL,
  weighted_price_per_kg     NUMERIC(8,2) NOT NULL,
  estimated_total           NUMERIC(12,2) NOT NULL,
  listings_analyzed         INT NOT NULL DEFAULT 0,
  status                    TEXT NOT NULL DEFAULT 'forming'
                            CHECK (status IN ('forming', 'confirmed', 'pickup_scheduled', 'in_transit', 'delivered', 'settled', 'cancelled')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_batches_buyer ON aggregation_batches(buyer_id);

-- ── orders ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code             TEXT NOT NULL UNIQUE,
  buyer_id               UUID NOT NULL REFERENCES users(id),
  crop_code              TEXT NOT NULL REFERENCES crop_categories(code),
  total_quantity_kg      NUMERIC(10,2) NOT NULL,
  agreed_price_per_kg    NUMERIC(8,2) NOT NULL,
  total_amount           NUMERIC(12,2) NOT NULL,
  destination_region     TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'listed' CHECK (status IN (
                           'listed', 'offer_received', 'negotiating', 'confirmed', 'payment_held',
                           'batch_formed', 'pickup_scheduled', 'in_transit', 'delivered',
                           'payment_released', 'completed', 'cancelled', 'disputed'
                         )),
  aggregation_batch_id   UUID REFERENCES aggregation_batches(id),
  source_offer_id        UUID REFERENCES offers(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_batch ON orders(aggregation_batch_id);

-- ── order_items (per-farmer contribution within an order) ────────────
CREATE TABLE IF NOT EXISTS order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  listing_id    UUID NOT NULL REFERENCES produce_listings(id),
  farmer_id     UUID NOT NULL REFERENCES users(id),
  quantity_kg   NUMERIC(10,2) NOT NULL,
  price_per_kg  NUMERIC(8,2) NOT NULL,
  subtotal      NUMERIC(12,2) NOT NULL,
  distance_km   NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_farmer ON order_items(farmer_id);

-- ── aggregation_items (per-farmer contribution within a smart batch) ──
CREATE TABLE IF NOT EXISTS aggregation_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      UUID NOT NULL REFERENCES aggregation_batches(id) ON DELETE CASCADE,
  listing_id    UUID NOT NULL REFERENCES produce_listings(id),
  farmer_id     UUID NOT NULL REFERENCES users(id),
  quantity_kg   NUMERIC(10,2) NOT NULL,
  price_per_kg  NUMERIC(8,2) NOT NULL,
  subtotal      NUMERIC(12,2) NOT NULL,
  distance_km   NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agg_items_batch ON aggregation_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_agg_items_farmer ON aggregation_items(farmer_id);

-- ── payments (demo escrow) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'held', 'released', 'refunded', 'failed')),
  provider      TEXT NOT NULL DEFAULT 'demo_escrow',
  held_at       TIMESTAMPTZ,
  released_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── payment_allocations (per-farmer payout on release) ────────────────
CREATE TABLE IF NOT EXISTS payment_allocations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id    UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  farmer_id     UUID NOT NULL REFERENCES users(id),
  quantity_kg   NUMERIC(10,2) NOT NULL,
  amount        NUMERIC(12,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_farmer ON payment_allocations(farmer_id);

-- ── pickup_slots ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pickup_slots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  scheduled_date    DATE NOT NULL,
  scheduled_time    TEXT NOT NULL,
  location          TEXT NOT NULL,
  vehicle_number    TEXT NOT NULL,
  driver_name       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'missed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pickup_order ON pickup_slots(order_id);

-- ── logistics (event trail per order/pickup) ─────────────────────────
CREATE TABLE IF NOT EXISTS logistics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  pickup_id     UUID REFERENCES pickup_slots(id),
  event         TEXT NOT NULL,
  notes         TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logistics_order ON logistics(order_id);

-- ── ratings (two-way trust layer) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_user_id   UUID NOT NULL REFERENCES users(id),
  to_user_id     UUID NOT NULL REFERENCES users(id),
  quality        SMALLINT NOT NULL CHECK (quality BETWEEN 1 AND 5),
  reliability    SMALLINT NOT NULL CHECK (reliability BETWEEN 1 AND 5),
  communication  SMALLINT NOT NULL CHECK (communication BETWEEN 1 AND 5),
  timeliness     SMALLINT NOT NULL CHECK (timeliness BETWEEN 1 AND 5),
  overall        NUMERIC(3,2) NOT NULL,
  comment        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, from_user_id, to_user_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_to_user ON ratings(to_user_id);

-- ── notifications ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);

-- ── sms_logs (every SMS the platform "sends", mock or real) ──────────
CREATE TABLE IF NOT EXISTS sms_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone     TEXT NOT NULL,
  recipient_name      TEXT,
  recipient_user_id   UUID REFERENCES users(id),
  message             TEXT NOT NULL,
  event               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed')),
  provider            TEXT NOT NULL DEFAULT 'mock' CHECK (provider IN ('mock', 'fast2sms', 'twilio')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON sms_logs(created_at DESC);

-- ── audit_logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id    UUID REFERENCES users(id),
  action           TEXT NOT NULL,
  entity_type      TEXT NOT NULL,
  entity_id        UUID,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
