/**
 * Great-circle distance between two lat/lon points, in kilometres.
 * Used by the aggregation engine to rank listings by proximity to a buyer's
 * destination, and to compute each farmer's contribution's "distance_km".
 */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // mean Earth radius, km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
}

/** Approximate lat/lon centroid for each of KisanSetu's five covered regions,
 * used when we only know a listing/buyer's region (not exact coordinates). */
export const REGION_CENTROIDS: Record<string, [number, number]> = {
  Nashik: [19.9975, 73.7898],
  Pune: [18.5204, 73.8567],
  Satara: [17.6805, 74.0183],
  Sangli: [16.8524, 74.5815],
  Ahmednagar: [19.0948, 74.748],
};
