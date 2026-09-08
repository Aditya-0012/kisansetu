# KisanSetu REST API Specification

> **Complete Endpoint Documentation**  
> *Base URL: `http://localhost:4000/api`*

---

## 1. Authentication & Security Headers

Protected endpoints require a valid JSON Web Token passed in the standard `Authorization` header:

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## 2. API Endpoints Reference

### 2.1. Authentication (`/api/auth`)

#### `POST /api/auth/register`
Creates a new farmer, buyer, or admin account.
- **Request Body**:
  ```json
  {
    "name": "Ramesh Patil",
    "email": "ramesh@example.com",
    "phone": "9876543210",
    "password": "Password@123",
    "role": "farmer",
    "region": "Nashik",
    "village": "Niphad",
    "languagePreference": "mr"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "user": { "id": "uuid", "name": "Ramesh Patil", "role": "farmer", "region": "Nashik" },
    "token": "jwt_token_string"
  }
  ```

#### `POST /api/auth/login`
Authenticates an existing user.
- **Request Body**:
  ```json
  {
    "email": "farmer@kisansetu.demo",
    "password": "Demo@123"
  }
  ```
- **Response `200 OK`**: Returns user profile and JWT bearer token.

#### `GET /api/auth/me`
Retrieves the currently authenticated session profile.
- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**: Current user entity.

