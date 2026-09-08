/**
 * Internal fallback forecasting model — used when the Python ML service
 * (ml/services/api.py, a scikit-learn RandomForestRegressor) is unreachable.
 *
 * This is deliberately a *simple, honest* model: linear regression over a
 * recent trend window plus a 7-day moving-average baseline, with a
 * confidence interval derived from the residual spread of the fit. It is
 * not dressed up to look more sophisticated than it is — see
 * docs/demand-forecasting.md for the full methodology writeup and why a
 * transparent fallback matters more than a fancy one here (spec: "do not
 * pretend an advanced model exists if it doesn't").
 *
 * Zero external dependencies, so this file (and only this file) is what we
 * can actually execute inside a sandbox with no package registry access —
 * see the verification run in the project's dev notes.
 */

export interface HistoryPoint {
  date: string; // ISO date
  value: number;
}

export interface ForecastSeriesPoint {
  date: string;
  actual: number | null;
  forecast: number | null;
  lowerBound: number | null;
  upperBound: number | null;
}

export interface InternalForecastResult {
  expectedDemandKg: number;
  lowerBoundKg: number;
  upperBoundKg: number;
  growthPercent: number;
  confidence: number; // 0-1
  trend: "rising" | "falling" | "stable";
  series: ForecastSeriesPoint[];
  modelName: string;
}

function linearRegression(xs: number[], ys: number[]) {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  // R² — how much of the variance the line actually explains
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept;
    ssRes += (ys[i] - predicted) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  const residualStd = Math.sqrt(ssRes / Math.max(1, n - 2));

  return { slope, intercept, r2, residualStd };
}

function movingAverage(values: number[], window: number): number {
  const slice = values.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * @param history        Daily historical values, oldest first, ideally 45-150 days.
 * @param horizonDays     How many days ahead to forecast (7/14/30).
 * @param trendWindowDays How many recent days to fit the trend line on.
 */
export function forecastFromHistory(
  history: HistoryPoint[],
  horizonDays: number,
  trendWindowDays = 45
): InternalForecastResult {
  if (history.length < 10) {
    // Not enough signal for a trend line — fall back to a flat projection
    // off the recent average, with a wide, honest confidence band.
    const avg = history.length ? movingAverage(history.map((h) => h.value), history.length) : 0;
    return {
      expectedDemandKg: round2(avg * horizonDays),
      lowerBoundKg: round2(avg * horizonDays * 0.75),
      upperBoundKg: round2(avg * horizonDays * 1.25),
      growthPercent: 0,
      confidence: 0.4,
      trend: "stable",
      series: history.map((h) => ({ date: h.date, actual: h.value, forecast: null, lowerBound: null, upperBound: null })),
      modelName: "flat_average_fallback",
    };
  }

  const recent = history.slice(-trendWindowDays);
  const xs = recent.map((_, i) => i);
  const ys = recent.map((h) => h.value);
  const { slope, intercept, r2, residualStd } = linearRegression(xs, ys);

  const lastIndex = xs[xs.length - 1];
  const forecastPoints: ForecastSeriesPoint[] = [];

  // Historical portion of the series (for the chart's solid line)
  for (const h of history) {
    forecastPoints.push({ date: h.date, actual: h.value, forecast: null, lowerBound: null, upperBound: null });
  }

  // z ~ 1.28 for an ~80% interval — wide enough to be honest about
  // uncertainty, narrow enough to be a useful signal rather than noise.
  const z = 1.28;
  let forecastTotal = 0;
  const lastDate = new Date(history[history.length - 1].date);

  for (let d = 1; d <= horizonDays; d++) {
    const x = lastIndex + d;
    const predicted = Math.max(0, slope * x + intercept);
    const band = z * residualStd * Math.sqrt(1 + d / trendWindowDays); // widen further out
    const date = new Date(lastDate);
    date.setDate(date.getDate() + d);
    forecastPoints.push({
      date: date.toISOString().slice(0, 10),
      actual: null,
      forecast: round2(predicted),
      lowerBound: round2(Math.max(0, predicted - band)),
      upperBound: round2(predicted + band),
    });
    forecastTotal += predicted;
  }

  // Growth = forecast average/day vs. the average/day over an equally long
  // immediately-preceding window — an apples-to-apples "vs last N days" comparison.
  const recentWindow = history.slice(-horizonDays).map((h) => h.value);
  const recentAvgPerDay = recentWindow.reduce((a, b) => a + b, 0) / Math.max(1, recentWindow.length);
  const forecastAvgPerDay = forecastTotal / horizonDays;
  const growthPercent = recentAvgPerDay === 0 ? 0 : round2(((forecastAvgPerDay - recentAvgPerDay) / recentAvgPerDay) * 100);

  const trend: InternalForecastResult["trend"] =
    growthPercent > 3 ? "rising" : growthPercent < -3 ? "falling" : "stable";

  // Confidence blends fit quality (R²) with how much data we had — a great
  // fit on only 12 days shouldn't read as more confident than the same fit
  // on 120 days.
  const dataConfidence = Math.min(1, history.length / 90);
  const confidence = round2(Math.min(0.95, Math.max(0.35, 0.5 * r2 + 0.5 * dataConfidence)));

  const lowerBoundKg = round2(
    forecastPoints.slice(-horizonDays).reduce((s, p) => s + (p.lowerBound ?? 0), 0)
  );
  const upperBoundKg = round2(
    forecastPoints.slice(-horizonDays).reduce((s, p) => s + (p.upperBound ?? 0), 0)
  );

  return {
    expectedDemandKg: round2(forecastTotal),
    lowerBoundKg,
    upperBoundKg,
    growthPercent,
    confidence,
    trend,
    series: forecastPoints,
    modelName: "linear_trend_with_confidence_band",
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
