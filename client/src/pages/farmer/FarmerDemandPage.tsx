import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, TrendingDown, Minus, Cpu, Sparkles } from "lucide-react";
import { CROP_LABELS, CropCategory, REGIONS } from "@kisansetu/shared";
import { useAuth } from "../../hooks/useAuth";
import { forecastApi } from "../../lib/api";
import { Card, CardHeader, CardTitle } from "../../components/ui/Card";
import { Select } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { getCropName } from "../../utils/cropNames";

const TREND_META = {
  rising: { icon: TrendingUp, colorClass: "text-state-success" },
  falling: { icon: TrendingDown, colorClass: "text-state-danger" },
  stable: { icon: Minus, colorClass: "text-state-info" },
};

export function FarmerDemandPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [crop, setCrop] = useState<CropCategory>(CropCategory.TOMATO);
  const [region, setRegion] = useState<string>(user?.region ?? REGIONS[0]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["forecast", crop, region],
    queryFn: () => forecastApi.get(crop, region, 14),
  });

  const forecast = data?.forecast;
  const chartData = useMemo(
    () =>
      (forecast?.series ?? []).map((p) => ({
        date: new Date(p.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        actual: p.actual,
        forecast: p.forecast,
        band: p.upperBound != null && p.lowerBound != null ? [p.lowerBound, p.upperBound] : undefined,
      })),
    [forecast]
  );

  const trendMeta = forecast ? TREND_META[forecast.trend] : TREND_META.stable;
  const TrendIcon = trendMeta.icon;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-charcoal-900">{t("farmer.demandTitle")}</h1>
        <p className="text-sm text-charcoal-600">{t("farmer.demandSubtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={crop} onChange={(e) => setCrop(e.target.value as CropCategory)} className="max-w-[180px]">
          {Object.values(CropCategory).map((c) => (
            <option key={c} value={c}>
              {getCropName(c, t)}
            </option>
          ))}
        </Select>
        <Select value={region} onChange={(e) => setRegion(e.target.value)} className="max-w-[160px]">
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : forecast ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs font-semibold text-charcoal-600">{t("farmer.demand.expectedDemand")}</p>
              <p className="mt-1 font-display text-xl font-extrabold text-charcoal-900">{forecast.expectedDemandKg.toFixed(0)} kg</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold text-charcoal-600">{t("farmer.demand.currentSupply")}</p>
              <p className="mt-1 font-display text-xl font-extrabold text-charcoal-900">{forecast.currentSupplyKg.toFixed(0)} kg</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold text-charcoal-600">{t("farmer.demand.supplyGap")}</p>
              <p className={`mt-1 font-display text-xl font-extrabold ${forecast.supplyGapKg > 0 ? "text-state-success" : "text-state-danger"}`}>
                {forecast.supplyGapKg > 0 ? "+" : ""}
                {forecast.supplyGapKg.toFixed(0)} kg
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold text-charcoal-600">{t("farmer.demand.trend")}</p>
              <p className="mt-1 flex items-center gap-1.5 font-display text-xl font-extrabold text-charcoal-900">
                <TrendIcon className={`h-5 w-5 ${trendMeta.colorClass}`} />
                {forecast.growthPercent >= 0 ? "+" : ""}
                {forecast.growthPercent.toFixed(1)}%
              </p>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{getCropName(crop, t)} {t("nav.demand")} — {region}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge tone="brand">
                  {forecast.methodology === "ml_service" ? <Cpu className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                  {forecast.methodology === "ml_service" ? forecast.modelName : "Internal estimate"}
                </Badge>
                <Badge tone="neutral">{Math.round(forecast.confidence * 100)}% confidence</Badge>
              </div>
            </CardHeader>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ left: -20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,28,25,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#4A4A45" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#4A4A45" }} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid rgba(28,28,25,0.08)", fontSize: 12 }} />
                  <Area type="monotone" dataKey="band" stroke="none" fill="#5CAE54" fillOpacity={0.12} />
                  <Line type="monotone" dataKey="actual" stroke="#1F4D36" strokeWidth={2} dot={false} name="Actual" connectNulls={false} />
                  <Line type="monotone" dataKey="forecast" stroke="#5CAE54" strokeWidth={2} strokeDasharray="5 4" dot={false} name="Forecast" connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">{forecast.recommendation}</p>
            <p className="mt-3 text-xs text-charcoal-600/70">
              Advisory forecast for planning purposes only — actual market conditions may vary. Not a guarantee of price or demand.
            </p>
          </Card>
        </>
      ) : null}
    </div>
  );
}