#### `PATCH /api/auth/me`
Updates profile metadata (name, phone, region, village, language preference, low-connectivity mode).
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "name": "Rajesh Patil",
    "village": "Niphad Village",
    "languagePreference": "mr",
    "lowConnectivityMode": false
  }
  ```
- **Response `200 OK`**: Updated user entity.


---

### 2.2. Produce Listings (`/api/listings`)

#### `GET /api/listings`
Search and filter active marketplace harvest lots.
- **Query Parameters**:
  - `crop`: Filter by crop code (`tomato`, `onion`, etc.)
  - `region`: Filter by region (`Nashik`, `Pune`, etc.)
  - `minPrice`, `maxPrice`: Numeric price range
  - `status`: `active`, `reserved`, `sold` (default: `active`)
  - `page`: Page index (default: `1`)
  - `pageSize`: Page size (default: `12`)
- **Response `200 OK`**:
  ```json
  {
    "listings": [
      {
        "id": "uuid",
        "cropCode": "tomato",
        "quantityKg": 1200,
        "remainingQuantityKg": 1200,
        "expectedPricePerKg": 22.0,
        "harvestDate": "2026-09-15",
        "quality": "A",
        "region": "Nashik",
        "status": "active"
      }
    ],
    "total": 30,
    "page": 1,
    "pageSize": 12
  }
  ```

#### `POST /api/listings`
Publishes a new harvest listing (Farmer only).
- **Request Body**:
  ```json
  {
    "cropCode": "tomato",
    "variety": "Vaishali",
    "quantityKg": 1500,
    "expectedPricePerKg": 21.50,
    "harvestDate": "2026-09-20",
    "quality": "A",
    "region": "Nashik",
    "village": "Niphad",
    "description": "Naturally ripened table tomatoes"
  }
  ```
- **Response `201 Created`**: Created listing object.

#### `GET /api/listings/mine`
Lists all lots created by the authenticated farmer.

---

### 2.3. Price Intelligence (`/api/prices`)

#### `GET /api/prices/current`
Returns the latest spot mandi price snapshot.
- **Query Parameters**: `crop=tomato&region=Nashik`
- **Response `200 OK`**:
  ```json
  {
    "crop": "tomato",
    "region": "Nashik",
    "mandiName": "Nashik APMC",
    "pricePerKg": 21.0,
    "previousPricePerKg": 19.5,
    "changePercent": 7.69,
    "source": "seeded",
    "updatedAt": "2026-09-08T00:00:00.000Z"
  }
  ```

#### `GET /api/prices/fair-suggestion`
Computes the dynamic fair-price corridor for a harvest lot.
- **Query Parameters**: `crop=tomato&region=Nashik&qualityGrade=A`
- **Response `200 OK`**:
  ```json
  {
    "demandLevel": "high",
    "suggestedMinPerKg": 20.64,
    "suggestedMaxPerKg": 22.79,
    "recommendation": "Demand is currently strong. Market conditions support a competitive price near ₹23/kg."
  }
  ```

---

### 2.4. Demand Forecasting (`/api/forecast`)

#### `GET /api/forecast`
Fetches predictive demand and supply gap intelligence.
- **Query Parameters**: `crop=tomato&region=Nashik&horizon=14`
- **Response `200 OK`**:
  ```json
  {
    "crop": "tomato",
    "region": "Nashik",
    "horizonDays": 14,
    "expectedDemandKg": 2840.5,
    "currentSupplyKg": 1500.0,
    "supplyGapKg": 1340.5,
    "growthPercent": 14.2,
    "confidence": 0.88,
    "trend": "rising",
    "recommendation": "Demand for tomato is expected to rise 14%. Current listed supply is approximately 1341 kg below expected demand...",
    "methodology": "ml_service",
    "modelName": "RandomForestRegressor",
    "series": [...]
  }
  ```

---

### 2.5. Smart Aggregation Engine (`/api/aggregation`)

#### `POST /api/aggregation/find`
Executes multi-objective ranking and greedy batch allocation across smallholders.
- **Request Body**:
  ```json
  {
    "cropCode": "tomato",
    "requiredQuantityKg": 3000,
    "destinationRegion": "Pune",
    "maxDistanceKm": 250
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "requestedQuantityKg": 3000,
    "fulfilledQuantityKg": 3000,
    "supplyGapKg": 0,
    "weightedPricePerKg": 21.27,
    "averageDistanceKm": 101.6,
    "estimatedTotal": 63800.00,
    "listingsAnalyzed": 14,
    "fullyFulfilled": true,
    "contributions": [
      {
        "listingId": "uuid-1",
        "farmerId": "uuid-farmer-1",
        "farmerName": "Ramesh Patil",
        "farmerRating": 4.8,
        "quantityKg": 1200,
        "pricePerKg": 21.50,
        "subtotal": 25800.00,
        "distanceKm": 72.4
      }
    ]
  }
  ```

#### `POST /api/aggregation/confirm`
Converts an assembled batch into an active multi-farmer order.
- **Headers**: `Authorization: Bearer <buyer_token>`
- **Request Body**: Pass the batch candidate payload returned by `/find`.
- **Response `201 Created`**: Returns created `batchCode` and `orderCode`.

---

### 2.6. Offers & Negotiations (`/api/offers`)

#### `POST /api/offers`
Buyer submits a direct price offer on a listing.
- **Request Body**: `{ "listingId": "uuid", "offeredPricePerKg": 20.0, "quantityKg": 500 }`

#### `PATCH /api/offers/:id`
Farmer accepts, rejects, or counters a buyer offer.
- **Request Body**: `{ "status": "countered", "counterPricePerKg": 21.0 }`

---

### 2.7. Orders & State Management (`/api/orders`)

#### `GET /api/orders`
Lists all active and completed orders for the authenticated user.

#### `GET /api/orders/:id`
Retrieves comprehensive order details including line items, logistics trail, and escrow state.

---

### 2.8. Demo Escrow Payments (`/api/payments`)

#### `POST /api/payments/:orderId/hold`
Locks buyer funds in milestone demo escrow upon order confirmation.

#### `POST /api/payments/:orderId/release`
Releases escrow funds, automatically calculating and crediting exact proportional payouts to contributing farmers upon verified delivery.

---

### 2.9. Logistics & Pickups (`/api/pickups`)

#### `POST /api/pickups/:orderId`
Schedules pickup vehicle dispatch for an order or aggregated batch.
- **Request Body**:
  ```json
  {
    "scheduledDate": "2026-09-12",
    "scheduledTime": "09:30 AM",
    "location": "Niphad Village Collection Point, Nashik",
    "vehicleNumber": "MH-15-EG-4412",
    "driverName": "Santosh Jadhav"
  }
  ```

---

### 2.10. Ratings & Two-Way Trust (`/api/ratings`)

#### `POST /api/ratings/order/:orderId`
Submits multi-factor counterparty review.
- **Request Body**:
  ```json
  {
    "toUserId": "uuid-farmer",
    "quality": 5,
    "reliability": 5,
    "communication": 4,
    "timeliness": 5,
    "comment": "Produce delivered in pristine condition. Highly recommended."
  }
  ```

---

### 2.11. Admin Intelligence & SMS Logs (`/api/admin`, `/api/sms`)

#### `GET /api/admin/metrics`
Returns aggregate platform GMV, user volume, and trade completion rates.

#### `GET /api/sms/logs`
Returns chronological SMS dispatch logs for platform auditability.
