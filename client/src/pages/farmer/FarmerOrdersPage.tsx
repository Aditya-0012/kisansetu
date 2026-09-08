import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Inbox, ClipboardList, Truck, User, Calendar, MapPin } from "lucide-react";
import { OfferStatus, OrderStatus } from "@kisansetu/shared";
import { offerApi, orderApi, ApiRequestError } from "../../lib/api";
import { Badge, orderStatusTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { SkeletonList } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import { getCropName } from "../../utils/cropNames";
import { cn } from "../../lib/cn";

function OfferRow({ offer }: { offer: import("@kisansetu/shared").Offer }) {
  const { t } = useTranslation();
  const { push } = useToast();
  const qc = useQueryClient();
  const [counterPrice, setCounterPrice] = useState("");
  const [showCounter, setShowCounter] = useState(false);

  const respond = useMutation({
    mutationFn: (body: { action: "accept" | "reject" | "counter"; counterPricePerKg?: number }) =>
      offerApi.respond(offer.id, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["offers", "mine"] });
      push({
        kind: vars.action === "reject" ? "info" : "success",
        title: vars.action === "counter" ? t("farmer.offers.sendCounter") : t("common.confirm"),
      });
      setShowCounter(false);
    },
    onError: (err) =>
      push({ kind: "error", title: err instanceof ApiRequestError ? err.message : t("common.somethingWentWrong") }),
  });

  const lastAction = offer.history?.[offer.history.length - 1];
  const farmerActedLast = lastAction?.actor === "farmer";
  const actionable = offer.status === OfferStatus.PENDING || (offer.status === OfferStatus.COUNTERED && !farmerActedLast);
  const cropLabel = offer.crop ? getCropName(offer.crop, t) : "";

  return (
    <div className="rounded-lg border border-charcoal-900/8 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-charcoal-900">
            {cropLabel ? `${cropLabel} · ` : ""}₹{offer.offeredPricePerKg}/kg × {offer.quantityKg}kg
          </p>
          <p className="text-xs text-charcoal-600">
            {offer.buyerName ? `${t("farmer.offers.buyerLabel")}: ${offer.buyerName} · ` : ""}₹
            {(offer.offeredPricePerKg * offer.quantityKg).toLocaleString("en-IN")} {t("common.total").toLowerCase()}
          </p>
        </div>
        <Badge
          tone={
            offer.status === OfferStatus.ACCEPTED
              ? "success"
              : offer.status === OfferStatus.REJECTED
              ? "danger"
              : "info"
          }
        >
          {t(`offerStatus.${offer.status}`, offer.status)}
        </Badge>
      </div>

      {farmerActedLast && offer.status === OfferStatus.COUNTERED && (
        <p className="mt-2.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md inline-block font-medium">
          {t("farmer.offers.counterSentWaiting", { price: offer.offeredPricePerKg })}
        </p>
      )}

      {actionable && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => respond.mutate({ action: "accept" })} loading={respond.isPending}>
            {t("farmer.offers.accept")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowCounter((v) => !v)}>
            {t("farmer.offers.counter")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => respond.mutate({ action: "reject" })}>
            {t("farmer.offers.reject")}
          </Button>
        </div>
      )}

      {showCounter && (
        <div className="mt-3 flex items-center gap-2">
          <Input
            placeholder={t("farmer.offers.newPricePerKg")}
            type="number"
            value={counterPrice}
            onChange={(e) => setCounterPrice(e.target.value)}
            className="max-w-[150px]"
          />
          <Button
            size="sm"
            onClick={() => respond.mutate({ action: "counter", counterPricePerKg: Number(counterPrice) })}
            disabled={!counterPrice}
            loading={respond.isPending}
          >
            {t("farmer.offers.sendCounter")}
          </Button>
        </div>
      )}
    </div>
  );
}

function OrdersTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["orders", "farmer"],
    queryFn: () => orderApi.list(),
  });
  const orders = data?.orders ?? [];

  if (isLoading) return <SkeletonList count={3} />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (orders.length === 0)
    return (
      <EmptyState
        icon={ClipboardList}
        title={t("farmer.orders.noOrdersYet")}
        description={t("farmer.orders.noOrdersDesc")}
      />
    );

  return (
    <div className="space-y-4">
      {orders.map((o) => {
        const cropLabel = o.crop ? getCropName(o.crop, t) : "";
        return (
          <div key={o.id} className="rounded-xl border border-charcoal-900/8 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-charcoal-900">{o.orderCode}</p>
                {cropLabel && <p className="text-xs font-semibold text-brand-700">{cropLabel}</p>}
              </div>
              <Badge tone={orderStatusTone(o.status)}>
                {t(`orderStatus.${o.status}`, o.status.replace(/_/g, " "))}
              </Badge>
            </div>

            <p className="text-xs text-charcoal-600">
              {t("farmer.orders.yourShare")}: {o.farmerQuantityKg ?? o.totalQuantityKg}kg · ₹
              {(o.farmerSubtotal ?? o.totalAmount).toLocaleString("en-IN")}
            </p>

            <OrderProgress status={o.status} />

            {/* 🚚 Logistics & Driver Details Section for the Farmer */}
            {o.pickup ? (
              <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/50 p-3 text-xs text-charcoal-800 space-y-2">
                <div className="flex items-center justify-between font-semibold text-brand-900">
                  <span className="flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-brand-700" />
                    {t("logistics.pickupScheduledTitle")}
                  </span>
                  <span className="capitalize px-2 py-0.5 rounded-full text-[11px] bg-brand-100 text-brand-800 font-medium">
                    {t(`logistics.status${o.pickup.status.charAt(0).toUpperCase() + o.pickup.status.slice(1)}`, o.pickup.status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-charcoal-700">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                    <span>
                      <strong className="text-charcoal-900">{t("logistics.driver")}:</strong> {o.pickup.driverName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                    <span>
                      <strong className="text-charcoal-900">{t("logistics.vehicle")}:</strong> {o.pickup.vehicleNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                    <span>
                      <strong className="text-charcoal-900">{t("logistics.time")}:</strong> {o.pickup.scheduledDate} at {o.pickup.scheduledTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                    <span className="truncate">
                      <strong className="text-charcoal-900">{t("logistics.location")}:</strong> {o.pickup.location}
                    </span>
                  </div>
                </div>
              </div>
            ) : o.status === OrderStatus.PICKUP_SCHEDULED ? (
              <div className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800 flex items-center gap-2">
                <Truck className="h-3.5 w-3.5 text-amber-600" />
                <span>{t("logistics.pickupScheduledTitle")}</span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const PROGRESS_STEPS = [
  OrderStatus.CONFIRMED,
  OrderStatus.PAYMENT_HELD,
  OrderStatus.PICKUP_SCHEDULED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERED,
  OrderStatus.PAYMENT_RELEASED,
];

function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === OrderStatus.CANCELLED || status === OrderStatus.DISPUTED) return null;
  const currentIdx = PROGRESS_STEPS.indexOf(status);
  return (
    <div className="mt-2 flex items-center gap-1">
      {PROGRESS_STEPS.map((step, i) => (
        <div
          key={step}
          className={cn("h-1.5 flex-1 rounded-full", i <= currentIdx ? "bg-brand-600" : "bg-charcoal-900/10")}
        />
      ))}
    </div>
  );
}

export function FarmerOrdersPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"offers" | "orders">("offers");
  const offersQuery = useQuery({ queryKey: ["offers", "mine"], queryFn: () => offerApi.list() });
  const offers = offersQuery.data?.offers ?? [];

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-charcoal-900">{t("farmer.ordersTitle")}</h1>

      <div className="flex gap-1 rounded-lg bg-charcoal-900/5 p-1">
        <button
          onClick={() => setTab("offers")}
          className={cn(
            "flex-1 rounded-md py-2 text-sm font-semibold transition-colors",
            tab === "offers" ? "bg-white shadow-sm text-brand-700" : "text-charcoal-600"
          )}
        >
          {t("farmer.tabs.offers")}
        </button>
        <button
          onClick={() => setTab("orders")}
          className={cn(
            "flex-1 rounded-md py-2 text-sm font-semibold transition-colors",
            tab === "orders" ? "bg-white shadow-sm text-brand-700" : "text-charcoal-600"
          )}
        >
          {t("farmer.tabs.orders")}
        </button>
      </div>

      {tab === "offers" ? (
        offersQuery.isLoading ? (
          <SkeletonList count={3} />
        ) : offersQuery.isError ? (
          <ErrorState error={offersQuery.error} onRetry={() => offersQuery.refetch()} />
        ) : offers.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={t("farmer.offers.noOffersYet")}
            description={t("farmer.offers.noOffersDesc")}
          />
        ) : (
          <div className="space-y-3">
            {offers.map((o) => (
              <OfferRow key={o.id} offer={o} />
            ))}
          </div>
        )
      ) : (
        <OrdersTab />
      )}
    </div>
  );
}
