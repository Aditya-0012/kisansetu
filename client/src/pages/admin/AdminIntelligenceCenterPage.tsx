import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Radar, TrendingUp, TrendingDown, Minus, Cpu, Sparkles, Boxes, Truck } from "lucide-react";
import { CROP_LABELS } from "@kisansetu/shared";
import { adminApi } from "../../lib/api";
import { StatCard } from "../../components/ui/StatCard";
import { Card, CardHeader, CardTitle } from "../../components/ui/Card";
import { Badge, orderStatusTone } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";

const TREND_ICON = { rising: TrendingUp, falling: TrendingDown, stable: Minus };
const TREND_CLASS = { rising: "text-state-success", falling: "text-state-danger", stable: "text-state-info" };

export function AdminIntelligenceCenterPage() {
  const { t } = useTranslation();
  const dashboardQuery = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => adminApi.dashboard() });
  const forecastQuery = useQuery({ queryKey: ["admin", "forecast"], queryFn: () => adminApi.forecast(), refetchInterval: 30_000 });
  const batchesQuery = useQuery({ queryKey: ["admin", "batches"], queryFn: () => adminApi.batches(), refetchInterval: 30_000 });
  const pricesQuery = useQuery({ queryKey: ["admin", "prices"], queryFn: () => adminApi.prices(), refetchInterval: 30_000 });

  const summary = dashboardQuery.data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-charcoal-900">{t("admin.intelligenceCenter")}</h1>
          <p className="text-sm text-charcoal-600">Real-time view across forecasting, aggregation, and pricing.</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-state-success/10 px-3 py-1.5 text-xs font-bold text-state-success">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-state-success/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-state-success" />
          </span>
          LIVE
        </span>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Active smart batches" value={summary.activeSmartBatches} icon={Boxes} tone="brand" />
          <StatCard label="Buyer demand (30d)" value={summary.buyerDemandTonnes} suffix=" t" decimals={1} icon={TrendingUp} tone="fresh" />
          <StatCard label="Farmers connected" value={summary.farmersConnected} icon={Radar} tone="clay" />
          <StatCard label="Deliveries completed" value={summary.successfulDeliveries} icon={Truck} tone="neutral" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Cpu className="h-4 w-4" /> Demand forecast monitor
          </CardTitle>
        </CardHeader>
        {forecastQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : forecastQuery.isError ? (
          <ErrorState error={forecastQuery.error} onRetry={() => forecastQuery.refetch()} />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-charcoal-900/8 text-left text-xs font-semibold uppercase tracking-wide text-charcoal-600">
                  <th className="pb-2">Crop</th>
                  <th className="pb-2">Region</th>
                  <th className="pb-2">Expected demand</th>
                  <th className="pb-2">Growth</th>
                  <th className="pb-2">Trend</th>
                  <th className="pb-2">Confidence</th>
                  <th className="pb-2">Model</th>
                </tr>
              </thead>
              <tbody>
                {(forecastQuery.data?.forecasts ?? []).map((f, i) => {
                  const TrendIcon = TREND_ICON[f.trend];
                  return (
                    <tr key={`${f.crop}-${f.region}-${i}`} className="border-b border-charcoal-900/5">
                      <td className="py-2 font-semibold text-charcoal-900">{CROP_LABELS[f.crop] ?? f.crop}</td>
                      <td className="py-2 text-charcoal-700">{f.region}</td>
                      <td className="py-2 text-charcoal-700">{f.expectedDemandKg.toFixed(0)} kg</td>
                      <td className={`py-2 font-semibold ${f.growthPercent >= 0 ? "text-state-success" : "text-state-danger"}`}>
                        {f.growthPercent >= 0 ? "+" : ""}
                        {f.growthPercent.toFixed(1)}%
                      </td>
                      <td className="py-2">
                        <TrendIcon className={`h-4 w-4 ${TREND_CLASS[f.trend]}`} />
                      </td>
                      <td className="py-2 text-charcoal-700">{Math.round(f.confidence * 100)}%</td>
                      <td className="py-2">
                        <Badge tone="brand">
                          {f.methodology === "ml_service" ? <Cpu className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                          {f.methodology === "ml_service" ? f.modelName : "Fallback"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Boxes className="h-4 w-4" /> Smart aggregation batches
          </CardTitle>
        </CardHeader>
        {batchesQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : batchesQuery.isError ? (
          <ErrorState error={batchesQuery.error} onRetry={() => batchesQuery.refetch()} />
        ) : (
          <div className="space-y-2">
            {(batchesQuery.data?.batches ?? []).slice(0, 10).map((b) => {
              const pct = Math.min(100, Math.round((b.fulfilledQuantityKg / b.requestedQuantityKg) * 100));
              return (
                <div key={b.id} className="rounded-lg bg-cream-100 px-3.5 py-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-charcoal-900">
                      {b.batchCode} · {CROP_LABELS[b.crop] ?? b.crop} → {b.destinationRegion}
                    </span>
                    <Badge tone={orderStatusTone(b.status)}>{b.status}</Badge>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-charcoal-900/8">
                      <div className={`h-full ${pct >= 95 ? "bg-state-success" : "bg-state-warning"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-charcoal-600">
                      {b.fulfilledQuantityKg}/{b.requestedQuantityKg}kg · {b.contributions.length} farmers
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live mandi prices</CardTitle>
        </CardHeader>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
          {(pricesQuery.data?.prices ?? []).map((p) => (
            <div key={`${p.crop}-${p.region}`} className="min-w-[140px] flex-shrink-0 rounded-lg border border-charcoal-900/8 bg-white p-3">
              <p className="text-xs font-semibold text-charcoal-600">
                {CROP_LABELS[p.crop] ?? p.crop} · {p.region}
              </p>
              <p className="mt-1 font-display text-lg font-extrabold text-charcoal-900">₹{p.pricePerKg.toFixed(0)}</p>
              <p className={`text-xs font-semibold ${p.changePercent >= 0 ? "text-state-success" : "text-state-danger"}`}>
                {p.changePercent >= 0 ? "+" : ""}
                {p.changePercent.toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
