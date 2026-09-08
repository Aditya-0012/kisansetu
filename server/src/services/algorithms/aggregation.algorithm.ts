/**
 * The Smart Aggregation Engine — KisanSetu's signature algorithm.
 *
 * Pure, dependency-free functions (no DB, no HTTP) so the core logic is easy
 * to unit-test and to reason about independently of how listings are
 * fetched. `aggregationService.ts` is the thin, DB-aware wrapper that calls
 * these with real repository data and persists the result.
 *
 * Pipeline (spec section 23):
 *   1. findCompatibleListings — match crop + active status + within radius
 *   2. rankListings           — sort by a composite of distance/price/qty/rating
 *   3. buildOptimalBatch      — greedily fill the requested quantity
 *   4. calculateWeightedPrice — volume-weighted average price across contributors
 *   5. calculatePayoutDistribution — each farmer's share of the total
 */
import { haversineKm } from "../../utils/distance";

export interface CandidateListing {
  listingId: string;
  farmerId: string;
  farmerName: string;
  farmerRating: number; // 0-5
  cropCode: string;
  pricePerKg: number;
  availableQuantityKg: number;
  latitude: number;
  longitude: number;
  village?: string | null;
  region: string;
}

export interface RankedCandidate extends CandidateListing {
  distanceKm: number;
  score: number;
}

export interface BatchContribution {
  listingId: string;
  farmerId: string;
  farmerName: string;
  farmerRating: number;
  quantityKg: number;
  pricePerKg: number;
  subtotal: number;
  distanceKm: number;
}

export interface BatchResult {
  requestedQuantityKg: number;
  fulfilledQuantityKg: number;
  supplyGapKg: number;
  contributions: BatchContribution[];
  weightedPricePerKg: number;
  averageDistanceKm: number;
  estimatedTotal: number;
  listingsAnalyzed: number;
  fullyFulfilled: boolean;
}

/** Step 1 — narrow the universe of listings down to ones that could
 * possibly contribute: right crop, has stock, within the search radius. */
export function findCompatibleListings(
  listings: CandidateListing[],
  crop: string,
  destLat: number,
  destLon: number,
  maxDistanceKm: number = 250
): RankedCandidate[] {
  const limit = maxDistanceKm && maxDistanceKm > 0 ? maxDistanceKm : 250;
  return listings
    .filter((l) => l.cropCode === crop && l.availableQuantityKg > 0)
    .map((l) => ({
      ...l,
      distanceKm: haversineKm(destLat, destLon, l.latitude, l.longitude),
      score: 0,
    }))
    .filter((l) => l.distanceKm <= limit);
}

/**
 * Step 2 — composite ranking. Lower score = better candidate.
 *
 * Each factor is normalized to roughly a 0-1 range against the candidate
 * pool before weighting, so no single factor (e.g. a very cheap but tiny
 * listing) dominates purely because of its raw units. Weights sum to 1 and
 * were chosen to match the spec's stated priority order — distance, price,
 * quantity, then rating — while still letting an excellent rating meaningfully
 * offset a slightly longer trip.
 */
const WEIGHTS = { distance: 0.35, price: 0.3, quantity: 0.2, rating: 0.15 };

export function rankListings(candidates: RankedCandidate[]): RankedCandidate[] {
  if (candidates.length === 0) return [];

  const distances = candidates.map((c) => c.distanceKm);
  const prices = candidates.map((c) => c.pricePerKg);
  const quantities = candidates.map((c) => c.availableQuantityKg);

  const maxDistance = Math.max(...distances, 1);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices, minPrice + 1);
  const maxQuantity = Math.max(...quantities, 1);

  const scored = candidates.map((c) => {
    const normDistance = c.distanceKm / maxDistance; // 0 = closest
    const normPrice = (c.pricePerKg - minPrice) / (maxPrice - minPrice); // 0 = cheapest
    const normQuantity = 1 - c.availableQuantityKg / maxQuantity; // 0 = largest supply
    const normRating = 1 - c.farmerRating / 5; // 0 = best rated

    const score =
      WEIGHTS.distance * normDistance +
      WEIGHTS.price * normPrice +
      WEIGHTS.quantity * normQuantity +
      WEIGHTS.rating * normRating;

    return { ...c, score };
  });

  return scored.sort((a, b) => a.score - b.score);
}

