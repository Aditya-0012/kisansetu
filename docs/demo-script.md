# KisanSetu: 3-Minute SIH Hackathon Presentation Script

> **The Hackathon Judge Walkthrough Guide**  
> *Demonstrating the Complete AgriTech Trade Lifecycle at `/demo-mode`*

---

## ⏱️ Pitch Timeline Overview

| Time | Stage in `/demo-mode` | Core Theme | Key Metric / Talking Point |
|---|---|---|---|
| **0:00 – 0:30** | Hook & Problem | The Smallholder Volume Barrier | $86\%$ marginal farmers; middlemen take $35\text{--}50\%$ margin |
| **0:30 – 1:00** | `FORECAST` → `INFORM` | Predictive Sowing & Pricing | $+30.3\%$ ML MAE improvement; dynamic fair-price corridor |
| **1:00 – 1:45** | `LIST` → `AGGREGATE` | **The Core "Wow" Innovation** | Multi-objective spatial clustering: 3 farmers $\rightarrow$ 1 commercial batch |
| **1:45 – 2:20** | `ORDER` → `ESCROW` | Trust, Logistics & Payments | Vehicle dispatch; milestone escrow locking buyer capital upfront |
| **2:20 – 2:45** | `DELIVER` → `SETTLE` | Zero-Drift Financial Payout | Auto-split payout exact to ₹0.01; two-way rating trust score |
| **2:45 – 3:00** | Closer & Inclusivity | Offline & Multilingual Edge | SMS fallback for 2G phones; Hindi & Marathi localization |

---

## 🎙️ Spoken Script & Screen Action

### 0:00 – 0:30: The Hook & The Problem
> **Presenter Action**: Open `http://localhost:5173/demo-mode`. Keep the screen visible to judges. Do not start the automated loop yet.

**Spoken Script**:
> *"Respected Judges, over 86% of farmers in India operate on less than 2 hectares of land. When a supermarket chain or food processor in Pune needs 3 tons of tomatoes, no single smallholder can fulfill that contract. Today, village middlemen step into that gap—buying from farmers at distress rates, pooling the produce, and pocketing 40% margins.*
>
> *We built **KisanSetu**—India's intelligent direct farm-to-market network. Instead of forcing smallholders to fight the market alone, KisanSetu algorithmically unites them. Let me show you our entire 12-stage product loop running live on our real backend and ML service."*

---

### 0:30 – 1:00: Demand Forecasting & Fair-Price Corridor
> **Presenter Action**: Click **"Run Full Demo"**. The stage progresses to `FORECAST` and `INFORM`.

**Spoken Script**:
> *"Notice Stage 1 and 2: Before a farmer even harvests, our Python Machine Learning microservice forecasts regional demand 14 days out. Using a Random Forest Regressor trained on 4,500 daily agricultural records with strict chronological validation, our model outperforms standard moving-average baselines by 30.3% error reduction.*
>
> *Next, our Fair-Price Engine blends today's spot mandi rates with regional averages and demand momentum, giving the farmer a dynamic fair-price corridor: ₹21 to ₹23 per kg. Farmers are never left guessing or vulnerable to predatory quotes."*

---

### 1:00 – 1:45: The "Wow" Moment — Smart Aggregation Engine
> **Presenter Action**: The demo automatically executes `LIST`, `DISCOVER`, and transitions to `AGGREGATE`. Point out the batch card that pops up with multiple farmers.

**Spoken Script**:
> *"Now here is the core algorithmic breakthrough: A buyer in Pune requests 3,000 kg of Grade-A tomatoes. Rather than turning away smallholders, KisanSetu's **Smart Aggregation Engine** instantly evaluates candidates across Maharashtra.*
>
> *Using a multi-objective optimization function balancing transit distance, unit price, stock volume, and farmer reputation, it clusters three separate farmers—Ramesh in Junnar with 1,200 kg, Suresh in Shirur with 1,000 kg, and Anil in Niphad with 800 kg. It computes an optimal volume-weighted price of ₹21.27/kg and creates a single commercial milk-run pickup route. What was impossible individually is now a single, bulk-ready consignment."*

---

