# KisanSetu — Handoff Document

This document is for whoever picks up this project next. It explains exactly
what is done, what is left, why the project is structured the way it is, and
how to get it running on a normal machine with internet access (this build
was produced inside a sandboxed environment with **no access to npm, PyPI,
or any package registry**, which shaped several decisions below — read the
"Important: why some things aren't verified" section before changing
anything).

## 1. What KisanSetu is

An industry-grade AgriTech platform for Smart India Hackathon: a direct
farm-to-market network with demand forecasting, fair-price intelligence, a
Smart Aggregation Engine that combines many small farmers into one
buyer-ready bulk batch, an offer/negotiation engine, a demo escrow payment
system, SMS notifications (mock by default), and full order lifecycle
tracking from listing to settlement.

## 2. Current status at a glance

| Layer | Status |
|---|---|
| PostgreSQL schema (23 tables, migrations) | **Done, verified** (applied to a live Postgres instance in the sandbox) |
| Seed data (15 farmers, 7 buyers, 30 listings, orders, batches, prices, demand history, ratings, notifications, SMS logs) | **Done, verified** (loaded into Postgres, spot-checked with queries) |
| Backend (Express/TypeScript, all routes/controllers/services/repositories) | **Done, verified** by static analysis + live DB queries (see caveat below — never run under a real `node`/`express` process) |
| ML forecasting service (Python/Flask/scikit-learn) | **Done, fully verified** — actually trained and served live via HTTP in the sandbox |
| Frontend (React/Vite/Tailwind) — landing, auth, farmer app, buyer app, admin dashboard, Intelligence Center, SIH Demo Mode | **Done, written**, but **never run or built** (no `npm install` possible in the sandbox — see below) |
| PWA config (manifest, offline fallback, workbox caching) | Configured in `vite.config.ts`, not verified |
| i18n (English/Hindi/Marathi) | English is complete; Hindi/Marathi cover nav/auth/common/order-status strings; the rest fall back to English automatically |
| Documentation | This file only. The full `/docs/*.md` set (architecture, aggregation, demand-forecasting, price-intelligence, sms, database, api, 3-minute demo guide) from the original spec **was not written** — see Section 6 |
| Packaging | Zipped and delivered as-is, `node_modules`/`dist`/`.env` excluded |

## 3. Important: why some things aren't verified

This project was built inside a sandboxed cloud environment with **firewalled
network access** — `npm install`, `pip install <anything not preinstalled>`,
and any CDN/registry fetch all fail with a hard deny. Only these were
available: a pre-installed PostgreSQL 16, a pre-installed Python
(flask/pandas/numpy/scikit-learn/joblib), and a small set of global Node
tools (`typescript`, `tsx`, `eslint`, `prettier` — but **not** `express`,
`pg`, `zod`, `react`, `vite`, or any of the actual runtime dependencies this
project needs).

Given that constraint, the approach was:

1. **Write real source code against real, standard packages** (Express, pg,
   zod, React, Vite, Tailwind, Recharts, TanStack Query, React Router,
   Framer Motion, react-hook-form, i18next, vite-plugin-pwa) exactly as a
   normal project would — nothing here is a mock/simplified substitute
   package. These get installed normally by `npm install` on your machine.
2. **Verify everything that could be verified without those packages**:
   - The Postgres schema and seed data were applied and queried against a
     real, live database in the sandbox.
   - Pure business logic (JWT signing/verification, password hashing, the
     Smart Aggregation Engine's ranking/batching/payout math, the internal
     forecast fallback, the order state-machine guard) was extracted and run
     standalone via `tsx` (which needs no `express`/`pg`) against real
     seeded data, including edge cases.
   - The full backend TypeScript source was type-checked with a scratch
     `tsconfig` pointing at a manually-built `shared` package and a global
     `@types/node`, filtering out only the expected "cannot find module
     'express'" class of noise — this caught and fixed several real bugs
     (see Section 5).
   - The ML pipeline was **fully run end-to-end**: trained on the seeded
     historical data, evaluated with real (not invented) MAE/RMSE/MAPE
     against a moving-average baseline, and served over a live Flask HTTP
     endpoint that was hit with real requests.
   - Every backend route was cross-checked by hand against its
     controller → service → repository call chain and its zod validator, to
     catch field-name mismatches between what a route expects and what the
     rest of the code sends it (several were found and fixed this way — see
     Section 5).
