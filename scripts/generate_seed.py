#!/usr/bin/env python3
"""
Generates KisanSetu's demo dataset:
  - server/src/db/seed/seed.sql   (everything: entities + bulk time series via COPY)
  - ml/data/historical_demand.csv (same demand series, for the ML training pipeline)
  - ml/data/historical_price.csv  (same price series, for the ML training pipeline)

Design goal: the database and the ML pipeline must train/query the *same*
underlying numbers, so this script is the single source of truth for both —
run once, both artifacts come out consistent with each other.

The historical series are synthetic but built from real seasonal structure
(weekly retail cycles, crop-specific trend, bounded noise) rather than pure
random noise, so a regression model trained on them finds a genuine signal
instead of overfitting static noise. Nothing here is claimed as real market
data — see docs/demand-forecasting.md and docs/price-intelligence.md for the
"seeded vs. government source" distinction that the running app also makes.
"""
import csv
import hashlib
import math
import os
import random
import uuid
from datetime import date, timedelta

random.seed(42)

TODAY = date(2026, 9, 7)
HISTORY_DAYS = 150
START_DATE = TODAY - timedelta(days=HISTORY_DAYS - 1)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED_SQL_PATH = os.path.join(REPO_ROOT, "server", "src", "db", "seed", "seed.sql")
ML_DATA_DIR = os.path.join(REPO_ROOT, "ml", "data")

# Precomputed with Node's crypto.scrypt for the literal string "Demo@123".
# Every seeded account (including the three canonical demo logins) shares
# this password so judges can log into ANY seeded farmer/buyer, not just
# the three headline accounts.
DEMO_PASSWORD_HASH = (
    "bbe66e7a852979c4df0bd503b3d7c7fd:"
    "2b46b4d1148e92f751c43d047a603a9d2758410f23df28eec91e675b6e1e40624f2"
    "00cca22797366a998091cf322ae99e9e538b132c254ffb833393dbcabcc3a"
)