### 1:45 – 2:20: Order State Machine, Logistics & Escrow
> **Presenter Action**: Watch stages `NEGOTIATE`, `ORDER`, `LOGISTICS`, and `ESCROW` trigger.

**Spoken Script**:
> *"Stage 6 through 9: The buyer confirms the order. Transport vehicle MH-15-EG-4412 is assigned with driver Santosh Jadhav. At the exact same moment, the buyer deposits ₹63,800 into KisanSetu's milestone escrow.*
>
> *The farmer has total financial security: their harvest will not leave the field until funds are verified in escrow. The buyer has total cargo security: funds are protected until verified delivery."*

---

### 2:20 – 2:45: Verified Delivery & Zero-Drift Payout
> **Presenter Action**: Watch stages `DELIVER`, `SETTLE`, and `LEARN` complete.

**Spoken Script**:
> *"Stages 10 and 11: The cargo reaches the buyer's warehouse and passes quality verification. The escrow unlocks instantly. Look at the settlement breakdown: each of the three contributing farmers receives their exact proportional payout—₹25,800, ₹22,000, and ₹16,000. Our engine enforces zero rounding drift down to the exact paisa.*
>
> *Finally, both parties submit multi-factor ratings, updating the platform's trust graphs for the next harvest cycle."*

---

### 2:45 – 3:00: The Closer — Rural Inclusivity
> **Presenter Action**: Briefly toggle the language switcher to **मराठी** or **हिंदी**, and point out the SMS logs in the admin dashboard.

**Spoken Script**:
> *"To ensure no farmer is left behind, KisanSetu runs on progressive web technology with offline caching, complete localization in Hindi and Marathi, and an automated SMS pipeline that alerts 2G feature phone users at every trade milestone.*
>
> *KisanSetu replaces exploitation with algorithmic efficiency, giving India's smallholder farmers the scale, price intelligence, and dignity they deserve. Thank you!"*

---

## 🛡️ Judge Defense & Technical FAQ

### Q1: "What if a farmer is in a remote field with zero internet?"
> **Answer**: *"KisanSetu has a dual low-connectivity architecture. First, our web client is a Progressive Web App (PWA) with Workbox offline app-shell caching. Second, and more importantly, our backend includes an automated SMS notification gateway. Even on a basic ₹1,000 feature phone with 2G GSM, the farmer receives real-time SMS alerts when offers arrive, trucks are dispatched, and escrow payments hit their bank account. In this demo build, our SMS engine includes a zero-dependency mock mode that records every single message directly into the PostgreSQL `sms_logs` table for full auditability."*

### Q2: "How do you know your ML model isn't just making numbers up?"
> **Answer**: *"Our ML pipeline in `ml/` is a real, standalone Python microservice running on port 8000. It trains a `RandomForestRegressor` with 200 estimators across 30 crop-region time series. Crucially, we enforce a strict 21-day chronological holdout—never a random train-test split, which would leak future information. When benchmarked against an industry-standard 7-day moving average baseline, our model achieves a Mean Absolute Error of 6.64 kg versus 9.52 kg for the baseline—a 30.3% error reduction. Furthermore, if the ML service ever goes offline, our Node.js backend features an automatic 2.5-second circuit breaker that falls back to linear-trend history without crashing."*

### Q3: "In the aggregation engine, how do you handle rounding discrepancies across multiple farmers?"
> **Answer**: *"Many platforms multiply total kilograms by the rounded average price, which causes rounding drift of a few rupees between what the buyer pays and what farmers receive. In `aggregation.algorithm.ts`, we derive the payable total strictly as the sum of rounded line-item subtotals: `LineSubtotal = round(qty × price)`. Both the estimated total and the final settlement payouts are derived from this exact same line-item array, guaranteeing zero financial drift down to ₹0.01."*

### Q4: "Can buyers cancel after a farmer harvests?"
> **Answer**: *"No. Our 12-stage state machine mandates that the order status cannot advance to `batch_formed` or `pickup_scheduled` until buyer funds are locked in `payment_held` escrow. Once escrow is funded, the buyer cannot unilaterally withdraw without triggering administrative arbitration."*