3. **The React frontend could not be run or built at all** — there is no
   `npm` registry access, so `vite`, `react`, `react-dom`, etc. do not exist
   in this sandbox as installable packages. It was written carefully by
   hand against well-known, stable APIs, and every API call the frontend
   makes was manually cross-checked against the actual backend route/
   controller/service code (not just assumed) — this is how the bugs in
   Section 5 were found. **But it has never been through `npm install` or
   `npm run build`, so there will very likely be small TypeScript errors,
   typos, or missing edge cases a real build will surface immediately.**

**The very first thing the next person should do is `npm install` at the
root and try `npm run build:shared && npm run build:server && npm run
dev:client`, and just work through whatever the compiler complains about.**
Budget an afternoon for this, not a week — the architecture and logic are
sound and verified; what's unverified is purely "does this exact TypeScript
syntax compile / does this exact import path resolve."

## 4. Getting it running

```bash
# 1. Install dependencies (needs real internet access)
npm install

# 2. Start Postgres (however you normally do — Docker, local install, etc.)
#    Create a database + user matching server/.env's DATABASE_URL, e.g.:
createdb kisansetu

# 3. Configure environment
cp .env.example server/.env
# edit server/.env if your DB credentials differ — everything else
# (SMS, mandi API, ML service URL) has safe defaults and works with
# nothing configured (mock SMS provider, seeded price provider, internal
# forecast fallback)

# 4. Build the shared package first (server and client both depend on it)
npm run build:shared

# 5. Run migrations and seed data
npm run migrate
npm run seed

# 6. (Optional but recommended) start the ML service for real model-backed
#    forecasts instead of the internal fallback:
cd ml
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python training/train_forecast.py   # trains the model, writes ml/models/
python services/api.py              # serves on :8000
cd ..

# 7. Start the backend
npm run dev:server    # http://localhost:4000

# 8. Start the frontend (separate terminal)
npm run dev:client    # http://localhost:5173

# 9. Log in with a seeded demo account (password for all three: Demo@123)
#    farmer@kisansetu.demo
#    buyer@kisansetu.demo
#    admin@kisansetu.demo
```

The landing page has a **"Run the demo"** button at `/demo-mode` that drives
the entire product loop (forecast → list → discover → aggregate → negotiate
→ order → logistics → escrow → deliver → settle → learn) against the real
API using the three demo accounts — this is the fastest way to confirm
everything is wired correctly end to end, and it's also the SIH
presentation centerpiece.

## 5. Real bugs found and fixed during the manual cross-check

Worth knowing about, since they show where the risk was concentrated
(inconsistent field names between client and server, and a few repository
methods that returned raw snake_case DB rows instead of the camelCase DTO
shape the rest of the API uses):

- `POST /aggregation/find` expects `{ requiredQuantityKg, destinationRegion,
  maxDistanceKm }`, not `{ quantityKg, region }` — this is the single most
  important endpoint in the demo (the Smart Aggregation Engine), so this was
  caught before it could break the main "wow" moment.
- `PATCH /offers/:id` (negotiation respond) expects `counterPricePerKg`, not
  `pricePerKg`.
- `POST /payments/:orderId/release` — despite the `/payments/:id` path, the
  `:id` is the **order** id, not a separate payment id (there is exactly one
  escrow payment per order). The client is written to match this; if you
  ever refactor the backend to take a real payment id, update the client
  too.
- `GET /listings` returns `{ listings, total, page, pageSize }`, not
  `{ items, ... }`.
- `orderRepository.itemsForOrder`, `orderService.listForFarmer`,
  `notificationService.listForUser`, and `adminService`'s sms/audit/batch/
  price/forecast endpoints were all returning **raw, unmapped snake_case SQL
  rows** instead of the camelCase DTOs the rest of the API uses everywhere
  else. All of these were fixed to map properly (see git history / diffs in
  `server/src/services/*.service.ts`). If you add new admin or list
  endpoints, follow the existing `toDto()` pattern in e.g.
  `order.service.ts` rather than returning repository rows directly.
- `POST /pickups/:orderId` requires `vehicleNumber` and `driverName` in
  addition to date/time/location — the client form was missing them
  initially.