def uid(name: str) -> str:
    """Deterministic v5 UUID from a human-readable key — real UUIDs, stable
    across re-runs, and easy to cross-reference while reading this script."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"kisansetu:{name}"))


def esc(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def num(x):
    if x is None:
        return "NULL"
    return f"{x:.2f}"


REGIONS = {
    "Nashik": (19.9975, 73.7898),
    "Pune": (18.5204, 73.8567),
    "Satara": (17.6805, 74.0183),
    "Sangli": (16.8524, 74.5815),
    "Ahmednagar": (19.0948, 74.7480),
}

CROPS = {
    "tomato": {"name": "Tomato", "base_price": 19.0, "end_price": 24.0},
    "onion": {"name": "Onion", "base_price": 24.5, "end_price": 28.0},
    "potato": {"name": "Potato", "base_price": 21.4, "end_price": 21.0},
    "grapes": {"name": "Grapes", "base_price": 52.0, "end_price": 58.0},
    "pomegranate": {"name": "Pomegranate", "base_price": 82.0, "end_price": 91.0},
    "wheat": {"name": "Wheat", "base_price": 24.5, "end_price": 24.8},
}

# base daily demand (kg) per crop per region — rough relative city/production scale
DEMAND_BASE = {
    "tomato": {"Pune": 380, "Nashik": 260, "Satara": 140, "Sangli": 120, "Ahmednagar": 150},
    "onion": {"Pune": 420, "Nashik": 300, "Satara": 160, "Sangli": 180, "Ahmednagar": 170},
    "potato": {"Pune": 350, "Nashik": 240, "Satara": 150, "Sangli": 140, "Ahmednagar": 160},
    "grapes": {"Pune": 90, "Nashik": 140, "Satara": 40, "Sangli": 110, "Ahmednagar": 50},
    "pomegranate": {"Pune": 100, "Nashik": 130, "Satara": 60, "Sangli": 70, "Ahmednagar": 140},
    "wheat": {"Pune": 300, "Nashik": 200, "Satara": 180, "Sangli": 160, "Ahmednagar": 220},
}

# recent-45-day cumulative trend applied to demand (rising/falling narrative)
DEMAND_TREND_45D = {
    "tomato": 0.18,
    "onion": 0.07,
    "potato": -0.021,
    "grapes": 0.05,
    "pomegranate": 0.03,
    "wheat": -0.01,
}

DEMAND_NOISE = {
    "tomato": 0.07, "onion": 0.06, "potato": 0.05,
    "grapes": 0.08, "pomegranate": 0.06, "wheat": 0.04,
}

WEEKEND_BUMP = {
    "tomato": 0.15, "onion": 0.10, "potato": 0.08,
    "grapes": 0.12, "pomegranate": 0.10, "wheat": 0.02,
}


def demand_series(crop, region):
    base = DEMAND_BASE[crop][region]
    trend45 = DEMAND_TREND_45D[crop]
    noise = DEMAND_NOISE[crop]
    weekend = WEEKEND_BUMP[crop]
    series = []
    for t in range(HISTORY_DAYS):
        d = START_DATE + timedelta(days=t)
        days_from_end = (HISTORY_DAYS - 1) - t
        # trend ramps in linearly over the most recent 45 days, flat before that
        if days_from_end <= 45:
            trend_factor = 1 + trend45 * (1 - days_from_end / 45)
        else:
            trend_factor = 1.0
        weekly = 1 + (weekend if d.weekday() >= 4 else 0.0)  # Fri/Sat/Sun bump
        seasonal_wave = 1 + 0.06 * math.sin(2 * math.pi * t / 60 + hash(crop) % 7)
        noise_factor = 1 + random.uniform(-noise, noise)
        value = base * trend_factor * weekly * seasonal_wave * noise_factor
        series.append((d, max(5.0, value)))
    return series


def price_series(crop, region):
    meta = CROPS[crop]
    base, end = meta["base_price"], meta["end_price"]
    region_adj = {"Pune": 1.03, "Nashik": 1.0, "Satara": 0.97, "Sangli": 0.96, "Ahmednagar": 0.98}[region]
    series = []
    for t in range(HISTORY_DAYS):
        d = START_DATE + timedelta(days=t)
        progress = t / (HISTORY_DAYS - 1)
        drift = base + (end - base) * progress
        seasonal_wave = 1 + 0.03 * math.sin(2 * math.pi * t / 21 + hash(crop + region) % 5)
        noise_factor = 1 + random.uniform(-0.025, 0.025)
        value = drift * region_adj * seasonal_wave * noise_factor
        series.append((d, round(max(3.0, value), 2)))
    return series


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def jitter_coords(base_lat, base_lon, seed_key, spread=0.25):
    r = random.Random(seed_key)
    return (
        round(base_lat + r.uniform(-spread, spread), 6),
        round(base_lon + r.uniform(-spread, spread), 6),
    )


lines = []


def sql(s=""):
    lines.append(s)


sql("-- ═══════════════════════════════════════════════════════════════════")
sql("-- KisanSetu demo seed data — GENERATED by scripts/generate_seed.py")
sql("-- Do not hand-edit; re-run the generator instead.")
sql("-- ═══════════════════════════════════════════════════════════════════")
sql("BEGIN;")
sql("TRUNCATE TABLE audit_logs, sms_logs, notifications, ratings, logistics, pickup_slots,")
sql("  payment_allocations, payments, aggregation_items, aggregation_batches, order_items,")
sql("  orders, offers, price_history, demand_history, demand_forecasts, mandi_prices,")
sql("  produce_listings, farms, buyer_profiles, farmer_profiles, users, crop_categories")
sql("  RESTART IDENTITY CASCADE;")
sql("")

# ── crop_categories ────────────────────────────────────────────────────
sql("-- crop_categories")
for code, meta in CROPS.items():
    sql(
        f"INSERT INTO crop_categories (id, code, name, unit) VALUES "
        f"({esc(uid('crop:'+code))}, {esc(code)}, {esc(meta['name'])}, 'kg');"
    )
sql("")

# ── farmers ─────────────────────────────────────────────────────────────
FARMERS = [
    ("Rajesh Patil", "Nashik", "Niphad"),
    ("Priya Deshmukh", "Nashik", "Sinnar"),
    ("Ganesh Shinde", "Nashik", "Dindori"),
    ("Anita Kale", "Nashik", "Yeola"),
    ("Vikram Pawar", "Pune", "Junnar"),
    ("Meena Kadam", "Pune", "Baramati"),
    ("Suresh Bhosale", "Satara", "Wai"),
    ("Lata Chavan", "Satara", "Phaltan"),
    ("Dinesh Salunkhe", "Satara", "Karad"),
    ("Amit Jadhav", "Sangli", "Tasgaon"),
    ("Kavita Wagh", "Sangli", "Miraj"),
    ("Ramesh Gaikwad", "Sangli", "Vita"),
    ("Prakash Thorat", "Ahmednagar", "Rahata"),
    ("Sunita More", "Ahmednagar", "Shrirampur"),
    ("Sangeeta Nikam", "Ahmednagar", "Kopargaon"),
]

FARMER_CROP_FOCUS = [
    # Tomato is the flagship crop referenced throughout the demo narrative
    # (the Smart Aggregation / SIH Demo Mode walkthrough), so it gets more
    # primary listings than a proportional 1/6 split would give it —
    # otherwise a live "find supply" run during the demo turns up too few
    # candidates once a couple of historical batches have consumed stock.
    "tomato", "onion", "tomato", "onion", "tomato", "potato",
    "grapes", "tomato", "wheat", "grapes", "grapes", "tomato",
    "pomegranate", "pomegranate", "wheat",
]

sql("-- farmers (users + farmer_profiles + farms)")
farmer_ids = []
for i, (name, region, village) in enumerate(FARMERS, start=1):
    fid = uid(f"farmer:{i}")
    farmer_ids.append(fid)
    email = f"{name.lower().replace(' ', '.')}@kisansetu.demo" if i > 1 else "farmer@kisansetu.demo"
    phone = f"9822{100000 + i:06d}"[:13]
    lat0, lon0 = REGIONS[region]
    lat, lon = jitter_coords(lat0, lon0, f"farmer{i}")
    rating = round(random.uniform(4.1, 5.0), 2)
    total_orders = random.randint(6, 40)
    total_earnings = round(total_orders * random.uniform(1800, 5200), 2)
    sql(
        f"INSERT INTO users (id, name, email, phone, password_hash, role, region, village, "
        f"latitude, longitude, language_preference, is_verified) VALUES "
        f"({esc(fid)}, {esc(name)}, {esc(email)}, {esc(phone)}, {esc(DEMO_PASSWORD_HASH)}, "
        f"'farmer', {esc(region)}, {esc(village)}, {lat}, {lon}, 'en', TRUE);"
    )
    sql(
        f"INSERT INTO farmer_profiles (id, user_id, avg_rating, total_ratings, total_orders, "
        f"total_earnings, verified_farmer) VALUES ({esc(uid('fp:'+str(i)))}, {esc(fid)}, "
        f"{rating}, {random.randint(5, 60)}, {total_orders}, {num(total_earnings)}, TRUE);"
    )
    sql(
        f"INSERT INTO farms (id, farmer_id, name, region, village, latitude, longitude, size_acres) "
        f"VALUES ({esc(uid('farm:'+str(i)))}, {esc(fid)}, {esc(name.split()[0] + ' Farm')}, "
        f"{esc(region)}, {esc(village)}, {lat}, {lon}, {round(random.uniform(1.5, 8.0), 1)});"
    )
sql("")

# ── buyers ──────────────────────────────────────────────────────────────
BUYERS = [
    ("FreshMart Retail", "retailer", "Pune"),
    ("Spice Route Restaurant", "restaurant", "Pune"),
    ("Sahyadri Boys Hostel", "hostel", "Pune"),
    ("Om Kirana Store", "kirana", "Nashik"),
    ("Sahyadri Farmers FPO", "fpo", "Nashik"),
    ("Anjali Kulkarni", "consumer", "Pune"),
    ("Green Basket Retail", "retailer", "Nashik"),
]
sql("-- buyers (users + buyer_profiles)")
buyer_ids = []
for i, (name, btype, region) in enumerate(BUYERS, start=1):
    bid = uid(f"buyer:{i}")
    buyer_ids.append(bid)
    email = f"{name.lower().replace(' ', '.')}@kisansetu.demo" if i > 1 else "buyer@kisansetu.demo"
    phone = f"9833{200000 + i:06d}"[:13]
    lat0, lon0 = REGIONS[region]
    lat, lon = jitter_coords(lat0, lon0, f"buyer{i}", spread=0.08)
    rating = round(random.uniform(4.0, 5.0), 2)
    total_orders = random.randint(4, 25)
    total_spend = round(total_orders * random.uniform(2500, 9000), 2)
    sql(
        f"INSERT INTO users (id, name, email, phone, password_hash, role, buyer_type, region, "
        f"latitude, longitude, language_preference, is_verified) VALUES "
        f"({esc(bid)}, {esc(name)}, {esc(email)}, {esc(phone)}, {esc(DEMO_PASSWORD_HASH)}, "
        f"'buyer', {esc(btype)}, {esc(region)}, {lat}, {lon}, 'en', TRUE);"
    )
    sql(
        f"INSERT INTO buyer_profiles (id, user_id, business_name, avg_rating, total_ratings, "
        f"total_orders, total_spend) VALUES ({esc(uid('bp:'+str(i)))}, {esc(bid)}, {esc(name)}, "
        f"{rating}, {random.randint(3, 30)}, {total_orders}, {num(total_spend)});"
    )
sql("")

# ── admin ───────────────────────────────────────────────────────────────
admin_id = uid("admin:1")
sql("-- admin")
sql(
    f"INSERT INTO users (id, name, email, phone, password_hash, role, region, language_preference, "
    f"is_verified) VALUES ({esc(admin_id)}, 'KisanSetu Admin', 'admin@kisansetu.demo', "
    f"'9800000000', {esc(DEMO_PASSWORD_HASH)}, 'admin', 'Pune', 'en', TRUE);"
)
sql("")

print(f"Generated {len(farmer_ids)} farmers, {len(buyer_ids)} buyers + admin so far...")

# ── produce_listings (30) ────────────────────────────────────────────────
sql("-- produce_listings")
QUALITY_CHOICES = ["A", "A", "A", "B", "B", "C"]
listing_ids = []
listing_meta = {}  # id -> dict(crop, region, farmer_id, lat, lon, price, qty, remaining)

N_LISTINGS = 30
for i in range(1, N_LISTINGS + 1):
    farmer_idx = (i - 1) % len(FARMERS)
    fid = farmer_ids[farmer_idx]
    name, region, village = FARMERS[farmer_idx]
    crop = FARMER_CROP_FOCUS[farmer_idx] if i <= len(FARMERS) else random.choice(list(CROPS.keys()))
    lid = uid(f"listing:{i}")
    listing_ids.append(lid)
    lat0, lon0 = REGIONS[region]
    lat, lon = jitter_coords(lat0, lon0, f"listing{i}", spread=0.2)
    end_price = CROPS[crop]["end_price"]
    price = round(end_price * random.uniform(0.9, 1.08), 2)
    qty = round(random.uniform(80, 400), 1)
    # a few listings partially/fully committed, to look lived-in
    remaining = qty if i % 5 != 0 else round(qty * random.uniform(0.3, 0.8), 1)
    status = "active"
    if i % 9 == 0:
        status = "aggregated"
    elif i % 11 == 0:
        status = "sold"
    quality = random.choice(QUALITY_CHOICES)
    harvest_offset = random.randint(-6, 10)
    harvest_date = TODAY + timedelta(days=harvest_offset)
    variety = {
        "tomato": random.choice(["Hybrid Desi", "Roma", "Pusa Ruby"]),
        "onion": random.choice(["Nashik Red", "Pusa Red", "Bellary Red"]),
        "potato": random.choice(["Kufri Jyoti", "Kufri Pukhraj"]),
        "grapes": random.choice(["Thompson Seedless", "Sonaka"]),
        "pomegranate": random.choice(["Bhagwa", "Ganesh"]),
        "wheat": random.choice(["Lokwan", "Sharbati"]),
    }[crop]
    description = f"Fresh {quality}-grade {CROPS[crop]['name'].lower()} harvested near {village}, {region}."
    listing_meta[lid] = {
        "crop": crop, "region": region, "farmer_id": fid, "farmer_idx": farmer_idx,
        "lat": lat, "lon": lon, "price": price, "qty": qty, "remaining": remaining,
        "village": village, "name": name,
    }
    sql(
        f"INSERT INTO produce_listings (id, farmer_id, crop_code, variety, quantity_kg, "
        f"remaining_quantity_kg, unit, expected_price_per_kg, harvest_date, quality, region, "
        f"village, latitude, longitude, description, status) VALUES ({esc(lid)}, {esc(fid)}, "
        f"{esc(crop)}, {esc(variety)}, {num(qty)}, {num(remaining)}, 'kg', {num(price)}, "
        f"{esc(harvest_date.isoformat())}, {esc(quality)}, {esc(region)}, {esc(village)}, "
        f"{lat}, {lon}, {esc(description)}, {esc(status)});"
    )
sql("")

# ── bulk time series: demand_history + price_history (also written as CSV) ─
os.makedirs(ML_DATA_DIR, exist_ok=True)
demand_rows = []  # (crop, region, date, demand_kg, orders_count)
price_rows = []   # (crop, region, date, price_per_kg)

for crop in CROPS:
    for region in REGIONS:
        dseries = demand_series(crop, region)
        pseries = price_series(crop, region)
        avg_order_kg = {"tomato": 22, "onion": 25, "potato": 28, "grapes": 18, "pomegranate": 15, "wheat": 45}[crop]
        for d, val in dseries:
            orders_count = max(1, round(val / random.uniform(avg_order_kg * 0.7, avg_order_kg * 1.3)))
            demand_rows.append((crop, region, d.isoformat(), round(val, 2), orders_count))
        for d, val in pseries:
            price_rows.append((crop, region, d.isoformat(), val))

print(f"Generated {len(demand_rows)} demand rows, {len(price_rows)} price rows.")

with open(os.path.join(ML_DATA_DIR, "historical_demand.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["crop", "region", "date", "demand_kg", "orders_count"])
    w.writerows(demand_rows)

with open(os.path.join(ML_DATA_DIR, "historical_price.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["crop", "region", "date", "price_per_kg"])
    w.writerows(price_rows)

sql("-- demand_history (bulk load)")
sql("COPY demand_history (id, crop_code, region, recorded_date, demand_kg, orders_count) FROM stdin;")
for crop, region, d, val, oc in demand_rows:
    sql(f"{uid('dh:'+crop+region+d)}\t{crop}\t{region}\t{d}\t{val}\t{oc}")
sql("\\.")
sql("")

sql("-- price_history (bulk load)")
sql("COPY price_history (id, crop_code, region, recorded_date, price_per_kg, source) FROM stdin;")
for crop, region, d, val in price_rows:
    sql(f"{uid('ph:'+crop+region+d)}\t{crop}\t{region}\t{d}\t{val}\tseeded")
sql("\\.")
sql("")

# ── mandi_prices (current snapshot per crop x region) ───────────────────
sql("-- mandi_prices (current snapshot)")
price_lookup = {}  # (crop, region) -> list of (date, price) sorted
for crop in CROPS:
    for region in REGIONS:
        rows = [(d, v) for (c, r, d, v) in price_rows if c == crop and r == region]
        price_lookup[(crop, region)] = rows

MANDI_NAMES = {
    "Nashik": "Nashik APMC", "Pune": "Pune Market Yard", "Satara": "Satara APMC",
    "Sangli": "Sangli APMC", "Ahmednagar": "Ahmednagar APMC",
}
for crop in CROPS:
    for region in REGIONS:
        rows = price_lookup[(crop, region)]
        current = rows[-1][1]
        previous = rows[-8][1]  # 7 days prior
        mandi_name = MANDI_NAMES[region]
        sql(
            f"INSERT INTO mandi_prices (id, crop_code, region, mandi_name, price_per_kg, "
            f"previous_price_per_kg, source, updated_at) VALUES "
            f"({esc(uid('mandi:'+crop+region))}, {esc(crop)}, {esc(region)}, {esc(mandi_name)}, "
            f"{num(current)}, {num(previous)}, 'seeded', now());"
        )
sql("")

print("Listings + time series done.")

# ── offers (negotiation threads) ─────────────────────────────────────────
sql("-- offers")
active_listings = [lid for lid in listing_ids if listing_meta[lid]["remaining"] > 20]
random.shuffle(active_listings)
OFFER_PLAN = [
    # (farmer_asks_discount_pct_for_buyer_first_offer, outcome)
    "accepted_direct", "accepted_after_counter", "accepted_after_counter",
    "rejected", "pending", "countered_pending", "accepted_direct",
    "accepted_after_counter", "rejected", "pending",
]
offer_ids = []
offer_outcomes = {}  # listing_id -> ("accepted"|..., final_price, qty, buyer_id)
for i, outcome in enumerate(OFFER_PLAN, start=1):
    lid = active_listings[i - 1]
    meta = listing_meta[lid]
    buyer_id = buyer_ids[i % len(buyer_ids)]
    ask = meta["price"]
    qty = round(min(meta["remaining"], random.uniform(30, 90)), 1)
    first_offer = round(ask * random.uniform(0.88, 0.95), 2)
    oid = uid(f"offer:{i}")
    offer_ids.append(oid)
    at0 = f"now() - interval '{random.randint(2,6)} days'"
    history = [
        {"actor": "buyer", "action": "offer", "pricePerKg": first_offer, "at": "T0"},
    ]
    status = "pending"
    final_price = first_offer
    if outcome == "accepted_direct":
        history.append({"actor": "farmer", "action": "accept", "pricePerKg": first_offer, "at": "T1"})
        status, final_price = "accepted", first_offer
    elif outcome == "accepted_after_counter":
        counter = round((ask + first_offer) / 2, 2)
        history.append({"actor": "farmer", "action": "counter", "pricePerKg": counter, "at": "T1"})
        history.append({"actor": "buyer", "action": "accept", "pricePerKg": counter, "at": "T2"})
        status, final_price = "accepted", counter
    elif outcome == "rejected":
        history.append({"actor": "farmer", "action": "reject", "pricePerKg": first_offer, "at": "T1", "note": "Price too low for current demand"})
        status, final_price = "rejected", first_offer
    elif outcome == "countered_pending":
        counter = round((ask + first_offer) / 2, 2)
        history.append({"actor": "farmer", "action": "counter", "pricePerKg": counter, "at": "T1"})
        status, final_price = "countered", counter
    # "pending" -> leave as-is

    history_json = str(history).replace("'", '"')
    sql(
        f"INSERT INTO offers (id, listing_id, buyer_id, farmer_id, offered_price_per_kg, "
        f"quantity_kg, status, history, created_at) VALUES ({esc(oid)}, {esc(lid)}, "
        f"{esc(buyer_id)}, {esc(meta['farmer_id'])}, {num(final_price)}, {num(qty)}, "
        f"{esc(status)}, {esc(history_json)}::jsonb, {at0});"
    )
    if status == "accepted":
        offer_outcomes[lid] = (buyer_id, final_price, qty, oid)
sql("")


# Reserve stock consumed by accepted offers *before* the aggregation engine
# picks candidates — otherwise the same kg could be counted in both a
# standalone order and a smart batch.
sql("-- reserve stock committed via accepted offers")
for lid, (buyer_id, final_price, qty, offer_id) in offer_outcomes.items():
    m = listing_meta[lid]
    m["remaining"] = round(m["remaining"] - qty, 2)
    new_status = "reserved" if m["remaining"] > 0.5 else "aggregated"
    sql(
        f"UPDATE produce_listings SET remaining_quantity_kg = {num(m['remaining'])}, "
        f"status = {esc(new_status)} WHERE id = {esc(lid)};"
    )
sql("")

# ── aggregation batches + smart-batch orders ─────────────────────────────
consumed = set()


def pick_for_batch(crop, exclude_status_check=True):
    cands = [
        (lid, m) for lid, m in listing_meta.items()
        if m["crop"] == crop and lid not in consumed and m["remaining"] > 15
    ]
    cands.sort(key=lambda x: x[1]["price"])
    return cands


def build_batch(batch_num, crop, dest_region, requested_qty, buyer_id, order_status, days_ago_confirmed):
    dlat, dlon = REGIONS[dest_region]
    cands = pick_for_batch(crop)
    contributions = []
    remaining_needed = requested_qty
    for lid, m in cands:
        if remaining_needed <= 0:
            break
        take = min(m["remaining"], remaining_needed)
        dist = round(haversine_km(dlat, dlon, m["lat"], m["lon"]), 1)
        contributions.append({"listing_id": lid, **m, "take": take, "distance": dist})
        remaining_needed -= take
        consumed.add(lid)
    fulfilled = sum(c["take"] for c in contributions)
    weighted_price = sum(c["take"] * c["price"] for c in contributions) / fulfilled if fulfilled else 0
    avg_distance = sum(c["distance"] for c in contributions) / len(contributions) if contributions else 0
    estimated_total = round(fulfilled * weighted_price, 2)

    batch_id = uid(f"batch:{batch_num}")
    batch_code = f"KS-BAT-{1040 + batch_num}"
    listings_analyzed = len(cands)

    sql(f"-- aggregation batch {batch_num}: {crop} -> {dest_region}")
    sql(
        f"INSERT INTO aggregation_batches (id, batch_code, crop_code, requested_quantity_kg, "
        f"fulfilled_quantity_kg, destination_region, buyer_id, average_distance_km, "
        f"weighted_price_per_kg, estimated_total, listings_analyzed, status, created_at) VALUES "
        f"({esc(batch_id)}, {esc(batch_code)}, {esc(crop)}, {num(requested_qty)}, {num(fulfilled)}, "
        f"{esc(dest_region)}, {esc(buyer_id)}, {round(avg_distance,1)}, {num(weighted_price)}, "
        f"{num(estimated_total)}, {listings_analyzed}, "
        f"{esc('settled' if order_status in ('payment_released','completed') else ('delivered' if order_status=='delivered' else ('in_transit' if order_status=='in_transit' else ('pickup_scheduled' if order_status=='pickup_scheduled' else 'confirmed'))))}, "
        f"now() - interval '{days_ago_confirmed} days');"
    )
    for j, c in enumerate(contributions, start=1):
        item_id = uid(f"aggitem:{batch_num}:{j}")
        subtotal = round(c["take"] * c["price"], 2)
        sql(
            f"INSERT INTO aggregation_items (id, batch_id, listing_id, farmer_id, quantity_kg, "
            f"price_per_kg, subtotal, distance_km) VALUES ({esc(item_id)}, {esc(batch_id)}, "
            f"{esc(c['listing_id'])}, {esc(c['farmer_id'])}, {num(c['take'])}, {num(c['price'])}, "
            f"{num(subtotal)}, {c['distance']});"
        )
        # reduce remaining stock + flip status if exhausted
        new_remaining = round(c["remaining"] - c["take"], 2)
        new_status = "aggregated" if new_remaining <= 0.5 else "reserved"
        sql(
            f"UPDATE produce_listings SET remaining_quantity_kg = {num(new_remaining)}, "
            f"status = {esc(new_status)} WHERE id = {esc(c['listing_id'])};"
        )

    # ── order tied to this batch ──
    order_id = uid(f"order:batch:{batch_num}")
    order_code = f"KS-ORD-{2040 + batch_num}"
    total_qty = fulfilled
    total_amount = estimated_total
    sql(
        f"INSERT INTO orders (id, order_code, buyer_id, crop_code, total_quantity_kg, "
        f"agreed_price_per_kg, total_amount, destination_region, status, aggregation_batch_id, "
        f"created_at) VALUES ({esc(order_id)}, {esc(order_code)}, {esc(buyer_id)}, {esc(crop)}, "
        f"{num(total_qty)}, {num(weighted_price)}, {num(total_amount)}, {esc(dest_region)}, "
        f"{esc(order_status)}, {esc(batch_id)}, now() - interval '{days_ago_confirmed} days');"
    )
    for j, c in enumerate(contributions, start=1):
        oi_id = uid(f"orderitem:{batch_num}:{j}")
        subtotal = round(c["take"] * c["price"], 2)
        sql(
            f"INSERT INTO order_items (id, order_id, listing_id, farmer_id, quantity_kg, "
            f"price_per_kg, subtotal, distance_km) VALUES ({esc(oi_id)}, {esc(order_id)}, "
            f"{esc(c['listing_id'])}, {esc(c['farmer_id'])}, {num(c['take'])}, {num(c['price'])}, "
            f"{num(subtotal)}, {c['distance']});"
        )
    return order_id, order_code, contributions, total_amount, weighted_price, crop, buyer_id, dest_region


BATCH_PLAN = [
    (1, "tomato", "Pune", 500, buyer_ids[0], "completed", 9),
    (2, "onion", "Nashik", 350, buyer_ids[4], "payment_released", 6),
    (3, "grapes", "Nashik", 220, buyer_ids[6], "in_transit", 3),
    (4, "pomegranate", "Ahmednagar", 150, buyer_ids[1], "pickup_scheduled", 2),
    (5, "wheat", "Pune", 400, buyer_ids[2], "confirmed", 1),
]
batch_orders = []
for plan in BATCH_PLAN:
    batch_orders.append(build_batch(*plan))
sql("")

print("Aggregation batches + orders built.")

# ── standalone (single-farmer) orders from accepted offers ──────────────
BUYER_REGION = {buyer_ids[i]: BUYERS[i][2] for i in range(len(BUYERS))}
STANDALONE_STATUS_PLAN = ["completed", "payment_released", "delivered", "pickup_scheduled", "confirmed"]
standalone_orders = []
for idx, (lid, (buyer_id, price, qty, offer_id)) in enumerate(offer_outcomes.items()):
    if idx >= len(STANDALONE_STATUS_PLAN):
        break
    m = listing_meta[lid]
    status = STANDALONE_STATUS_PLAN[idx]
    dest_region = BUYER_REGION[buyer_id]
    dlat, dlon = REGIONS[dest_region]
    dist = round(haversine_km(dlat, dlon, m["lat"], m["lon"]), 1)
    total_amount = round(qty * price, 2)
    order_id = uid(f"order:standalone:{idx+1}")
    order_code = f"KS-ORD-{2010 + idx}"
    days_ago = [11, 7, 5, 2, 1][idx]
    sql(
        f"INSERT INTO orders (id, order_code, buyer_id, crop_code, total_quantity_kg, "
        f"agreed_price_per_kg, total_amount, destination_region, status, source_offer_id, "
        f"created_at) VALUES ({esc(order_id)}, {esc(order_code)}, {esc(buyer_id)}, {esc(m['crop'])}, "
        f"{num(qty)}, {num(price)}, {num(total_amount)}, {esc(dest_region)}, {esc(status)}, "
        f"{esc(offer_id)}, now() - interval '{days_ago} days');"
    )
    oi_id = uid(f"orderitem:standalone:{idx+1}")
    sql(
        f"INSERT INTO order_items (id, order_id, listing_id, farmer_id, quantity_kg, price_per_kg, "
        f"subtotal, distance_km) VALUES ({esc(oi_id)}, {esc(order_id)}, {esc(lid)}, "
        f"{esc(m['farmer_id'])}, {num(qty)}, {num(price)}, {num(total_amount)}, {dist});"
    )
    standalone_orders.append({
        "order_id": order_id, "order_code": order_code, "status": status, "buyer_id": buyer_id,
        "crop": m["crop"], "farmer_id": m["farmer_id"], "qty": qty, "price": price,
        "total": total_amount, "days_ago": days_ago, "dest_region": dest_region,
        "farmer_name": m["name"],
    })
sql("")

# ── payments + payment_allocations (for orders at payment_held or beyond) ─
PAID_STATUSES = {"payment_held", "batch_formed", "pickup_scheduled", "in_transit", "delivered", "payment_released", "completed"}
RELEASED_STATUSES = {"payment_released", "completed"}

sql("-- payments + payment_allocations")
all_batch_records = []
for (order_id, order_code, contributions, total_amount, weighted_price, crop, buyer_id, dest_region), plan in zip(batch_orders, BATCH_PLAN):
    _, _, _, _, _, status, days_ago = plan
    all_batch_records.append((order_id, order_code, contributions, total_amount, status, days_ago, buyer_id, crop, dest_region))

for order_id, order_code, contributions, total_amount, status, days_ago, buyer_id, crop, dest_region in all_batch_records:
    if status not in PAID_STATUSES and status not in RELEASED_STATUSES:
        continue
    pay_id = uid(f"payment:{order_code}")
    released = status in RELEASED_STATUSES
    held_interval = f"now() - interval '{days_ago} days'"
    released_interval = f"now() - interval '{max(days_ago-4,0)} days'" if released else "NULL"
    pay_status = "released" if released else "held"
    sql(
        f"INSERT INTO payments (id, order_id, amount, status, provider, held_at, released_at, "
        f"created_at) VALUES ({esc(pay_id)}, {esc(order_id)}, {num(total_amount)}, {esc(pay_status)}, "
        f"'demo_escrow', {held_interval}, {released_interval if released else 'NULL'}, {held_interval});"
    )
    for j, c in enumerate(contributions, start=1):
        alloc_id = uid(f"alloc:{order_code}:{j}")
        amount = round(c["take"] * c["price"], 2)
        sql(
            f"INSERT INTO payment_allocations (id, payment_id, farmer_id, quantity_kg, amount) "
            f"VALUES ({esc(alloc_id)}, {esc(pay_id)}, {esc(c['farmer_id'])}, {num(c['take'])}, {num(amount)});"
        )

for o in standalone_orders:
    if o["status"] not in PAID_STATUSES and o["status"] not in RELEASED_STATUSES:
        continue
    pay_id = uid(f"payment:{o['order_code']}")
    released = o["status"] in RELEASED_STATUSES
    held_interval = f"now() - interval '{o['days_ago']} days'"
    released_interval = f"now() - interval '{max(o['days_ago']-3,0)} days'"
    pay_status = "released" if released else "held"
    sql(
        f"INSERT INTO payments (id, order_id, amount, status, provider, held_at, released_at, "
        f"created_at) VALUES ({esc(pay_id)}, {esc(o['order_id'])}, {num(o['total'])}, {esc(pay_status)}, "
        f"'demo_escrow', {held_interval}, {released_interval if released else 'NULL'}, {held_interval});"
    )
    alloc_id = uid(f"alloc:{o['order_code']}:1")
    sql(
        f"INSERT INTO payment_allocations (id, payment_id, farmer_id, quantity_kg, amount) "
        f"VALUES ({esc(alloc_id)}, {esc(pay_id)}, {esc(o['farmer_id'])}, {num(o['qty'])}, {num(o['total'])});"
    )
sql("")

# ── pickup_slots + logistics (for orders at pickup_scheduled or beyond) ──
PICKUP_STATUSES = {"pickup_scheduled", "in_transit", "delivered", "payment_released", "completed"}
VEHICLES = ["MH15AB4321", "MH12CD7788", "MH10EF2233", "MH14GH5567", "MH16IJ9012"]
DRIVERS = ["Santosh Wagh", "Balu Kadam", "Nitin Sable", "Vijay Rathod", "Ashok Bhoir"]

sql("-- pickup_slots + logistics")
pk_counter = 0
for order_id, order_code, contributions, total_amount, status, days_ago, buyer_id, crop, dest_region in all_batch_records:
    if status not in PICKUP_STATUSES:
        continue
    pk_counter += 1
    pickup_id = uid(f"pickup:{order_code}")
    location = f"{contributions[0]['village']} Collection Point"
    scheduled_date = (TODAY - timedelta(days=max(days_ago - 2, 0))).isoformat()
    pk_status = "completed" if status in {"delivered", "payment_released", "completed"} else "scheduled"
    sql(
        f"INSERT INTO pickup_slots (id, order_id, scheduled_date, scheduled_time, location, "
        f"vehicle_number, driver_name, status) VALUES ({esc(pickup_id)}, {esc(order_id)}, "
        f"{esc(scheduled_date)}, '07:30 AM', {esc(location)}, "
        f"{esc(VEHICLES[pk_counter % len(VEHICLES)])}, {esc(DRIVERS[pk_counter % len(DRIVERS)])}, "
        f"{esc(pk_status)});"
    )
    events = [("pickup_scheduled", "Pickup slot confirmed")]
    if status in {"in_transit", "delivered", "payment_released", "completed"}:
        events.append(("in_transit", "Vehicle departed collection point"))
    if status in {"delivered", "payment_released", "completed"}:
        events.append(("delivered", "Buyer confirmed receipt of full quantity"))
    if status in {"payment_released", "completed"}:
        events.append(("payment_released", "Escrow released to contributing farmers"))
    for k, (ev, note) in enumerate(events):
        sql(
            f"INSERT INTO logistics (id, order_id, pickup_id, event, notes, occurred_at) VALUES "
            f"({esc(uid(f'log:{order_code}:{k}'))}, {esc(order_id)}, {esc(pickup_id)}, {esc(ev)}, "
            f"{esc(note)}, now() - interval '{max(days_ago - k, 0)} days');"
        )

for o in standalone_orders:
    if o["status"] not in PICKUP_STATUSES:
        continue
    pk_counter += 1
    pickup_id = uid(f"pickup:{o['order_code']}")
    scheduled_date = (TODAY - timedelta(days=max(o["days_ago"] - 2, 0))).isoformat()
    pk_status = "completed" if o["status"] in {"delivered", "payment_released", "completed"} else "scheduled"
    sql(
        f"INSERT INTO pickup_slots (id, order_id, scheduled_date, scheduled_time, location, "
        f"vehicle_number, driver_name, status) VALUES ({esc(pickup_id)}, {esc(o['order_id'])}, "
        f"{esc(scheduled_date)}, '08:00 AM', {esc(o['farmer_name'] + ' Farm Gate')}, "
        f"{esc(VEHICLES[pk_counter % len(VEHICLES)])}, {esc(DRIVERS[pk_counter % len(DRIVERS)])}, "
        f"{esc(pk_status)});"
    )
    events = [("pickup_scheduled", "Pickup slot confirmed")]
    if o["status"] in {"in_transit", "delivered", "payment_released", "completed"}:
        events.append(("in_transit", "Vehicle departed farm gate"))
    if o["status"] in {"delivered", "payment_released", "completed"}:
        events.append(("delivered", "Buyer confirmed receipt"))
    if o["status"] in {"payment_released", "completed"}:
        events.append(("payment_released", "Escrow released to farmer"))
    for k, (ev, note) in enumerate(events):
        log_id = uid(f"log:{o['order_code']}:{k}")
        sql(
            f"INSERT INTO logistics (id, order_id, pickup_id, event, notes, occurred_at) VALUES "
            f"({esc(log_id)}, {esc(o['order_id'])}, {esc(pickup_id)}, "
            f"{esc(ev)}, {esc(note)}, now() - interval '{max(o['days_ago'] - k, 0)} days');"
        )
sql("")

print("Standalone orders, payments, pickups, logistics done.")

# ── ratings (two-way, for delivered/paid/completed orders) ───────────────
RATED_STATUSES = {"delivered", "payment_released", "completed"}
rating_rows = []  # for notification/sms cross-reference

sql("-- ratings")


def add_rating_pair(order_id, buyer_id, farmer_id, rating_seed):
    r = random.Random(rating_seed)
    quality = r.randint(4, 5)
    reliability = r.randint(4, 5)
    communication = r.randint(3, 5)
    timeliness = r.randint(4, 5)
    overall_b2f = round((quality + reliability + communication + timeliness) / 4, 2)
    b2f_id = uid(f"rating:{order_id}:{farmer_id}:b2f")
    sql(
        f"INSERT INTO ratings (id, order_id, from_user_id, to_user_id, quality, reliability, "
        f"communication, timeliness, overall, comment) VALUES ({esc(b2f_id)}, {esc(order_id)}, "
        f"{esc(buyer_id)}, {esc(farmer_id)}, {quality}, {reliability}, {communication}, {timeliness}, "
        f"{overall_b2f}, 'Good quality produce, delivered as agreed.');"
    )
    quality2 = r.randint(4, 5)
    reliability2 = r.randint(4, 5)
    communication2 = r.randint(4, 5)
    timeliness2 = r.randint(4, 5)
    overall_f2b = round((quality2 + reliability2 + communication2 + timeliness2) / 4, 2)
    f2b_id = uid(f"rating:{order_id}:{farmer_id}:f2b")
    sql(
        f"INSERT INTO ratings (id, order_id, from_user_id, to_user_id, quality, reliability, "
        f"communication, timeliness, overall, comment) VALUES ({esc(f2b_id)}, {esc(order_id)}, "
        f"{esc(farmer_id)}, {esc(buyer_id)}, {quality2}, {reliability2}, {communication2}, "
        f"{timeliness2}, {overall_f2b}, 'Payment released promptly, smooth pickup coordination.');"
    )


rating_count = 0
for order_id, order_code, contributions, total_amount, status, days_ago, buyer_id, crop, dest_region in all_batch_records:
    if status not in RATED_STATUSES:
        continue
    for j, c in enumerate(contributions):
        add_rating_pair(order_id, buyer_id, c["farmer_id"], f"{order_code}:{j}")
        rating_count += 2

for o in standalone_orders:
    if o["status"] not in RATED_STATUSES:
        continue
    add_rating_pair(o["order_id"], o["buyer_id"], o["farmer_id"], o["order_code"])
    rating_count += 2

sql("")
print(f"Generated {rating_count} ratings.")

# ── notifications ─────────────────────────────────────────────────────────
sql("-- notifications")
notif_count = 0


def add_notification(user_id, ntype, title, body, days_ago=0):
    global notif_count
    nid = uid(f"notif:{notif_count}:{user_id}:{ntype}")
    sql(
        f"INSERT INTO notifications (id, user_id, type, title, body, read, created_at) VALUES "
        f"({esc(nid)}, {esc(user_id)}, {esc(ntype)}, {esc(title)}, {esc(body)}, "
        f"{'TRUE' if days_ago > 3 else 'FALSE'}, now() - interval '{days_ago} days');"
    )
    notif_count += 1


for order_id, order_code, contributions, total_amount, status, days_ago, buyer_id, crop, dest_region in all_batch_records:
    add_notification(buyer_id, "batch_created",
                      f"Smart batch formed for {order_code}",
                      f"{len(contributions)} farmers were aggregated to fulfil your {crop} order.",
                      days_ago)
    for c in contributions:
        add_notification(c["farmer_id"], "listing_joined_batch",
                          "Your listing joined a smart batch",
                          f"{num(c['take'])} kg of your {crop} was included in batch {order_code}.",
                          days_ago)
    if status in PICKUP_STATUSES:
        for c in contributions[:1]:
            add_notification(c["farmer_id"], "pickup_scheduled", "Pickup scheduled",
                              f"Pickup for {order_code} has been scheduled.", max(days_ago - 1, 0))
    if status in RATED_STATUSES:
        add_notification(buyer_id, "delivery_confirmed", "Delivery confirmed",
                          f"Your {crop} order {order_code} has been delivered.", max(days_ago - 2, 0))
    if status in RELEASED_STATUSES:
        for c in contributions:
            add_notification(c["farmer_id"], "payment_released", "Payment released",
                              f"₹{num(round(c['take']*c['price'],2))} released for {order_code}.",
                              max(days_ago - 3, 0))

for o in standalone_orders:
    add_notification(o["farmer_id"], "offer_accepted", "Offer accepted",
                      f"Your offer for order {o['order_code']} was accepted at ₹{num(o['price'])}/kg.",
                      o["days_ago"])
    if o["status"] in RATED_STATUSES:
        add_notification(o["buyer_id"], "delivery_confirmed", "Delivery confirmed",
                          f"Your {o['crop']} order {o['order_code']} has been delivered.",
                          max(o["days_ago"] - 2, 0))

# a few demand-forecast-changed notifications for farmers, tied to the rising-demand crops
for i, fid in enumerate(farmer_ids[:4]):
    add_notification(fid, "demand_forecast_changed", "Demand forecast updated",
                      "Tomato demand in your region is trending up over the next 7 days.", i)

sql("")
print(f"Generated {notif_count} notifications.")

# ── sms_logs (mock provider, mirrors key lifecycle events) ────────────────
USER_PHONE = {}  # populate below by re-deriving from the same formulas used above
for i, (name, region, village) in enumerate(FARMERS, start=1):
    USER_PHONE[farmer_ids[i - 1]] = (f"9822{100000 + i:06d}"[:13], name)
for i, (name, btype, region) in enumerate(BUYERS, start=1):
    USER_PHONE[buyer_ids[i - 1]] = (f"9833{200000 + i:06d}"[:13], name)

sql("-- sms_logs")
sms_count = 0


def add_sms(user_id, event, message, days_ago=0, status="sent"):
    global sms_count
    phone, name = USER_PHONE.get(user_id, ("9800000000", "Unknown"))
    sid = uid(f"sms:{sms_count}:{user_id}:{event}")
    sql(
        f"INSERT INTO sms_logs (id, recipient_phone, recipient_name, recipient_user_id, message, "
        f"event, status, provider, created_at) VALUES ({esc(sid)}, {esc(phone)}, {esc(name)}, "
        f"{esc(user_id)}, {esc(message)}, {esc(event)}, {esc(status)}, 'mock', "
        f"now() - interval '{days_ago} days');"
    )
    sms_count += 1


for order_id, order_code, contributions, total_amount, status, days_ago, buyer_id, crop, dest_region in all_batch_records:
    for c in contributions[:2]:
        add_sms(c["farmer_id"], "batch_created",
                f"KisanSetu: Your {num(c['take'])} kg {crop} supply has been included in Batch "
                f"{order_code}.", days_ago)
    if status in PICKUP_STATUSES:
        for c in contributions[:2]:
            add_sms(c["farmer_id"], "pickup_scheduled",
                    f"KisanSetu: Pickup for Batch {order_code} scheduled. Please keep produce ready.",
                    max(days_ago - 1, 0))
    if status in RELEASED_STATUSES:
        for c in contributions:
            add_sms(c["farmer_id"], "payment_released",
                    f"KisanSetu: Rs.{num(round(c['take']*c['price'],2))} has been released for your "
                    f"completed KisanSetu order {order_code}.", max(days_ago - 3, 0))

for o in standalone_orders[:4]:
    add_sms(o["farmer_id"], "offer_accepted",
            f"KisanSetu: Your offer for {o['order_code']} was accepted at Rs.{num(o['price'])}/kg.",
            o["days_ago"])
    if o["status"] in RELEASED_STATUSES:
        add_sms(o["farmer_id"], "payment_released",
                f"KisanSetu: Rs.{num(o['total'])} has been released for your completed KisanSetu "
                f"order {o['order_code']}.", max(o["days_ago"] - 3, 0))

# pad to comfortably exceed the 20-message minimum with listing-created confirmations
for i, lid in enumerate(listing_ids[:6]):
    m = listing_meta[lid]
    add_sms(m["farmer_id"], "listing_created",
            f"KisanSetu: Your listing of {num(m['qty'])} kg {m['crop']} at Rs.{num(m['price'])}/kg is now live.",
            10 + i, status="delivered" if i % 4 else "sent")

sql("")
print(f"Generated {sms_count} SMS log entries.")

# ── audit_logs ──────────────────────────────────────────────────────────
sql("-- audit_logs")
audit_count = 0


def add_audit(actor_id, action, entity_type, entity_id, days_ago=0, metadata="{}"):
    global audit_count
    aid = uid(f"audit:{audit_count}:{entity_id}:{action}")
    sql(
        f"INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, "
        f"created_at) VALUES ({esc(aid)}, {esc(actor_id) if actor_id else 'NULL'}, {esc(action)}, "
        f"{esc(entity_type)}, {esc(entity_id)}, {esc(metadata)}::jsonb, now() - interval '{days_ago} days');"
    )
    audit_count += 1


for order_id, order_code, contributions, total_amount, status, days_ago, buyer_id, crop, dest_region in all_batch_records:
    add_audit(buyer_id, "batch_created", "aggregation_batch", order_id, days_ago)
    add_audit(buyer_id, "order_confirmed", "order", order_id, days_ago)
    if status in PAID_STATUSES or status in RELEASED_STATUSES:
        add_audit(buyer_id, "payment_held", "order", order_id, days_ago)
    if status in RELEASED_STATUSES:
        add_audit(None, "payment_released", "order", order_id, max(days_ago - 3, 0))
    if status in RATED_STATUSES:
        add_audit(buyer_id, "delivery_confirmed", "order", order_id, max(days_ago - 2, 0))

for o in standalone_orders:
    add_audit(o["buyer_id"], "offer_accepted", "offer", o["order_id"], o["days_ago"])
    add_audit(o["buyer_id"], "order_confirmed", "order", o["order_id"], o["days_ago"])
    if o["status"] in RELEASED_STATUSES:
        add_audit(None, "payment_released", "order", o["order_id"], max(o["days_ago"] - 3, 0))

for uid_ in farmer_ids + buyer_ids:
    add_audit(uid_, "user_registered", "user", uid_, random.randint(15, 90))

sql("")
print(f"Generated {audit_count} audit log entries.")

sql("COMMIT;")

with open(SEED_SQL_PATH, "w") as f:
    f.write("\n".join(lines) + "\n")

print(f"\nWrote {SEED_SQL_PATH} ({len(lines)} lines).")
print(f"Wrote CSVs to {ML_DATA_DIR}")
print(f"listings={len(listing_ids)} offers={len(offer_ids)} batches={len(BATCH_PLAN)} "
      f"standalone_orders={len(standalone_orders)} ratings={rating_count} "
      f"notifications={notif_count} sms={sms_count} audit={audit_count}")
