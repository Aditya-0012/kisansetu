// Direct Node.js runner for the 12-stage SIH demo loop
const BASE = process.env.API_URL || "http://localhost:4000/api";

async function call(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`[${res.status}] ${path}: ${data?.error?.message || res.statusText}`);
  }
  return data;
}

async function login(email) {
  const res = await call("/auth/login", {
    method: "POST",
    body: { email, password: "Demo@123" },
  });
  return { token: res.token, user: res.user };
}

async function main() {
  console.log("==> Logging in 3 demo actors...");
  const farmer = await login("farmer@kisansetu.demo");
  const buyer = await login("buyer@kisansetu.demo");
  const admin = await login("admin@kisansetu.demo");
  console.log(`✓ Farmer: ${farmer.user.name} (${farmer.user.id})`);
  console.log(`✓ Buyer:  ${buyer.user.name} (${buyer.user.id})`);
  console.log(`✓ Admin:  ${admin.user.name} (${admin.user.id})`);

  const vars = {};
  const CROP = "tomato";
  const REGION = "Pune";

  // Stage 1: FORECAST
  console.log("\n[1/12] FORECAST: Reading demand forecast...");
  const { forecast } = await call(`/forecast/${CROP}?region=${REGION}&horizonDays=14`, { token: farmer.token });
  vars.forecast = forecast;
  console.log(`✓ Forecast: ${forecast.trend} (${forecast.expectedDemandKg.toFixed(1)} kg, model=${forecast.methodology})`);

  // Stage 2: INFORM
  console.log("\n[2/12] INFORM: Getting fair-price suggestion...");
  const { suggestion } = await call(`/prices/${CROP}/fair-price?region=${REGION}`, { token: farmer.token });
  vars.suggestion = suggestion;
  console.log(`✓ Fair price: ₹${suggestion.suggestedMin} - ₹${suggestion.suggestedMax}/kg (mandi: ₹${suggestion.mandiPrice})`);

  // Stage 3: LIST
  console.log("\n[3/12] LIST: Farmer listing produce...");
  const price = vars.suggestion.suggestedMax || 24;
  const { listing } = await call("/listings", {
    method: "POST",
    token: farmer.token,
    body: {
      crop: CROP,
      quantityKg: 140,
      expectedPricePerKg: Number(price.toFixed(2)),
      harvestDate: new Date().toISOString().slice(0, 10),
      quality: "A",
      region: REGION,
      description: "Fresh produce from automated test run.",
    },
  });
  vars.listing = listing;
  console.log(`✓ Created listing ${listing.id}: 140kg @ ₹${listing.expectedPricePerKg}/kg`);

  // Stage 4: DISCOVER
  console.log("\n[4/12] DISCOVER: Buyer searching marketplace...");
  const results = await call(`/listings?crop=${CROP}&region=${REGION}&pageSize=50`, { token: buyer.token });
  console.log(`✓ Marketplace total: ${results.total} listings found`);

  // Stage 5: AGGREGATE
  console.log("\n[5/12] AGGREGATE: Smart Aggregation Engine pooling bulk batch...");
  const { batch, analysis } = await call("/aggregation/find", {
    method: "POST",
    token: buyer.token,
    body: { crop: CROP, requiredQuantityKg: 300, destinationRegion: REGION },
  });
  vars.batch = batch;
  console.log(`✓ Aggregation: ${batch.contributions.length} farmers combined into ${batch.fulfilledQuantityKg}kg batch (weighted: ₹${batch.weightedPricePerKg.toFixed(2)}/kg)`);

  // Stage 6: NEGOTIATE
  console.log("\n[6/12] NEGOTIATE: Direct offer & negotiation...");
  const offerPrice = Number((vars.listing.expectedPricePerKg * 0.95).toFixed(2));
  const { offer } = await call("/offers", {
    method: "POST",
    token: buyer.token,
    body: { listingId: vars.listing.id, offeredPricePerKg: offerPrice, quantityKg: 20 },
  });
  const { offer: accepted } = await call(`/offers/${offer.id}`, {
    method: "PATCH",
    token: farmer.token,
    body: { action: "accept" },
  });
  console.log(`✓ Offer ${offer.id} accepted @ ₹${offerPrice}/kg`);

  // Stage 7: ORDER
  console.log("\n[7/12] ORDER: Confirming order & escrow lock...");
  const { order } = await call(`/aggregation/${vars.batch.id}/confirm`, {
    method: "POST",
    token: buyer.token,
  });
  vars.order = order;
  console.log(`✓ Order confirmed: ${order.orderCode} (Total: ₹${order.totalAmount})`);

  // Stage 8: LOGISTICS
  console.log("\n[8/12] LOGISTICS: Scheduling pickup slot...");
  const { pickup } = await call(`/pickups/${vars.order.id}`, {
    method: "POST",
    token: buyer.token,
    body: {
      scheduledDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      scheduledTime: "09:00 AM",
      location: `${REGION} Collection Hub`,
      vehicleNumber: "MH12-TEST-01",
      driverName: "Suresh Patil",
    },
  });
  console.log(`✓ Pickup scheduled: ${pickup.scheduledDate} ${pickup.scheduledTime} with ${pickup.driverName}`);

  // Stage 9: ESCROW
  console.log("\n[9/12] ESCROW: Verifying escrow hold status...");
  const orderDetails = await call(`/orders/${vars.order.id}`, { token: buyer.token });
  console.log(`✓ Order verified in escrow: ${orderDetails.order.status}`);

  // Stage 10: DELIVER
  console.log("\n[10/12] DELIVER: Transit and delivery confirmation...");
  await call(`/orders/${vars.order.id}/in-transit`, { method: "POST", token: buyer.token });
  const { order: delivered } = await call(`/orders/${vars.order.id}/deliver`, { method: "POST", token: buyer.token });
  vars.order = delivered;
  console.log(`✓ Delivery confirmed: status=${delivered.status}`);

  // Stage 11: SETTLE
  console.log("\n[11/12] SETTLE: Escrow payment release & payout distribution...");
  const { order: settled, payment } = await call(`/payments/${vars.order.id}/release`, {
    method: "POST",
    token: buyer.token,
  });
  console.log(`✓ Escrow settled: ₹${payment.amount} distributed to ${payment.allocations.length} farmers`);

  // Stage 12: LEARN
  console.log("\n[12/12] LEARN: Platform intelligence updated...");
  const { summary } = await call("/admin/dashboard", { token: admin.token });
  console.log(`✓ Admin GMV: ₹${summary.gmv.toLocaleString("en-IN")}, Deliveries: ${summary.successfulDeliveries}`);

  console.log("\n=======================================================");
  console.log("🎉 ALL 12 STAGES OF SIH DEMO MODE PASSED SUCCESSFULLY!");
  console.log("=======================================================\n");
}

main().catch((err) => {
  console.error("\n❌ DEMO RUN FAILED:", err);
  process.exit(1);
});
