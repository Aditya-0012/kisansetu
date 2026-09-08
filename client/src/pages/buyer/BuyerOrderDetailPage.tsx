import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, MapPin, ShieldCheck, Star, Truck } from "lucide-react";
import { OrderItemRecord, OrderStatus } from "@kisansetu/shared";
import { orderApi, paymentApi, pickupApi, ratingApi, ApiRequestError } from "../../lib/api";
import { Card, CardHeader, CardTitle } from "../../components/ui/Card";
import { Badge, orderStatusTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { ErrorState } from "../../components/ui/ErrorState";
import { useToast } from "../../components/ui/Toast";
import { getCropName } from "../../utils/cropNames";
import { cn } from "../../lib/cn";

const TIMELINE_KEYS: { status: OrderStatus; key: string }[] = [
  { status: OrderStatus.PAYMENT_HELD, key: "payment_held" },
  { status: OrderStatus.BATCH_FORMED, key: "batch_formed" },
  { status: OrderStatus.PICKUP_SCHEDULED, key: "pickup_scheduled" },
  { status: OrderStatus.IN_TRANSIT, key: "in_transit" },
  { status: OrderStatus.DELIVERED, key: "delivered" },
  { status: OrderStatus.PAYMENT_RELEASED, key: "payment_released" },
  { status: OrderStatus.COMPLETED, key: "completed" },
];

function PickupScheduleForm({ orderId, onScheduled }: { orderId: string; onScheduled: () => void }) {
  const { t } = useTranslation();
  const { push } = useToast();
  const [form, setForm] = useState({ scheduledDate: "", scheduledTime: "", location: "", vehicleNumber: "", driverName: "" });

  const schedule = useMutation({
    mutationFn: () => pickupApi.schedule(orderId, form),
    onSuccess: () => {
      push({
        kind: "success",
        title: t("logistics.pickupScheduledTitle"),
        description: t("logistics.smsNotificationSent"),
      });
      onScheduled();
    },
    onError: (err) =>
      push({
        kind: "error",
        title: err instanceof ApiRequestError ? err.message : t("common.somethingWentWrong"),
      }),
  });

  const complete = Object.values(form).every(Boolean);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input
        label={t("logistics.pickupDate")}
        type="date"
        value={form.scheduledDate}
        onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
      />
      <Input
        label={t("logistics.pickupTime")}
        placeholder="10:00 AM"
        value={form.scheduledTime}
        onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))}
      />
      <Input
        label={t("logistics.location")}
        value={form.location}
        onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
        className="sm:col-span-2"
      />
      <Input
        label={t("logistics.vehicleNumber")}
        value={form.vehicleNumber}
        onChange={(e) => setForm((f) => ({ ...f, vehicleNumber: e.target.value }))}
      />
      <Input
        label={t("logistics.driverName")}
        value={form.driverName}
        onChange={(e) => setForm((f) => ({ ...f, driverName: e.target.value }))}
      />
      <Button
        className="sm:col-span-2"
        disabled={!complete}
        loading={schedule.isPending}
        onClick={() => schedule.mutate()}
      >
        {t("logistics.schedulePickup")}
      </Button>
    </div>
  );
}

