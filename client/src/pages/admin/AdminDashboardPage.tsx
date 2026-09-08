import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Wallet, Sprout, ShoppingBag, PackageCheck, Truck, Boxes } from "lucide-react";
import { CROP_LABELS } from "@kisansetu/shared";
import { adminApi } from "../../lib/api";
import { StatCard } from "../../components/ui/StatCard";
import { Card, CardHeader, CardTitle } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => adminApi.dashboard() });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  const { summary, gmvSeries, cropActivity, regionalActivity } = data;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-charcoal-900">{t("admin.dashboardTitle")}</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("admin.gmv")} value={summary.gmv} prefix="₹" icon={Wallet} tone="brand" />
        <StatCard label={t("admin.totalFarmers")} value={summary.totalFarmers} icon={Sprout} tone="fresh" />
        <StatCard label={t("admin.totalBuyers")} value={summary.totalBuyers} icon={ShoppingBag} tone="clay" />
        <StatCard label={t("admin.activeListings")} value={summary.activeListings} icon={Boxes} tone="neutral" />
        <StatCard label={t("admin.totalOrders")} value={summary.totalOrders} icon={PackageCheck} tone="brand" />
        <StatCard label="Aggregated orders" value={summary.aggregatedOrders} icon={Boxes} tone="fresh" />
        <StatCard label="Farmer earnings" value={summary.totalFarmerEarnings} prefix="₹" icon={Wallet} tone="clay" />
        <StatCard label="Deliveries completed" value={summary.successfulDeliveries} icon={Truck} tone="neutral" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GMV — last 30 days</CardTitle>
        </CardHeader>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={gmvSeries} margin={{ left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,28,25,0.06)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#4A4A45" }} tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} />
              <YAxis tick={{ fontSize: 11, fill: "#4A4A45" }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid rgba(28,28,25,0.08)", fontSize: 12 }} formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
              <Line type="monotone" dataKey="gmv" stroke="#1F4D36" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active supply by crop</CardTitle>
          </CardHeader>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cropActivity.map((c) => ({ ...c, label: CROP_LABELS[c.crop] ?? c.crop }))} margin={{ left: -20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,28,25,0.06)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#4A4A45" }} />
                <YAxis tick={{ fontSize: 11, fill: "#4A4A45" }} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid rgba(28,28,25,0.08)", fontSize: 12 }} />
                <Bar dataKey="supplyKg" fill="#5CAE54" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active supply by region</CardTitle>
          </CardHeader>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionalActivity} margin={{ left: -20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,28,25,0.06)" />
                <XAxis dataKey="region" tick={{ fontSize: 11, fill: "#4A4A45" }} />
                <YAxis tick={{ fontSize: 11, fill: "#4A4A45" }} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid rgba(28,28,25,0.08)", fontSize: 12 }} />
                <Bar dataKey="supplyKg" fill="#1F4D36" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