/** Step 3+4+5 — greedily take from the best-ranked listings until the
 * requested quantity is met (or supply runs out), then compute the
 * volume-weighted price and per-farmer payout split. */
export function buildOptimalBatch(
  rankedCandidates: RankedCandidate[],
  requiredQuantityKg: number
): BatchResult {
  const contributions: BatchContribution[] = [];
  let remaining = requiredQuantityKg;

  for (const candidate of rankedCandidates) {
    if (remaining <= 0) break;
    const take = Math.min(candidate.availableQuantityKg, remaining);
    if (take <= 0) continue;
    const takeRounded = round2(take);
    contributions.push({
      listingId: candidate.listingId,
      farmerId: candidate.farmerId,
      farmerName: candidate.farmerName,
      farmerRating: candidate.farmerRating,
      quantityKg: takeRounded,
      pricePerKg: candidate.pricePerKg,
      // Derived from the *rounded* quantity so this line item, the batch
      // total, and the eventual payout line (calculatePayoutDistribution)
      // all agree to the paisa — no independent rounding paths to drift.
      subtotal: round2(takeRounded * candidate.pricePerKg),
      distanceKm: round1(candidate.distanceKm),
    });
    remaining -= take;
  }

  const fulfilledQuantityKg = round2(contributions.reduce((s, c) => s + c.quantityKg, 0));
  const weightedPricePerKg = calculateWeightedPrice(contributions);
  const averageDistanceKm = contributions.length
    ? round1(contributions.reduce((s, c) => s + c.distanceKm, 0) / contributions.length)
    : 0;
  // The payable total is the exact sum of what each farmer is owed, not a
  // re-derivation from the (rounded, informational) weighted average price —
  // multiplying fulfilledQuantityKg × weightedPricePerKg again would
  // double-round and could drift a few rupees from what farmers are actually
  // allocated below. calculatePayoutDistribution uses this same per-line
  // subtotal, so estimatedTotal always reconciles exactly with total payouts.
  const estimatedTotal = round2(contributions.reduce((s, c) => s + c.subtotal, 0));

  return {
    requestedQuantityKg: requiredQuantityKg,
    fulfilledQuantityKg,
    supplyGapKg: round2(Math.max(0, requiredQuantityKg - fulfilledQuantityKg)),
    contributions,
    weightedPricePerKg,
    averageDistanceKm,
    estimatedTotal,
    listingsAnalyzed: rankedCandidates.length,
    fullyFulfilled: fulfilledQuantityKg >= requiredQuantityKg - 0.01,
  };
}

export function calculateWeightedPrice(contributions: { quantityKg: number; pricePerKg: number }[]): number {
  const totalQty = contributions.reduce((s, c) => s + c.quantityKg, 0);
  if (totalQty === 0) return 0;
  const totalValue = contributions.reduce((s, c) => s + c.quantityKg * c.pricePerKg, 0);
  return round2(totalValue / totalQty);
}

export interface PayoutLine {
  farmerId: string;
  quantityKg: number;
  amount: number;
}

/** Used both when a batch is first formed (estimated payout) and again at
 * settlement time (actual payout against delivered quantity) — same
 * proportional-split logic either way, per spec section 26: "Settlement
 * calculated according to delivered quantity and agreed price." */
export function calculatePayoutDistribution(
  contributions: { farmerId: string; quantityKg: number; pricePerKg: number }[]
): PayoutLine[] {
  return contributions.map((c) => ({
    farmerId: c.farmerId,
    quantityKg: round2(c.quantityKg),
    amount: round2(c.quantityKg * c.pricePerKg),
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