function RateFarmer({ orderId, farmerId, farmerName }: { orderId: string; farmerId: string; farmerName: string }) {
  const { t } = useTranslation();
  const { push } = useToast();
  const [scores, setScores] = useState({ quality: 5, reliability: 5, communication: 5, timeliness: 5 });
  const [submitted, setSubmitted] = useState(false);

  const submit = useMutation({
    mutationFn: () => ratingApi.submit(orderId, { toUserId: farmerId, ...scores }),
    onSuccess: () => {
      setSubmitted(true);
      push({ kind: "success", title: `${t("buyer.orderDetail.rateFarmer")}: ${farmerName}` });
    },
    onError: (err) =>
      push({ kind: "error", title: err instanceof ApiRequestError ? err.message : t("common.somethingWentWrong") }),
  });

  if (submitted) {
    return (
      <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
        ✓ {farmerName} {t("common.confirm").toLowerCase()}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-charcoal-900/10 p-3">
      <p className="text-sm font-semibold text-charcoal-900">{farmerName}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {(["quality", "reliability", "communication", "timeliness"] as const).map((dim) => (
          <label key={dim} className="flex items-center justify-between capitalize">
            <span>{dim}</span>
            <select
              value={scores[dim]}
              onChange={(e) => setScores((s) => ({ ...s, [dim]: Number(e.target.value) }))}
              className="rounded border border-charcoal-900/10 bg-white px-2 py-1 text-xs"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} ★
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <Button size="sm" loading={submit.isPending} onClick={() => submit.mutate()}>
        {t("buyer.orderDetail.submitRating")}
      </Button>
    </div>
  );
}

export function BuyerOrderDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { push } = useToast();

  const orderQuery = useQuery({ queryKey: ["orders", id], queryFn: () => orderApi.getById(id!), enabled: !!id });
  const pickupQuery = useQuery({ queryKey: ["pickup", id], queryFn: () => pickupApi.forOrder(id!), enabled: !!id });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["orders", id] });
    qc.invalidateQueries({ queryKey: ["pickup", id] });
  }

  const markInTransit = useMutation({
    mutationFn: () => orderApi.markInTransit(id!),
    onSuccess: invalidate,
    onError: (err) =>
      push({ kind: "error", title: err instanceof ApiRequestError ? err.message : t("common.somethingWentWrong") }),
  });

  const markDelivered = useMutation({
    mutationFn: () => orderApi.markDelivered(id!),
    onSuccess: invalidate,
    onError: (err) =>
      push({ kind: "error", title: err instanceof ApiRequestError ? err.message : t("common.somethingWentWrong") }),
  });

  const releasePayment = useMutation({
    mutationFn: () => paymentApi.release(id!),
    onSuccess: () => {
      push({ kind: "success", title: t("orderStatus.payment_released") });
      invalidate();
    },
    onError: (err) =>
      push({ kind: "error", title: err instanceof ApiRequestError ? err.message : t("common.somethingWentWrong") }),
  });

  if (orderQuery.isLoading) return <Skeleton className="h-96 w-full" />;
  if (orderQuery.isError) return <ErrorState error={orderQuery.error} onRetry={() => orderQuery.refetch()} />;

  const order = orderQuery.data?.order;
  if (!order) return <ErrorState error={new Error("Order not found")} />;

  const items = orderQuery.data?.items ?? [];
  const pickup = pickupQuery.data?.pickup;

  const currentIdx = TIMELINE_KEYS.findIndex((s) => s.status === order.status);
  const uniqueFarmers: OrderItemRecord[] = Array.from(new Map(items.map((i: OrderItemRecord) => [i.farmerId, i])).values());
  const isTerminalBranch = order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DISPUTED;
  const cropName = order.crop ? getCropName(order.crop, t) : "";

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-charcoal-700">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-charcoal-900">{order.orderCode}</h1>
          <p className="text-sm text-charcoal-600">
            {cropName} · {order.totalQuantityKg} kg · ₹{order.totalAmount.toLocaleString("en-IN")}
          </p>
        </div>
        <Badge tone={orderStatusTone(order.status)}>
          {t(`orderStatus.${order.status}`, order.status.replace(/_/g, " "))}
        </Badge>
      </div>

      {!isTerminalBranch && (
        <Card>
          <CardHeader>
            <CardTitle>{t("buyer.orderDetail.orderLifecycle")}</CardTitle>
          </CardHeader>
          <div className="flex items-center overflow-x-auto pb-2 scrollbar-thin">
            {TIMELINE_KEYS.map((step, i) => (
              <div key={step.status} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5 px-1">
                  <div
                    className={cn(
                      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      i < currentIdx
                        ? "bg-brand-700 text-cream-50"
                        : i === currentIdx
                        ? "bg-brand-100 text-brand-700 ring-2 ring-brand-600"
                        : "bg-charcoal-900/8 text-charcoal-600/50"
                    )}
                  >
                    {i < currentIdx ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className="w-20 text-center text-[10px] font-medium text-charcoal-600">
                    {t(`orderStatus.${step.key}`, step.key.replace(/_/g, " "))}
                  </span>
                </div>
                {i < TIMELINE_KEYS.length - 1 && (
                  <div className={cn("h-0.5 flex-1", i < currentIdx ? "bg-brand-600" : "bg-charcoal-900/10")} />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("buyer.orderDetail.farmerContributions")}</CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg bg-cream-100 px-3.5 py-2.5 text-sm">
              <span className="font-semibold text-charcoal-900">{item.farmerName}</span>
              <span className="text-charcoal-600">
                {item.quantityKg} kg × ₹{item.pricePerKg} = ₹{item.subtotal.toLocaleString("en-IN")}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {(order.status === OrderStatus.PAYMENT_HELD || order.status === OrderStatus.BATCH_FORMED) && (
        <Card>
          <CardHeader>
            <CardTitle>{t("buyer.orderDetail.schedulePickup")}</CardTitle>
          </CardHeader>
          <PickupScheduleForm orderId={order.id} onScheduled={invalidate} />
        </Card>
      )}

      {pickup && order.status === OrderStatus.PICKUP_SCHEDULED && (
        <Card>
          <CardHeader>
            <CardTitle>{t("buyer.orderDetail.pickupDetails")}</CardTitle>
          </CardHeader>
          <p className="flex items-center gap-1.5 text-sm text-charcoal-700">
            <MapPin className="h-4 w-4" /> {pickup.location} · {pickup.scheduledDate} at {pickup.scheduledTime}
          </p>
          <p className="mt-1 text-sm text-charcoal-700">
            {t("logistics.vehicle")} {pickup.vehicleNumber} · {t("logistics.driver")} {pickup.driverName}
          </p>
          <Button className="mt-4" loading={markInTransit.isPending} onClick={() => markInTransit.mutate()}>
            <Truck className="h-4 w-4" /> {t("buyer.orderDetail.markInTransit")}
          </Button>
        </Card>
      )}

      {order.status === OrderStatus.IN_TRANSIT && (
        <Card>
          <Button loading={markDelivered.isPending} onClick={() => markDelivered.mutate()}>
            <Check className="h-4 w-4" /> {t("buyer.orderDetail.confirmDelivery")}
          </Button>
        </Card>
      )}

      {order.status === OrderStatus.DELIVERED && (
        <Card>
          <CardHeader>
            <CardTitle>{t("orderStatus.payment_released")}</CardTitle>
          </CardHeader>
          <p className="mb-3 flex items-center gap-1.5 text-sm text-charcoal-700">
            <ShieldCheck className="h-4 w-4 text-brand-600" /> {t("orderStatus.delivered")}
          </p>
          <Button loading={releasePayment.isPending} onClick={() => releasePayment.mutate()}>
            {t("orderStatus.payment_released")} (demo escrow)
          </Button>
        </Card>
      )}

      {(order.status === OrderStatus.PAYMENT_RELEASED || order.status === OrderStatus.COMPLETED) && uniqueFarmers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Star className="h-4 w-4" /> {t("buyer.orderDetail.rateFarmer")}
            </CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {uniqueFarmers.map((f) => (
              <RateFarmer key={f.farmerId} orderId={order.id} farmerId={f.farmerId} farmerName={f.farmerName} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