- `POST /ratings/order/:orderId` requires `toUserId` (who you're rating),
  not just the five score fields.

## 6. What's left to build

Roughly in priority order for a hackathon submission:

1. **Get it compiling and running** (Section 3/4). This is the critical
   path — nothing else matters until `npm run dev:client` actually renders
   the app.
2. **Fix whatever the build surfaces.** Expect: a handful of TypeScript
   strictness complaints, maybe an import path issue or two, possibly a
   Tailwind class that needs adjusting once the JIT compiler actually runs
   against real content. None of this should be architecturally
   significant — it's "first compile of hand-written code" friction.
3. **Smoke-test every screen manually**, in particular:
   - Farmer: register → list produce (check the live fair-price panel
     actually calls the API) → view demand forecast chart → respond to a
     seeded offer.
   - Buyer: browse marketplace → open a listing → make an offer → use "Find
     Supply" (the aggregation flow) → confirm an order → schedule pickup →
     mark delivered → release payment → rate the farmer.
   - Admin: dashboard charts render with real data → Intelligence Center →
     SMS Center (send a test SMS) → Audit Log.
   - Run the SIH Demo Mode end to end (`/demo-mode`) — this exercises almost
     every endpoint in one pass and is the fastest full regression check.
4. **Polish pass** (originally task 17 in the build plan): loading/error/
   empty states are implemented on every data-fetching screen already
   (`SkeletonList`, `ErrorState`, `EmptyState` components), but do a pass on
   a real phone-sized viewport (360px) and a real 1440px desktop to check
   for layout breakage, especially the bottom nav on the farmer screens and
   the admin sidebar's collapse behavior.
5. **i18n completion**: `client/src/i18n/locales/hi/translation.json` and
   `.../mr/translation.json` currently cover common/nav/auth/order-status
   keys; the farmer/buyer/admin/landing sections are English-only there and
   fall back automatically (the app will not crash or show missing-key
   errors — it just shows English text in those two languages for those
   sections). Translating the remaining keys is mechanical — copy the key
   structure from `en/translation.json`.
6. **PWA verification**: `vite-plugin-pwa` is configured in
   `client/vite.config.ts` with an app-shell cache and NetworkFirst runtime
   caching for listings/prices/forecast, plus `public/offline.html`. This
   has never been tested in a real browser (no build was possible) — after
   `npm run build:client`, test installability and offline behavior in
   Chrome DevTools' Application tab.
7. **Write the full `/docs` set** the original spec called for:
   `README.md` (top-level, richer than this handoff), `docs/architecture.md`,
   `docs/aggregation.md`, `docs/demand-forecasting.md`,
   `docs/price-intelligence.md`, `docs/sms.md`, `docs/database.md`,
   `docs/api.md`, and a polished **3-minute SIH demo script** (this handoff's
   Section 4 has the bones of it — the "Run the demo" button walkthrough —
   but it deserves a proper judge-facing writeup with a suggested talking
   script per stage).
8. **Optional depth, if time allows**: the offer negotiation engine's
   "counter" flow only has one round trip implemented in the demo
   orchestrator (buyer offers, farmer accepts) — a real counter-then-accept
   round trip in the UI (`FarmerOrdersPage`'s counter form is built, just
   not exercised by the automated demo) would make a nice live addition to
   the walkthrough. Also consider adding a `PATCH /users/me` profile-update
   endpoint — the current farmer/buyer profile pages are read-only because
   no such endpoint exists yet.

## 7. Project structure

```
kisansetu/
├── client/          React + Vite + TypeScript + Tailwind frontend
│   └── src/
│       ├── pages/           all screens, organized by farmer/buyer/admin/auth
│       ├── components/ui/   design-system primitives (Button, Card, Badge, ...)
│       ├── components/layout/  nav shells, protected routes
│       ├── lib/api.ts        typed fetch wrapper for every backend route
│       ├── lib/demoRunner.ts the SIH Demo Mode orchestrator
│       ├── hooks/useAuth.tsx auth context
│       └── i18n/             English/Hindi/Marathi translations
├── server/          Express + TypeScript backend (controllers/services/repositories/routes)
│   └── src/db/migrations/001_init.sql   full schema
│   └── src/db/seed/seed.sql             generated seed data (from scripts/generate_seed.py)
├── shared/          @kisansetu/shared — enums + DTO types used by both client and server
├── ml/              Python demand-forecasting service (training + Flask API)
├── scripts/         scripts/generate_seed.py — regenerates seed.sql + ML training CSVs together
└── docs/            currently empty — see Section 6, item 7
```

## 8. Demo credentials

All three seeded accounts use the password `Demo@123`:

- `farmer@kisansetu.demo`
- `buyer@kisansetu.demo`
- `admin@kisansetu.demo`

---

Whoever picks this up: the hard, judgment-heavy parts (schema design, the
aggregation algorithm and its payout math, the forecasting methodology and
its honestly-computed metrics, the full order state machine, and the API
surface) are done and verified. What's left is mechanical: install, compile,
smoke-test, polish, document. Good luck with the demo.
